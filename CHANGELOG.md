# Changelog

## 0.2.0 — 2026-11-05

Praxis v3：工作台重做，真值模型与 wire 契约升级，验收进入可复现证据阶段。

### 领域真值

- 新增 `question` 动作与 `QUESTION` 状态；`STATE_ORDER` 成为唯一状态来源。
- 非法状态转移统一 `INVALID_TRANSITION`，不改 state/version，写 `transition.denied`。
- 节点状态拆成双轴：`execution`（状态游标 + receipt 决定）与 `condition`（产物决定）。
  修复 `INTAKE` 阶段下游门假 `DONE` 的倒挂。
- 图不变量 I1–I6 审计；`audit.ok=false` 时界面阻断推进。
- fork 纯净：`set_knobs` 清空 `preregHash`，父契约转为继承草稿，子 Run 必须重新冻结。
- 旧数据 `load` 迁移：脏 fork 记录与 v1 布局自动对账，幂等。
- 显式角色委托：`eval_report`（evaluator）与 `memory_propose`（root）可由用户显式委托提交，
  写 `actor.delegated` 审计事件；不带委托一律 `FORBIDDEN_ACTOR`。

### 图与 wire

- 布局 v2：三条语义泳道（5/5/5），节点 156×64，`layoutVersion: 2`，自动迁移 v1 图。
- 保护节点（`PROTECTED_NODE`/V10）、端口推导（gate→contract、→gate evidence，V11）。
- 图 `revision` 每次保存递增；`POST /praxis/api/graph` 必须带 `expectedRevision`（428/409）。
- `wireVersion: 2`，`view.catalog` 是 UI 文案唯一来源。
- `/evidence` 暴露运行、事件、receipt 与图审计。
- 命令响应：200 成功、409 `CONFLICT` 带当前 view、422 拒绝带 receipt/nextAction/blockers。

### 客户端

- 单条 60px 运行条；阶段 `n/10` 进度；全屏唯一主按钮（检查器只读时保留运行条主按钮）。
- 运行态只读；蓝图态显式进入，草稿 + diff + `expectedRevision` 保存，未保存离开需确认。
- 检查器按需滑出，选中节点永不被覆盖（宽屏水平避让，窄屏底部 sheet 上移 30%）。
- 节点中文名来自 catalog/graph，正文无内部码；状态用形状通道编码，去色可辨。
- 认知地图：真实 claim 状态配色，可登记主张与连线。
- 抽屉：源码、运行、地图、证据链、审计、旋钮，同一时刻只开一个。
- 共享 store 单例：一个轮询器、`expectedDomainVersion`、409 后进入 stale 态。
- 派生状态色 `color-mix(state, label)` 只用于图形；文字全部 label token（WCAG AA）。

### 验收

- 契约测试 140 条。
- 浏览器验收：亮色 7 pass + 1 skip（暗色独立实例），暗色 8 pass；真实 Chrome/CDP，零 npm 依赖。
- 证据 manifest：`ok=true`，25 张截图，`unexpectedMetricViolations=0`，逐对 WCAG（light 5.8/5.31，dark 5.55/9.47）。
- 未验证场景显式登记：error / stale / 14-nodes。
