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

## 当前状态（2026-11-04 09:42 CST，已验收）

```text
ℹ tests 70
ℹ pass 70
ℹ fail 0
ℹ skipped 0
ℹ todo 0
```

分组：engine 39、store 6、host 10、http 14、integration 1。
其中原 21 条（engine 18 + host 3）保持通过；新增 49 条契约测试。
连续两次运行结果一致（无随机/时间敏感断言）。

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

## 约定

- 测试只读实现，不修改 `src/*`；失败清单按 `文件:用例:期望 vs 实际` 交回 Lead/实现方。
- 不写 `test.skip`/`test.todo`；未实现的行为必须表现为失败而不是跳过。
- 新增测试须先并入契约（Lead 升版本），避免测试自行发明接口。
