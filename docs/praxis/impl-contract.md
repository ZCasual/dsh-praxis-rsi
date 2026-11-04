# Praxis 实现契约 v1（冻结）

> 冻结时间：2026-11-04 09:35 CST。任何接口改动必须由 Lead 升版本并通知全部成员。
> 目标：`@local/dsh-praxis` DSH Host bundle + Client 面板；测试区 `test/praxis/`。

## 1. 包与装配

```text
plugins/dsh-praxis/
  package.json          name @local/dsh-praxis; exports . ./client ./locale/*.json ./icon
                        dsh.bundle.patch=./cordis.patch.yml; dsh.client{platform:web, immediately:true, inject:[only ordering]}
  cordis.patch.yml      insert 1 row: id praxis, name @local/dsh-praxis
  index.js              Host apply(ctx, config)
  client.js             browser module: window.__ModuleLoader__.load({id:'@local/dsh-praxis', factory})
  src/engine.js         pure engine, no IO, no imports except node:crypto
  src/domain.js         defineDomain + zod tables
  src/store.js          persistence adapter over storageDomain (or memory fallback)
  src/host.js           engine+store+actor/permission facade
  src/http.js           loopback routes /praxis/api/*
  playbooks/*.json      4 playbooks
  locale/{zh,en}.json   meta.title/description + UI strings
  icon.svg
```

Host `inject = ['tools','commands','systemPrompt','webServer','storageDomain']`。`storageDomain` 缺失时用内存 store 并记录 `durability:'memory'`（仅供测试，不宣称持久）。

## 2. Engine 纯接口（`src/engine.js`）

```js
export const PLAYBOOKS = { 'scientific-loop': {...}, 'engineering-release': {...}, 'audit-redteam': {...}, 'knowledge-production': {...} }
export const DEFAULT_KNOBS = { heterogeneityFloor:.35, ambitionFloor:.45, inflationGap:.25, sameConclusionLimit:2, maxPersonas:5, minPersonas:3, probeBudget:8, evalSeeds:3, wallMin:45, agentDepth:3, l2CodeEdit:false, l3MetaEdit:false, primaryModel:'primary', secondaryModel:'secondary', explorationQuota:.2 }
export function createEngine({knobs}) => {
  execute(command) -> Receipt,
  gate(runId, target) -> {allow, missing[], nextAction, state, runId},
  snapshot() -> {runs[], playbooks[], knobs, defaults, knobFields[]},
  runView(runId) -> RunView,
  map(runId) -> {nodes[], edges[], frontier[], blindSpots[], contradictions[], meanReversion{}},
  dump() -> {v:1, knobs, runs[], receipts[]},
  load(dump) -> void,
  knobs
}
```

命令：

```js
{ commandId, actor:{kind:'user'|'root'|'coding'|'reviewer'|'evaluator'|'worker', id}, action, runId?, expectedDomainVersion?, payload }
```

回执：

```js
{ status:'committed'|'replayed'|'rejected', reasonCode?, runId?, state?, version?, blockers?, nextAction?, forked?, reason?, data? }
```

动作与权限：

| action | user | root | coding/worker | reviewer | evaluator |
|---|---|---|---|---|---|
| start | ✓ | ✓ | | | |
| prereg_freeze | ✓ | ✓ | | | |
| discussion | ✓ | ✓ | | | |
| pin_persona | ✓ | ✓ | | | |
| experiment | ✓ | ✓ | ✓ | | |
| review | ✓ | ✓ | | ✓ | |
| stage4 | ✓ | ✓ | | | |
| eval_report | | | | | ✓ |
| eval_read | ✓ | ✓ | | | |
| memory_propose | | ✓ | | | |
| memory_commit | ✓ | | | | |
| map_claim / map_edge | ✓ | ✓ | | | |
| decision | ✓ | ✓ | | | |
| promote | ✓ | | | | |
| set_knobs | ✓ | | | | |
| activate / gate / map / snapshot | 只读，任何 actor | | | | |

状态机：`INTAKE → QUESTION → PREREG_FROZEN → DISCUSSION → SYNTHESIS → EXEC_READY → EXECUTING → REVIEW → STAGE4 → EVAL → MEMORY → DECISION → CLOSED`；旁路 `DRIFT_DETECTED`、`BLOCKED`。

硬规则（每条都必须有测试）：

1. `experiment` 需要 `PREREG_FROZEN`；否则 `rejected/PREREG_REQUIRED`，`blockers` 列出缺失契约。
2. 冻结后改 prereg → `PREREG_VIOLATION`，旧契约不覆盖，`nextAction:'new-run'`。
3. `promote`：kernel 路径（evaluator/stop/permissions/hidden-tests/data-boundary/audit/memory-commit）→ `FORBIDDEN_BOUNDARY_EDIT`；无 eval_read → `EVAL_NOT_READ`；L2/L3 关闭 → `L2_CLOSED`/`L3_CLOSED`。
4. `memory_commit` 仅 user；`memory_propose` 仅 root/agent；未 commit 的 proposal 不算记忆。
5. `decision`：同结论第 N 次（`sameConclusionLimit`）且 `next=repeat-same` → `DRIFT_DETECTED`；恐惧信号且无 evidenceRefs → `UNKNOWN_FEAR`。
6. `pin_persona`：缺 `topicBinding.{defaultAssumptionToAttack,expectedCounterexample,falsifiableDisagreement}` 或 `sinthome.observableWorkProduct` → `PERSONA_DECORATIVE`。
7. `set_knobs` 不改当前 run，生成 fork（新 runId，parentId，`forked:true`）。
8. 幂等：同 `(runId,commandId)` 返回 `replayed`，不重复副作用。
9. 版本冲突：`expectedDomainVersion !== run.version` → `CONFLICT`，retry manual。
10. 野心/异质度低于地板 → `CORRUPTION_WARNING` 写入 receipt + 事件；不阻断流程但进入 UI 阻断区。

## 3. RunView / MapView（Client 唯一数据面）

```js
RunView = {
  id,title,playbookId,state,version,parentId,createdAt,updatedAt,
  knobHash,knobs,models,prereg:{hash,frozen,contract},preregHash,
  stage,nextAction,blockers[],personas[],participants[],
  discussion:{rounds,packages[],heterogeneity:{D,styleOnly,gain,minorityRetention}},
  experiments:[{id,command,artifactHash,resultState,at}],
  reviews:[{verdict,items[],at}],
  eval:{reportHash,verdict,readAt,seeds},
  decision:{conclusion,next,evidenceRefs,ambition,at},
  ambition:{A_p,E,A_d,A_final,inflationFlag,corruptionFlags},
  memory:{proposals[],commits[]},
  events[],claims[],edges[],contradictions[],
  lineage:{parentId,children[]}
}
MapView = {runId,nodes[],edges[],frontier[],blindSpots[],contradictions[],meanReversion:{distance,centered,suspect}}
```

## 4. HTTP（`src/http.js`，loopback）

- `GET /praxis/api/state` → `{...view, view, runs, knobs, defaults, knobFields, playbooks, map?, durability:'file'|'durable'|'memory', product:'Praxis', wireVersion:1}`
- `POST /praxis/api/command` body `{command}` → `{receipt, view}`；header `x-praxis-request: 1`；仅 127.0.0.1/localhost；Origin 必须同源或缺失；否则 403。
- `GET /praxis/api/map?runId=` → `{map}`。
- 错误：`{error, code, blockers?, receipt?}` + 4xx/5xx。

## 5. Client（`client.js`）

- `window.__ModuleLoader__.load({ id:'@local/dsh-praxis', factory(require) })`；`require('react')`；不 import 任何 Harness Client 包。
- `inject:['slots']`；注册：
  - `sidebar.panellist` id `praxis`, order 35, label `Praxis`
  - `main` key `praxis`
  - `conversation.composer.dock` id `praxis`, order 40
- 轮询 `/praxis/api/state`（4s，隐藏页暂停）；命令 POST；失败显示可读错误，不伪造成功。
- 页面：`tower` `map` `contract` `discuss` `experiment` `eval` `lineage` `memory` `audit` `knobs`。每页有 loading/empty/error/stale 四态。
- 只用 `--dsw-alias-*` token；亮/暗跟随；键盘可达；不用颜色单独表意。
- 设计语言 Observatory：石墨底、细线、等宽数字、时间线优先、状态色琥珀/红/青/紫；禁卡片汤、渐变、圆角堆叠。

## 6. Store（`src/store.js`）

```js
createStore({domain?}) => {
  load() -> dump|null,
  save(dump) -> Promise,
  saveReceipt(commandId, receipt) -> Promise,
  getReceipt(commandId) -> receipt|null,
  durability: 'durable'|'memory',
  close()
}
```

Domain `praxis` v1（可选）：tables `runs`（key runId）、`receipts`（key commandId）、`meta`（key 'dump'）。值用 `z.object({}).passthrough()` 包一层版本字段。

实际默认实现是**文件存储**：`~/.dsh/praxis/state.json`（可用 Config `statePath` 覆盖），tmp+rename 原子写，`durability:'file'`；`createStore()` 无参为内存模式（测试用），`createStore({domain})` 为 domain 模式（`durability:'durable'`）。启动 `load()` 失败 → 空状态 + 日志，不抛。

## 7. 测试（`test/praxis/`）

- `engine.test.js`：状态机、10 条硬规则、评分函数、地图、fork、幂等、冲突。
- `store.test.js`：fake domain 持久化/重载/回执。
- `http.test.js`：fake req/res，200/403/400 分支。
- `host.test.js`：actor 权限、tool 文本。
- `integration.test.js`：start→freeze→discussion→experiment→eval→memory→decision 全链路。
- 命令：`node --test test/praxis/*.test.js`；必须 0 fail 0 skip。

## 8. 验收证据

1. 测试全绿输出；
2. `Config.listConfigs` 中 praxis `active`；
3. `Slots.listSubTree` occupants 含 praxis；
4. `/praxis/api/state` 返回 200 且非空；
5. 截图：Control Tower、Cognitive Map、Contract、Knobs，亮/暗各一；
6. README 只写已验证项，未验证单列。
