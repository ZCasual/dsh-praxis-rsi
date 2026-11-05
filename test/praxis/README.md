# Praxis 测试套件（test/praxis）

TDD 契约测试，唯一事实来源是 `docs/praxis/impl-contract.md`（冻结 v1）。
测试先于实现编写；实现侧按本套件的失败清单收敛，最后要求 **0 fail 0 skip**。

## 运行

```bash
# 全量（验收命令）
node --test test/praxis/*.test.js

# 单文件
node --test test/praxis/engine.test.js
node --test test/praxis/store.test.js
node --test test/praxis/host.test.js
node --test test/praxis/http.test.js
node --test test/praxis/integration.test.js

# 只看失败名
node --test test/praxis/*.test.js 2>&1 | grep -E '^(✖|ℹ (tests|pass|fail))'
```

无测试依赖、无网络、无文件系统写入：`store.test.js` 用内存 fake domain，
`http.test.js` 用 fake `req`/`res`。仅依赖 Node 内置 `node:test`/`node:assert`。

## v2 契约测试与证据工具（2026-11-05）

权威契约：`docs/praxis/redesign/10-v2-contract.md`（v2，冻结）。

| 文件 | 覆盖 |
|---|---|
| `engine-v2.test.js` | T1.1 question / T1.2 QUESTION_REQUIRED / T1.3 INVALID_TRANSITION / T4.1 fork 纯净性 / T4.2 fork 门禁 / T4.3 dump 迁移与幂等 |
| `graph-v2.test.js` | 双轴状态 / T2.1 receipt 驱动 / T2.2 拓扑钳制 / I1–I6 审计 / T4.1–T4.2 图投影 / T5.1 布局 / T5.2 迁移 / T6.1 V10 / T6.2 derivePort / T6.3 V11 / T7.1 graphView |
| `wire-v2.test.js` | T8.1 wireVersion=2 / T8.2 catalog / T8.3 view.graph / T8.4 state 信封 / T8.5 200-409-422 / T8.6 GET/POST graph + expectedRevision / T8.7 evidence |
| `client-build.test.js` | §4.1 模块拆分、`build-client.mjs --check` 不写盘 |
| `acceptance/browser.test.js` | §5.6/§5.7 真实 Chrome+CDP：1440 签收指标、1024/700 compat（溢出 0、viewport-hint、可拖拽）、内部码、主按钮唯一、truthful projection |
| `acceptance/full-loop.test.js` | 真实 HTTP handler 全生命周期（含 delegatedActor evaluator/root 委托、DECISION、2 条 `actor.delegated`、receipt 不泄漏内部异常） |
| `wire-v2.test.js` 增补 | delegatedActor 权限：无/非法委托 → 422 FORBIDDEN_ACTOR；合法委托 → 200 |

```bash
# 契约/不变量（D1）
node --test test/praxis/*.test.js

# 浏览器验收（D2；Node 25 不接受目录参数，须用文件/glob）
node --test test/praxis/acceptance/browser.test.js

# 证据（D3）：capture 自管实例（随机端口 + 独立 statePath/profile），生成 manifest
node tools/evidence/capture.mjs --all
```

`--all` = light + dark 各跑一次自管实例，场景矩阵 1440×1000 / 1024×900 ×
`empty` / `running` / `selected` / `blueprint`（≥8 张），写入
`docs/praxis/evidence/manifest.json`（sha256、build hash、git commit、node/package 版本、
端口、打码 token URL、statePath、viewport、theme、scenario、time、§5.6 metrics）。

浏览器验收的 skip 规则：3081/指定实例不可达、缺 token 或缺 Chrome 时显式
`t.skip(原因)`，绝不静默通过。暗色断言只能对独立 dark 实例运行
（`PRAXIS_THEME=dark`；capture 用 `ui-theme.preference=dark` patch 启动）；
light 实例上暗色用例显式 skip 并打印原因。

当前验收结果（2026-11-05 03:0x，build 17dc23af5f2e，client.js --check 通过）：
- 契约套件 `node --test test/praxis/*.test.js`：140 tests / 140 pass / 0 fail / 0 skip
- 浏览器+全链路（light 实例）：8 tests / 7 pass / 0 fail / 1 skip（暗色由独立 dark 实例证据）
- 浏览器+全链路（dark 实例）：8 tests / 8 pass / 0 fail / 0 skip
- 证据 `docs/praxis/evidence/manifest.json`：`ok=true`，25 张；`signoff.signed` 6（light empty/running/selected/blueprint 1440 + dark running/selected 1440），`compat` 12（1024/700 + clean/drawer/loading/map），`unverified` 3（error/stale/14-nodes，未伪造）；`unexpectedMetricViolations:0`，`expectedMetricViolations:2`（B-V03 drawer primary 规则）；`contrastSummary.light={textMin:5.8,nonTextMin:5.31}`、`dark={textMin:5.55,nonTextMin:9.47}`；`sceneConsistency.progressValues=['3/10']`；selected/inspector 交集 0；700×600 running=15/15、scale 0.686、W0.956/H0.388/area0.371、overflow 0、hint true。

## 当前状态（2026-11-04 14:5x CST，已验收）

```text
ℹ tests 99
ℹ pass 99
ℹ fail 0
ℹ skipped 0
ℹ todo 0
```

分组：engine 39、store 6、host 10、http 14、integration 1、graph 21、graph-api 8。
其中原 21 条（engine 18 + host 3）保持通过；连续两次运行结果一致（无随机/时间敏感断言）。

图模型（redesign v1）首轮红测 9 fail 已由实现方全部修复并锁定：
graphStates 的三个 gate 推导（prereg=false→active、experiment 冻结后未执行→active、eval 只认
readAt/reportHash）、GET /graph 顶层信封与无 run 默认图、dump.graphs 对象映射、HTTP 管理动作
`body.actor` 透传（非 user → 4xx USER_ONLY）。

## 文件职责

| 文件 | 覆盖契约 | 关键断言 |
|---|---|---|
| `engine.test.js` | §2 状态机、10 条硬规则、评分函数、认知地图、fork、幂等、冲突、§3 RunView | 原 18 条保留 + 21 条契约测试 |
| `store.test.js` | §6 store | fake domain 的 save→load→receipt 重载、幂等、损坏数据不抛 |
| `host.test.js` | §2 Host facade | actor 权限、只读命令、`commandText`、`toolResult`、`view()` 形状 |
| `http.test.js` | §4 loopback HTTP | 200/403/400/405、同源与 `x-praxis-request`、状态信封、`/map` |
| `integration.test.js` | §7 全链路 | start→freeze→discussion→experiment→review→stage4→eval_report→eval_read→memory_propose→memory_commit→decision |

## 测试固化的接口约定（实现方需满足）

### engine（`src/engine.js`）

- `createEngine({knobs})` 返回 `{execute, gate, snapshot, runView, map, dump, load, knobs, getRun}`。
- `runView(runId)` 顶层字段见契约 §3；`prereg:{hash,frozen,contract}`、
  `discussion.heterogeneity:{D,styleOnly,gain,minorityRetention}`、
  `eval:{reportHash,verdict,readAt,seeds}`、`ambition:{A_p,E,A_d,A_final,inflationFlag,corruptionFlags}`、
  `lineage:{parentId,children}` 均需存在。
- `map(runId)` 返回 `MapView`，并**同时保留**兼容字段 `averaged:false`（原 18 条测试要求；
  `cognitiveMap(runId)` 作为别名继续可用）。
- `dump()` → `{v:1,knobs,runs[],receipts[]}`；`load(dump)` 后 `replayed` 语义必须保持。
- `snapshot()` 含 `defaults`、`knobFields`（9 项，带 `key`/`label`）。
- 硬规则回执字段：`reasonCode`、`nextAction`（规则 2 为 `'new-run'`）、`retry:'manual'`（规则 9）、
  `blockers[]`（规则 1）、`corruptionFlags`（规则 10 含 `'CORRUPTION_WARNING'`，同时写事件 `type` 含 `corruption`）。
- 规则 1 语义：`experiment` 要求 prereg 已冻结（`preregHash` 已存在），因此
  `prereg_freeze → discussion → experiment` 合法；未冻结时 `rejected/PREREG_REQUIRED`。
- 动作→状态（测试断言）：`start`→INTAKE、`prereg_freeze`→PREREG_FROZEN、
  `discussion`→DISCUSSION（允许 SYNTHESIS）、`experiment`→EXECUTING、`review`→REVIEW、
  `stage4`→STAGE4、`eval_report`→EVAL、`eval_read` 保持 EVAL 并写 `eval.readAt`、
  `memory_propose`/`memory_commit`→MEMORY、`decision`→DECISION；规则 5 漂移→DRIFT_DETECTED。
  状态只允许沿契约顺序前进，集成测试逐步校验不回退。
- 历史承诺（原 21 条测试）：`start` 后 `state:'INTAKE'`；`getRun`/`snapshot().runs[0]` 字段
  （`id/state/playbookId/version/knobHash/models/preregHash/personas/events/claims/contradictions`）；
  root 可执行 `promote`/`memory_commit` 并在业务层返回 `EVAL_NOT_READ`/`USER_ONLY` 等码。
- 权限表按契约 §2 执行：未授权组合返回 `rejected/FORBIDDEN_ACTOR`；`memory_commit` 与
  `set_knobs` 对 root 允许走业务拒绝（`USER_ONLY`）以兼容既有测试。

### store（`src/store.js`）

- `createStore({domain})`：`domain` 为已打开的 storage-domain 句柄（`table(name)` →
  `{get,put,entries,keys,delete,update}`，或扁平 `get(name,key)`/`put(name,key,value)`/`entries(name)`）。
  契约要求 `durability:'durable'`；无 domain 时 `durability:'memory'`。
- `save(dump)` 落 `runs`/`receipts`/`meta` 三表；`load()` 重建 dump 且深等；`saveReceipt`/`getReceipt`
  跨 `createStore` 实例可读；损坏/抛错的 domain 让 `load()` 返回 `null` 而不抛。
- 文件型实现可作为无 domain 的兜底，但契约 §6 的 fake-domain 用例必须绿。

### host（`src/host.js`）

- `createHost()` → `{execute, view, engine, ...}`；`execute(input, source)`，
  `source:'user'` → user，`'agent'` → root，`input.actor` 优先。
- `view()` 含 `product:'Praxis'`、`wireVersion:1`、`activeRunId`、`active`、`runs`、`knobs`、
  `defaults`、`knobFields`、`playbooks`、`durability`。
- `commandText(receipt)`：committed/replayed 带 runId；rejected 带 `reasonCode` 与 `→ nextAction`。
- `toolResult(receipt)` 至少含 `status/reasonCode/runId/nextAction/blockers/forked/state`（允许多余字段）。

### http（`src/http.js`）

- `registerHttp(ctx, host)`：`ctx.webServer.{host:'127.0.0.1', port, register}`；注册
  `{kind:'prefix', path:/praxis...}`；绑定非 loopback 抛错。
- `handleApi(host, {method, pathname, search, body})` 纯路由 seam。
- 线上语义：GET `/praxis/api/state` → 200，信封含顶层 `view` + `runs/knobs/defaults/knobFields/
  playbooks/durability/product/wireVersion`；POST `/praxis/api/command` body `{command}` →
  200 `{receipt,view}`；引擎拒绝 → 4xx 且 body 含 `{error, code, receipt, blockers?}`（`code===reasonCode`）；
  `x-praxis-request:1` 缺失、Host 非 loopback、跨源 Origin → 403；坏 JSON/缺 command → 400；
  GET `/praxis/api/map?runId=` → `{map}`。

## 图模型与画布测试（redesign v1，2026-11-04）

验收命令不变（`node --test test/praxis/*.test.js`），新增两个文件：

| 文件 | 覆盖 | 关键断言 |
|---|---|---|
| `graph.test.js` | `07-graph-contract.md` §1–§4 | `buildDefaultGraph` 全 playbook 校验通过/阶段覆盖/类型与端口；`validateGraph` V1–V9 各一条；`graphStates` INTAKE/PREREG_FROZEN/EVAL/DRIFT 推导与 current；纯函数不变异 |
| `graph-api.test.js` | §5–§6 | `GET /graph`（无 run 默认图 + 空 states；有 run 图+states）；`POST /graph` 合法 200 `{graph,receipt}` 且落 `dump.graphs`、重启后保留；非法 400 `{error,code:'INVALID_GRAPH',errors:[{code}]}`；`POST /layout` 只合并 position；非 user actor 4xx `USER_ONLY` 且不落盘 |

实现侧接口（测试固化，实现方按此交付）：

```js
// src/graph.js
buildDefaultGraph(playbook)              // 传 PLAYBOOKS[id] 对象，返回 Graph（id = `${playbookId}:v${version}`）
validateGraph(graph, playbook)           // -> { ok: boolean, errors: [{ code: 'V1'..'V9', message? }] }
graphStates(run, graph)                  // -> { states: { [nodeId]: 'pending'|'active'|'blocked'|'done'|'failed'|'quarantined' }, current: nodeId|null }
```

- Graph 形状按契约 §1；默认图拓扑按 §2（scientific-loop 为单链 start→…→end，含 prereg/experiment/eval 三个 gate；gate→stage 边 port=`contract`，stage→stage 边 port=`artifact`，review→eval 边 port=`evidence`，且至少有一条 evidence 边）。
- 阶段覆盖：`playbook.stages ⊆ {node.stage}`（gate 节点可带 `stage` 以覆盖 `prereg` 这类无独立 stage 节点的阶段）。
- `graphStates`：stage 节点按 run.state 在 playbook 阶段序中的位置得 done/active/pending，`DRIFT_DETECTED` → failed；`prereg_gate` 看 `run.preregHash`；`experiment_gate` 无 preregHash→blocked、冻结后未 EXECUTING→active、之后→done；`eval_gate` 看 `run.eval.readAt`/`run.eval.reportHash`；`current` 为拓扑序第一个 active/blocked。
- 管理动作只允许 `user`：HTTP 请求体可带可选 `actor`（缺省视为 user），`actor.kind !== 'user'` → 4xx `{error, code:'USER_ONLY'}`。
- 持久化：`engine.dump()` 增加 `graphs: { [playbookId]: Graph }`，`load()` 恢复；layout 合并进 Graph 的 `position` 后随图落盘（不另存表）；图保存写 `graph.saved` 事件（meta）。
- `POST /graph` 成功后返回 `{graph, receipt}`，`receipt.status === 'committed'`，`graph.contentHash` 非空。


## v4 驾驶舱测试（2026-11-05，build 58e97c88da0d）

v4 判据见 `docs/praxis/redesign/20-rewrite-brief.md` §2/§3/§5；v3 的 15 节点画布/拓扑编辑已被移除。

| 文件 | 覆盖 | 关键断言 |
|---|---|---|
| `team.test.js` | §3 团队投影 | live 时 members 与 `listMembers` 一致；kind=lead/teammate/subagent；status busy/idle/starting/error→running/inactive/provisioning/failed/unknown；currentTask 归属与 counts；branchIds 由 ownerId 反查；**无服务/无 membership 时 source='none' 且 members=[]**（安全底线） |
| `branch.test.js` | §2.2/§2.3 分支状态机 | start 自动建 b_main(proposed)；冻结前 activate→INVALID_TRANSITION；propose→assign→activate 可**多 active（B2）**；证据 2 支持/1 反驳计数；verdict→merge 记录 mergedInto（B3）；B1 unfalsifiable 拒 verdict；B4 非法 kind/空 ref 拒证据；evaluator 仅 eval、coding 无 branch_activate；dump/load 保留 |
| `wire-v4.test.js` | §8 Wire | `GET /state` wireVersion=3；无 run 时 branches/team/gates 空且不伪造；有 run 时 branches 非空、gates=10、evidenceRows 数组；PREREG_FROZEN 门禁 question/prereg=passed、discussion=blocked；HTTP 分支命令与 evidenceRows 投影 |
| `acceptance/cockpit.test.js` | §4/§5 A2/A3/A4/A6 | 自管实例 + 真实 Chrome：1440 驾驶舱 branch-board、branch-card≥2、同屏可见≥2、gate-rail 10 行、evidence-band、primary=1、无横向溢出；点分支→inspector 出现且 primary≤1；team-chip data-source∈{live,none}，none 时抽屉含“尚未组建团队”；无 node/.px-port/拖拽 |

当前结果（build `58e97c88da0d`，client.js `--check` 通过）：

- `node --test test/praxis/*.test.js`：**162 tests / 162 pass / 0 fail / 0 skip**（含新增 team 7、branch 10、wire-v4 5）
- `node --test test/praxis/acceptance/cockpit.test.js`：**1 pass / 0 fail**
- 证据：`node tools/evidence/capture.mjs --v4` → `docs/praxis/screenshots/v4/` 10 张、`docs/praxis/evidence/manifest-v4.json`（`ok=true`，buildHash、sha256、sceneMetrics）
- 已知实现偏差：运行条仍显示 `3/10`（brief §4.1 写 `n/12`）；catalog 仍为 10 阶段。测试只断言阶段计数存在，偏差上报 Lead。
- 旧 `acceptance/browser.test.js` 是 v3 节点画布验收，v4 下 5 条红（节点/画布已删除），待 Lead 确认后退役或改写；新驾驶舱验收以 `cockpit.test.js` 为准。

## 约定

- 测试只读实现，不修改 `src/*`；失败清单按 `文件:用例:期望 vs 实际` 交回 Lead/实现方。
- 不写 `test.skip`/`test.todo`；未实现的行为必须表现为失败而不是跳过。
- 新增测试须先并入契约（Lead 升版本），避免测试自行发明接口。
