# Praxis 开发编队与实施计划

> 版本：2026-11-04。状态：待 Lead 与用户确认后进入 Phase 0。
> 依据：`docs/PLUGIN-DEV-LESSONS.md`、`cordis-plugin-development` 技能参考、`docs/rsi-engine-plugin-design.md`。
> 一句话：**先把证据基座和接口契约建起来，再让多代理并行写；每条“完成”都必须有一个会变红的观测点。**

---

## 0. 从教训到本项目硬约束

| 教训 | 本项目硬约束 |
|---|---|
| R1 行为以源码为准 | 平台行为规格必须带 `文件:行号`；所有“DSH 会怎样”先写探针再写实现 |
| R2 每个判定有会变红的测试 | 每个 gate、状态转移、幂等、恢复、权限判定都有对应测试；无测试=未完成 |
| R3 装好≠生效 | “上线”必须同时有：`Config.listConfigs.status=active`、`Slots.listSubTree` occupant、API 被请求、截图 |
| R4 平台能力先探测 | 客户端装配、HMR、remote 命令、projection wire、storageDomain 并发、安装审批，全部先 10 行探针 |
| R5 失败一次换证据层 | 连续两次同层失败 → 换源码/进程内探针/端点/日志，禁止继续猜 |
| 可视化 5 次返工 | 先建立“目标可见”的代理：slot occupant + 数据端点 + 截图；不把“代码看起来对”当显示 |
| 多代理写冲突 | 一人一个目录；任务卡写 write scope；契约变更必须广播并升版本 |
| 审计被作者描述污染 | 审计方自写脚本、只信代码与运行结果；结论附复现命令 |
| 文档先行宣称 | 只写已验证内容；未验证单列“Unverified”，不写“已完成” |

补充本会话环境事实：

- 文件策略：`danger-full-access`；审批提示被禁用，需要审批的动作会**自动失败**。因此安装/启用必须在 Phase 0 用探针确认 `plugin_manager` 是否仍可用；不可用则切 `dsh plugin` 的受支持路径并记录失败原文。
- 截图：按用户明确要求执行；使用本机无头 Chrome + 独立临时 `--user-data-dir`，只访问 `http://127.0.0.1:3080`，不读取/复制个人浏览器数据、cookie、密钥；截图只用于验证与交付。
- 客户端半包存在“非 client 包”负判定缓存；任何“从无到有”的 client half 变更后要重启 Harness 再判定。

---

## 1. 编队 v1（Lead + 6）

上限内规划，先只读侦察，后写实现，最后独立审计。成员可以复用（inactive 后再派任务），不按“一次性”设计。

| 角色 | 类型 | 写作用域（相对 `plugins/dsh-praxis/` 或 `docs/praxis/`） | 交付物 | 不做什么 |
|---|---|---|---|---|
| `lead`（我） | 集成/验收 | `index.js`、`package.json`、`cordis.patch.yml`、`src/runtime.js`、`src/loader.js`、`src/surface/**`、`locale/**`、`docs/praxis/**` | 契约冻结、集成、安装、截图、最终报告 | 不替成员写其作用域内的业务实现 |
| `platform-scout` | 只读侦察 | `docs/praxis/recon/platform.md` | DSH 装配/客户端/HMR/remote/projection/domain 并发/安装的一次性探针与带行号规格 | 不改代码 |
| `superagent-analyst` | 只读侦察 | `docs/praxis/recon/superagent.md` | 事件逻辑、panel/route/prompt/worker/审批模式的可复用与必须替换清单（文件:行号） | 不复制其 SQLite/验收/权限缺陷 |
| `design-scout` | 只读+样式规格 | `docs/praxis/recon/design.md`、`src/client/styles/**`（Phase 2 起） | Observatory 设计语言：token 映射、字号/间距/栅格、组件清单、host 原生控件复刻来源 | 不 import Harness client 包 |
| `host-core` | 写 | `src/core/**` | domain、store、contracts、receipt、resolver、recovery、单写者 | 不写 UI/tools |
| `host-planes` | 写 | `src/planes/**` | playbook 运行时、research/evolution/eval/memory、认知地图、野心/人格评分 | 不改 core 接口，不写 surface |
| `client-builder` | 写 | `src/client/**`、`client.js`（构建产物）、`src/client/styles/**` | 页面组件、slot 注册、数据 hook、截图用稳定测试点 | 不写 Host、不折叠日志 |
| `verifier` | 只读+测试 | `test/**`、`docs/praxis/verification/**` | 契约测试、假实验矩阵、截图脚本、对抗测试 | 不修实现；只交失败清单 |
| `auditor`（Phase 4 复用 verifier 或新开） | 只读 | `docs/praxis/audit-*.md` | 独立审计：自写脚本、不采信描述 | 不改代码 |

> 注：成员数为 6 时先开 `platform-scout`、`superagent-analyst`、`design-scout`（只读，可并行）；契约冻结后再开 `host-core`、`host-planes`、`client-builder`/`verifier`。`auditor` 复用 inactive 成员。

---

## 2. 契约先行：Phase 1 必须冻结的文件

`docs/praxis/impl-contract.md` 是唯一接口真相。任何人不得在未升版本的情况下改导出面、字段名、HTTP 路由、slot id、测试契约。

必须包含：

1. **包与装配**：包名 `@local/dsh-praxis`；`package.json`（exports/files/dsh.bundle/dsh.client）；`cordis.patch.yml` 行 id；5 个 preset 行 id；宿主依赖 inject 列表。
2. **Domain**：`praxis` domain 的 tables/global schema、key 规则、`schemaVersion`、迁移策略、单写者粒度。
3. **对象**：`ResearchRun`、`PlaybookRun`、`Stage`、`QuestionNode`、`CognitiveMap`、`MapNode/MapEdge`、`PreRegistration`、`Discussion`、`PositionPackage`、`ExperimentAttempt`、`EvalReport`、`MemoryProposal`、`DecisionRecord`、`CandidatePatch`、`ArchiveNode`、`RsiCommand/RsiReceipt`。
4. **Playbook DSL**：YAML 结构（meta/stages/gates/roles/artifacts/metrics/budgets/views）；字段类型、必填、默认值、schedule、失败语义；版本字段；校验器规则；示例（research-discovery、engineering-validation、audit-redteam、knowledge-production 各一份）。
5. **状态机**：ResearchRun / PlaybookRun / Attempt / Job / Lease / Campaign；合法转移表 + 拒绝码枚举。
6. **Tools**：`praxis_*` 名称、参数 schema、返回结构、readOnly 标记、approval 标记、失败码。
7. **Commands**：用户命令名、输入、返回、UI 调用方式（remote command 或自有 route，Phase 0 定）。
8. **API**：Host↔Client 协议（route 路径/方法/JSON 信封/错误码/鉴权头/loopback 校验）；快照 envelope 与 invalidation。
9. **Projection**：key、view 字段、`stateVersion`、`wire.view` 形状、冷恢复语义。
10. **UI**：slot id/key、页面列表、read model key、每页状态（loading/reconnecting/stale/conflict/quarantined/read-only）、设计 token 映射、断点、键盘行为。
11. **超参 schema**：引擎旋钮 + 实验/训练超参；默认值、范围、冻结规则、UI 分组、变更=新 Run。
12. **证据协议**：截图命名/目录/断言；slot occupant 断言；API 被请求断言；日志断言；未验证清单格式。

契约冻结的验收：`impl-contract.md` 中每条接口都有对应测试文件路径（可先空断言）。

---

## 3. 阶段与门

### Phase 0：只读取证（并行，1–2 小时）

- `platform-scout`：跑 10 行探针，确认：
  - bundle 安装/启用的真实路径（`plugin_manager` 是否可用；`Config.listConfigs` 状态；HMR 是否生效）。
  - client half 装配条件：`dsh.client` 字段、`window.__ModuleLoader__.load`、`Slots.listSubTree` occupant、缓存/重启语义。
  - Host↔Client 通道：remote command vs 自有 web route 的可用性、鉴权、header、loopback 限制。
  - `storageDomain` 并发语义、`KvTable.update` 行为、`domain/changed` 时序。
  - `sessionProjections` 的注册/类型扩展/冷恢复。
  - `agentPresets` 注册、`presets` 行、live Agent pin。
- `superagent-analyst`：提取其 Engine/Trigger→Eval→Mandate→Ticket→Assignment 事件逻辑、panel 三问、route 类型化、worker Session、审批；标注哪些能用、哪些必须换。
- `design-scout`：从已安装 Host 页面提取可复刻的控件 mark-up/CSS/交互（Plugin Manager 列表、设置区、会话头部），产出 Observatory 组件清单与 token 用法；不做截图（Phase 3 才截图）。

Phase 0 出口：三份 recon 文档，每条结论带 `文件:行号` 或探针输出原文；未验证项单列。

### Phase 1：契约冻结（Lead，0.5–1 小时）

- 写 `docs/praxis/impl-contract.md`；
- 写 `docs/praxis/design-language.md`（Observatory：颜色/字阶/间距/栅格/状态/组件）；
- 写 `docs/praxis/playbook-dsl.md` + 4 个示例 playbook；
- 建空骨架包（`package.json`、patch、`index.js` 占位、locale、icon），只保证可安装/可卸载，不实现业务。

Phase 1 出口：契约评审通过；骨架可安装、`Config.listConfigs` 可见、可卸载干净。

### Phase 2：Host 核心 + 客户端骨架（并行）

- `host-core`：domain/store/contracts/receipt/resolver/recovery + 单测。
- `host-planes`：playbook 运行时 + research/evolution/eval/memory + 认知地图 + 野心/人格评分（依赖 core 接口）。
- `client-builder`：main 面板 + sidebar + composer dock + settings 的骨架；一个真实数据端点；locale；设计 token。
- Lead：`runtime.js`、tools/commands/route、prompt section、安装验证。
- `verifier`：按契约写会变红的测试（先失败）。

Phase 2 出口：工具能创建 Run/冻结 prereg/拒绝非法转移；UI 出现 occupant；API 被轮询；单测绿。

### Phase 3：页面与设计语言（1–2 小时）

- Run List、Control Tower（supervisor 前台）、Cognitive Map、Pre-reg、Discussion、Experiment、Lineage、Eval、Memory/Decision、Audit、Settings。
- 每页：空/加载/错误/stale/冲突/只读六态；键盘可达；亮暗主题。
- 截图：每页至少一张 + 关键交互两张；对照 host 页面检查字阶/间距。

Phase 3 出口：截图经自检通过（不是“我觉得好看”，而是对照断点/字阶/token/状态齐全）；`Slots.listSubTree` 有 occupant。

### Phase 4：假实验全流程 + 对抗测试

- 18 条假实验（见设计文档 §12）逐条跑通；每条有失败码与审计记录。
- 崩溃/重复/并发/恢复：杀进程、重复命令、lease 过期、domain 版本冲突。
- `verifier` 交失败清单；实现方修；`auditor` 独立复核。

Phase 4 出口：测试全绿且无 skip；无未解释 `unknown`；审计报告 P1=0。

### Phase 5：上线与验收

- 安装 bundle（`plugin_manager` 或受支持路径）、启用、重启（如需）、`Config.listConfigs` active。
- GUI 侧栏出现 Praxis；打开 Control Tower；截图。
- 用假数据跑一遍“新建 Run → 冻结 → 讨论（mock）→ 实验（mock）→ eval（mock）→ 决策”，截图存档。
- 交付：截图、测试报告、README（只写已验证）、未验证清单。

---

## 4. 证据协议（每层可观测代理）

| 目标 | 代理 | 判定 |
|---|---|---|
| Client 模块已装载 | `Slots.listSubTree` occupants 含 `praxis` 且 active | 缺 id=装配问题，不是样式问题 |
| 组件真的渲染 | Host 路由被轮询（计数/日志），返回非空 | 有轮询=挂载；无轮询=没进 slot |
| 数据正确 | API JSON 与 domain 行一致（抽样） | 不一致=读模型 bug |
| 视觉正确 | 截图（亮/暗、1440/1024、空/满） | 缺状态=未验证 |
| Host 已激活 | `Config.listConfigs.status` + `packageDir` | inactive 读 import 错误 |
| 生效的是哪份代码 | `readlink -f node_modules/@local/dsh-praxis` | 指向本地=link 安装，需区分 |
| 行为符合契约 | 会变红的测试 | 无测试=未完成 |
| 安装/启用成功 | 上述全部 + 用户可见 | 只有 applied=未生效 |

截图协议：

```text
docs/praxis/screenshots/<phase>/<page>-<theme>-<width>-<state>.png
附 docs/praxis/screenshots/<phase>/index.md：每张图对应断言（occupant/API/状态）
```

未验证写法：不写“可能没生效”，写“occupants 无 praxis，故渲染未验证”。

---

## 5. 协作规则

1. **任务卡**：每个任务写 subject/description/write scope/依赖/验收；成员先 `team_task_get` 再 claim。
2. **契约变更**：Lead 升版本并在所有进行中任务里广播；成员不得自行改字段名/路由/slot id。
3. **交接格式**：`改了什么`/`证据（命令输出/行号/截图）`/`未验证`/`需要谁`；不写励志总结。
4. **写冲突**：一人一目录；`src/client/styles/**` 归 `client-builder`，`design-scout` 只出规格不写实现（Phase 2 后合并）。
5. **审计独立**：auditor 不看作者结论，自写脚本；发现 P1 直接进 Lead 修复队列并加回归测试。
6. **不确定就停**：接口/平台行为不确定时，先探针，不猜；猜了要标 `assumption` 并安排验证。
7. **上下文卫生**：侦察报告 ≤400 行、带行号；实现文件加注释说明“为什么”，不复制大段上游。

---

## 6. 设计增量（用户 2026-11-04 反馈）

用户明确：插件面向**通用科研场景**，BENGI 等是历史残留；核心要求是**创新能力**与**维护认知地图**；当前 AI 的失败模式是“未知恐惧症”——面对未知焦虑，导致创新均值回归。设计必须正面处理，而不是加一句“要创新”。

### 6.1 认知地图（Cognitive Map）一等对象

```ts
interface MapNode {
  id: string; kind: 'object'|'mechanism'|'representation'|'dataset'|'metric'|'hypothesis'|'method'|'anomaly'|'unknown';
  label: string; claim?: string; confidence: number; status: 'known'|'contested'|'unknown'|'deprecated';
  evidenceRefs: string[]; runRefs: string[]; createdAt: string; updatedAt: string;
}
interface MapEdge {
  id: string; from: string; to: string;
  kind: 'supports'|'contradicts'|'derives'|'measures'|'analogous'|'depends'|'frontier';
  confidence: number; evidenceRefs: string[];
}
interface CognitiveMap {
  projectId: string; version: number;
  nodes: MapNode[]; edges: MapEdge[];
  frontier: { nodeId: string; whyUnknown: string; testableNext: string }[];  // 已知的未知
  blindSpots: { area: string; whySuspected: string }[];                     // 未知的未知候选
  updatedBy: string; updatedAt: string; contentHash: string;
}
```

规则：

- 每个 Run 结束必须提交 map delta：新增/修正/否定节点与边，或明确“无变化及原因”。
- 讨论前必须读 frontier；实验问题必须能映射到节点/边。
- map 变更走 proposal → 独立 review → commit；主代理不能单方面改写已确认节点。
- UI 提供地图视图 + frontier 列表 + “本次 Run 改变了什么” diff。

### 6.2 反未知恐惧 / 反均值回归机制

1. **探索预算**：每个 Playbook 强制 `explorationQuota`（默认 20% 时间/实验臂）用于 frontier/盲区，不允许全部用于已知路径。
2. **未知登记**：遇到未知必须登记为 `unknown` 节点 + `testableNext`，不得用“数据不好/不可行”直接收尾。
3. **均值回归检测**：
   - 提案与历史提案/已知方法做语义距离（map 距离 + 文本嵌入/词面 + 引用集）；
   - 新提案若落在历史分布中心且不产生新节点/边 → `mean_reversion.suspect`；
   - 连续 N 轮无新节点/新边 → 触发 pivot/新问题，而不是继续跑。
4. **焦虑信号**（行为锚）：过早收尾、要求保证后再探索、把未知写成风险免责声明、只选熟悉方法、缩窄对象、反复调参代替新假设。检测到 → 强制 reflection + 探索任务。
5. **创新双轴评估**：`novelty`（距 map 的距离/新关系/跨域迁移）与 `rigor`（可证伪/对照/证据）分开报告，不允许单轴高分掩盖另一轴。
6. **保护性组合**：保留“离群问题”组合（低概率高信息），不被平均分选择器淘汰；session 级多样性下限。
7. **未知不是失败**：`unknown` 可以作为合法 Run 结论，但必须带 `testableNext` 与成本估计；引擎奖励“提出更好的未知”，不奖励“假装知道”。

### 6.3 Playbook DSL（声明式 + hook）

```yaml
id: research-discovery
version: 1
name: 通用科研发现
stages: [intake, question, prereg, discussion, experiment, review, stage4, eval, memory, decision]
roles: [root, swarm, coding, reviewer, evaluator, memory, auditor]
gates:
  - id: prereg.frozen
    before: experiment
    require: [prediction, acceptance, controls, inputManifest, metrics]
  - id: real-data
    before: experiment
    require: [dataBoundary.verified]
artifacts:
  experiment: [manifest, result, artifactManifest]
metrics:
  novelty: { kind: map-distance, weight: 0.4 }
  rigor:   { kind: prereg-consistency, weight: 0.6 }
budgets: { tokens: 2_000_000, wallMinutes: 240, explorationQuota: 0.2 }
hooks:
  evaluator: ./hooks/research-evaluator.js
  dataBoundary: ./hooks/q19-data-boundary.js   # 可选，非 Q19 时替换
```

引擎只认 DSL 字段，不写死 Q19；Q19 只是一个 playbook + hook。

### 6.4 超参系统

- 三层：`engine defaults` → `profile settings`（Settings 页）→ `playbook defaults` → `Run pin`（冻结）。
- 改任何被 pin 的参数 = 新 Run；Attempt 级只允许标 `safeOverride` 的参数，并必须写 reason。
- UI：Settings 页分组（预算/循环/统计/野心/评估/探索/数据），每项显示默认值、范围、当前值、影响说明、是否 pin。
- 预设档：`Strict`（默认）/`Balanced`/`Fast`；档位只改一组值，不隐藏单项。
- 反反复调参：同一 Run 内参数不可变；跨 Run 变更必须记录 diff 与理由；连续两次因参数失败 → 触发参数审查，不是继续扫。

---

## 7. 风险与预案

| 风险 | 概率 | 预案 |
|---|---|---|
| `plugin_manager` 因审批禁用不可用 | 中 | Phase 0 探针；失败则记录原文，改用 `dsh plugin add` + 手工 bundle 选择，仍以 `Config.listConfigs` + slot 为证据 |
| Client 负判定缓存导致“看不见” | 高 | 每次从无到有加 client half 后重启；用 occupant 代理判定，不靠“应该显示” |
| HMR 不加载新 client 代码 | 高 | 以安装/重启后的 occupant + 截图为准；不以 `applied` 为准 |
| 无浏览器控制/截图受限 | 中 | 用户已要求截图；用独立临时 profile 的无头 Chrome；失败则明确报“未验证”并给 slot/API 证据 |
| 多代理写冲突 | 中 | 目录级 write scope + 契约冻结 + Lead 集成 |
| 契约漂移 | 中 | 变更广播 + 版本号 + 测试锁 |
| 端口/路由与官方冲突 | 低 | 路由前缀 `/praxis/api`，loopback+header 校验，不替换官方 |
| 状态机/幂等实现复杂导致延期 | 中 | Phase 2 先垂直切片（一个 Run 的完整闭环），再铺页面；不横向先做全表 |
| 未知恐惧机制变成口号 | 高 | 把它做成 gate（探索预算/未知登记/均值回归检测），不是提示词；测试锁住 |
| 认知地图变成大图难用 | 中 | 先做 frontier 列表 + 局部图 + diff；大图后置；必须有表格替代 |

---

## 8. 用户接口与汇报节奏

每个 Phase 结束汇报四件事：

1. 已验证（命令/行号/截图路径）；
2. 未验证（具体代理缺失）；
3. 风险与阻塞（需要用户决策的）；
4. 下一步。

不汇报“进展顺利”“基本完成”。不把安装成功写成上线成功。截图先给 Control Tower + Pre-reg + Cognitive Map 三张，确认设计语言后再铺全页。

---

## 9. 立即要做的（Phase 0 启动条件）

- 用户确认编队与阶段（或指定只先做其中两项侦察）。
- Lead 建任务卡、冻结写作用域、发三个只读侦察任务。
- 侦察期间 Lead 自己写 `impl-contract.md` 骨架与 `design-language.md` 初稿，不写业务代码。

> 当前状态：计划已就绪，未启动实现；`plugins/dsh-praxis/` 尚不存在，profile 未改动。
