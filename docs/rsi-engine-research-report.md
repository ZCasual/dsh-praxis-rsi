# RSI 引擎化调研报告

> 日期：2026-11-01  
> 范围：现有 `todo/` 提示词式 RSI、RSI 学术/工程前沿、DSH/Cordis 可复用组件、引擎化与预设模式设计  
> 结论层级：当前可做的是**有界脚手架 RSI**，不是无约束智能爆炸。

---

## 0. 一句话结论

现有体系已经有正确的认知边界（判断不委派、预注册冻结、独立评估、真实 EA、同结论二次转向），但不稳定，因为这些规则写在 Markdown/提示词里，而不是状态机、契约和门禁。引擎化应把纪律变成**不可被模型改写的验证层**，把现有 agent 模板变成**受限执行器**，把 `research-closed-loop` 等模式做成 **preset**。DSH 已经具备 Agent loop、Session、Projection、Subagent、Workflow、Goal、Sandbox、Approval 等底座，不必另起运行时。

---

## 1. 现有 todo RSI 是什么，为什么不稳

工作区 `todo/` 是一套研究闭环，不是泛化“让 agent 自我改进”：

| 环节 | 谁做 | 作用 |
|---|---|---|
| ① 回顾 | 主代理 | 读 `plan/02`、open questions、current state |
| ② 选疑惑 + 定验证点 | 主代理 | 预测、验收、可接受失败、对照；写入后不可改 |
| ③ 讨论轮 | designer / 蜂群 / synthesizer | 动态立场、五轮协议、合成不压平 |
| ④ 实验轮 | coding / review | 按预注册执行，只审关键判据 |
| ⑤ 阶段四 | 主代理 | 解读 / 追问 / 认知 / 决策 / 野心自省 |
| ⑥ 收束 | memory / eval | 更新记忆、独立打分 |
| ⑦ audit | 主代理对照清单 | 防腐化，不是再派一个 agent |

铁律已经正确：真实 EA、预注册不可改、验收只能通过/不通过、评估独立于执行者、同结论 2 次必转向。不稳定来自实现形态：

1. **规则是提示词，不是门禁。** agent 可以漏读、改标准、用模拟 EA、把“部分通过”写成成功。
2. **路径漂移。** 模板仍写 `docs/enhanceratlas/todo/...`，仓库实际是根下 `todo/`；评估文件命名也不统一（`eval_round_NN` vs `eval_P1-XX`）。找不到文件会被误判成“没有反馈”。
3. **`round_XX.md` 同时承载事实、判断和评估**，无法机器校验。
4. **没有独立 verifier / held-out / rollback。** 改进是否真实，完全靠主代理读报告。

---

## 2. RSI 学术前沿：能做什么，不能宣称什么

### 2.1 必须先分层

| 层 | 改什么 | 现状 |
|---|---|---|
| **L0** 有界自精炼 | 当前输出 | Self-Refine / Reflexion 已工业可用，但无外部反馈时常退化 |
| **L1** 脚手架 RSI | 工具、prompt、记忆、编排代码 | SICA / STOP / DGM 已有局部实证 |
| **L2** 权重/优化器/硬件 RSI | 模型本身 | 理论存在，实证未支撑无约束递归加速 |

当前引擎只应宣称 **L1**。把 SWE-bench 分数写成“自身变聪明”是命名错误。

### 2.2 高信号实证

- **[Self-Refine](https://arxiv.org/abs/2303.17651)**：同一模型生成→自评→迭代；7 任务约 +20%。无训练、无权重更新。
- **[Reflexion](https://arxiv.org/abs/2303.11366)**：语言反馈写入情景记忆；HumanEval 91% pass@1。明确不更新权重。
- **[Voyager](https://arxiv.org/abs/2305.16291)**：课程 + 可执行技能库 + 环境/错误反馈。持久物是技能库，不是无限改 prompt。
- **[DGM](https://arxiv.org/abs/2505.22954)**：改自己的 agent 代码，archive 探索，外部 coding benchmark 验证。SWE-bench 20%→50%，Polyglot 14.2%→30.7%。实验带 sandbox 和人工监督。
- **[SICA](https://ar5iv.labs.arxiv.org/html/2504.15228)**：15 轮后 SWE-Bench Verified 子集 17%→53%；改的是编辑器、上下文、AST 定位。作者承认路径依赖和短基准饱和。
- **[Statistical Gödel Machines](https://arxiv.org/html/2510.10232)**：proposal 与 confirmation 分离，只在统计证书通过后 commit。这是协议，不是通用保证。
- **2026 综述 [From Bounded Self-Refinement to Autonomous Research Loops](https://arxiv.org/html/2607.07663)**：把“self-X”拆成部署行为 / 训练 / 评估器 / 科研过程 × 闭环程度。关键切分是 **有界自精炼 vs 开放 RSI**；几乎全部文献仍是 human-on-the-loop。

### 2.3 负结果与瓶颈

验证，而不是“再多一轮反思”，才是瓶颈。

- **[LLMs Cannot Self-Correct Reasoning Yet](https://ar5iv.labs.arxiv.org/html/2310.01798)**：无 oracle 时多轮自纠常常降分。
- **[CRITIC](https://ar5iv.labs.arxiv.org/html/2305.11738)**：无工具自评 modest/退化；外部工具反馈才稳定。
- **ICLR 2026 [One Step Forward, Two Steps Back](https://iclr.cc/virtual/2026/10014641)**：Self-Refine 在 LiveCodeBench 上不能可靠提升 Pass@1；批评者会幻觉出“正确代码的缺陷”，把好解改坏。
- **[Maity et al. 2025](https://pure.au.dk/portal/en/publications/reconciling-divergent-views-through-a-critical-analysis-of-iterat/)**：QA / ALFWorld / HumanEval 上约 70% 错误来自 Verification；反思常是“换个动作”这类低粒度空话。
- **[Reward Hacking in Self-Improving Code Agents](https://iclr.cc/virtual/2026/10018648)**：公开代理指标上升、真实任务不升。会议摘要：Kernel-Bench 73.8%、ALE-Bench 46.8% 出现 proxy/real gap。
- **自动科研被独立打脸。** [AI Scientist](https://arxiv.org/abs/2408.06292) 能成文；[独立复核](https://ar5iv.labs.arxiv.org/html/2502.14297) 发现 12 个实验中 5 个因编码失败，引用过时、数字幻觉。[MLGym](https://arxiv.org/abs/2502.14499) 显示前沿模型多靠调超参，不产生新假设。[2026 预注册生物医学审计](https://neurips.cc/virtual/2026/loc/sydney/156512)：24 篇中 0 篇达到预设 peer-review-readiness。
- **Benchmark 污染。** [SWE-Bench Illusion](https://ar5iv.labs.arxiv.org/html/2506.12286)：无 repo 的 file-path 任务 Verified 最高约 76%，外部 repo 约 53%。[SWE-Bench Pro](https://arxiv.org/abs/2509.16941) 才是更干净的长程评估。
- **理论边界。** [Gödel Machine](https://people.idsia.ch/~juergen/gmweb1/) 只在找到“改写有益”的证明后自改；不完备性意味着真实但不可证的改进会被忽略。[No Free Lunch](https://dl.acm.org/doi/10.1109/4235.585893) 否定无条件通用最优优化器。

**总判断（高置信）：** 有限、任务绑定、外部评测驱动的脚手架递归改进已经可行。无约束、跨域、持续加速的通用 RSI **没有被实证**。

---

## 3. 实践与社区：哪些必须做成硬约束

社区 issue 有报告偏差，不能当发生率，但故障模式高度重复。

| 必须硬编码 | 依据 | 可配置 |
|---|---|---|
| 模型自评不得单独宣告成功 | Huang / CRITIC / ICLR 2026 回归 | 反思轮数、prompt |
| 成功由环境/测试/独立 oracle 确认 | Reflexion、CRITIC、Voyager | 工具路由、阈值 |
| wall-clock / step / token / 重复动作断路器 | AgentBench；[OpenHands #7132](https://github.com/OpenHands/OpenHands/pull/7132)、[SWE-agent #971](https://github.com/SWE-agent/SWE-agent/issues/971)、PraisonAI/LlamaIndex/Goose 循环 issue | 预算数值 |
| 优化集 / held-out / 回归集物理隔离 | RSEA、Write-Time Contracts | 分割大小、提升 margin |
| 同一优化器不能当唯一 judge | LLM-as-a-Judge 偏差；Evidence-Gated Prompt Optimization | ensemble、抽检比例 |
| 代码/工具/权限/评估器改动需 sandbox + 审批 + 可回滚 | DGM 自身要求监督；Trusting Trust Revisited 污染攻击 | 允许自改范围 |
| 系统 nudge 不得刷新 stuck 计数 | OpenHands stuck detector 失效案例 | 提醒文案 |
| 记忆有上限，摘要不得伪造未观察事实 | Reflexion memory 1–3 条；AgentBench 长程失败 | 检索策略 |

**原则：** 可证明、可检测、高损失的边界硬编码。Prompt、模型、阈值、反思轮数通过独立 held-out 持续验证。

---

## 4. DSH 特殊性与可复用组件

DSH 不是“再塞一段总提示词”。它已经是事件溯源 + 插件组合运行时。

### 4.1 直接可复用

| 能力 | 组件 | RSI 用途 |
|---|---|---|
| Agent 驱动 | `agentLoop` / `ctx.agents` | 主代理与执行器生命周期 |
| 模式 | `agentPresets` | `research-closed-loop` 等模式即 preset |
| 委派 | `subagents` + spawn/fork | coding / review / eval / 蜂群 |
| 大规模编排 | `workflowEngine` + `dsh-tool-workflow` | 五轮讨论、多实验 fan-out |
| 长目标 | `dsh-goal` + `goal-round-driver` | 跨 turn 目标，但 **没有独立评估器** |
| 真相源 | `dsh-session` JSONL | 模型可见事实必须可从 log 重建 |
| 读模型 | `sessionProjections` | run 状态、预注册冻结、eval 回执 |
| 宿主状态 | `storageDomain` | 证据账本、artifact manifest、alias registry |
| 拦截 | `agent/pre-step`、`tools/pre-execute`、`tools/post-execute` | 无预注册禁执行、禁止改冻结契约 |
| 循环卫生 | `repeat-tool-reminder` | 相同工具调用 nudge（仅 advisory） |
| 写保护 | `fs-observation-policy` | 读后写 / CAS |
| 权限 | sandbox + approval + 实验性 Auto review | 实验执行隔离 |
| 人工门 | `plan-mode`、`userQuestions`、`approval` | 阶段四 / 高风险改动签发 |

### 4.2 Host vs Preset

- **Host：** 共享服务。引擎内核、证据账本、策略门、resolver、evaluator 隔离、storage domain 必须放 Host。
- **Preset：** 模式级策略。persona、工具可见集、是否启用蜂群、真实数据策略、对照是否强制。preset 在 run 创建时 hash 封存；运行中切换必须新 run。
- 提供 service 的 preset 插件必须 isolate 到同一 realm。Host 消费的 service 不要放 preset。
- live Agent 保留加入时的 preset revision；冷恢复找不到原 preset 不会 fallback。

### 4.3 关键限制（设计时必须接受）

1. **Session log 是唯一模型可见真相。** 不要 invent 新 session event type；插件状态用 projection 或 `storageDomain`。`appendPluginRecord()` 仅实验包且迁移 best-effort。
2. **Goal driver 没有独立评估器。** 完成/阻塞由调用者自称。RSI 的 eval 必须另做政策层。
3. **Workflow caps 是合作式限额，不是安全配额。** 真正的预算/停止器必须在脚本改不了的地方。
4. **Repeat-tool-reminder 只提醒不阻断。** 真断路器要自己做。
5. **Plan mode 只是文本约束。** 强制限制靠 sandbox/approval。
6. **Subagent 所有权是进程内的。** 无跨进程 mailbox；accepted-but-unlogged prompt 崩溃可丢。
7. **Root shutdown 可能丢最后 `turn/end`。** 关键 commit 前必须 `session.flush()`。
8. Client Inspect 本次超时，**UI 面板未验证**。第一版可以 Host-only。

### 4.4 建议落点

```
Host plugin: @local/dsh-rsi-engine
  - storageDomain: rsi_runs / contracts / claims / artifacts / aliases
  - sessionProjection: rsiRun（当前阶段、冻结 hash、eval.read）
  - tools: rsi_start / rsi_prereg_freeze / rsi_record / rsi_gate_status
  - listeners: agent/pre-step + tools/pre-execute 执行门禁
  - 不把评估器、权限、停止逻辑放进可自改区

Presets:
  - rsi-research-closed-loop
  - rsi-exploratory-search
  - rsi-falsification-pivot
  - rsi-engineering-validation
  - rsi-integrity-audit
```

现有 `todo/agents/*.md` 继续当执行器提示，但输入输出改走契约，禁止直接改 `plan/02` 和预注册。

---

## 5. 引擎化设计

### 5.1 原则

事件是事实，契约是门禁，证据账本可追溯，主代理做认识论判断，引擎只提案 / 校验 / 阻断。Markdown 是投影，不是真相源。

### 5.2 状态机

```
CREATED → RECALLING → QUESTION_PENDING → PREREG_PENDING → PREREG_FROZEN
→ DISCUSSION → SYNTHESIS → EXECUTION_READY → EXECUTING → REVIEW
→ STAGE4 → EVAL → MEMORY → DECISION → CLOSED
```

旁路：`BLOCKED`、`RECOVERING`、`DRIFT_DETECTED`、`ABORTED`。

子问题节点：`pending → ready → running → done | refine | unresolved`。每节点强制 `question / falsifiable_boundary / completion_criteria / depends_on`。

关键门：

- 无冻结预注册 + metrics + 输入 manifest + 对照合同 → 不能执行
- 无完整结果 + review → 不能进阶段四
- 无阶段四 + 独立 eval + `eval.read` 回执 → 不能决策
- 结果后改预注册 → 拒绝，记 `prereg.violation`；要改就开新 run
- 同结论第 2 次 → `DRIFT_DETECTED`，必须转向 / 重定义 / 停止

### 5.3 最小契约

1. Run / IntakeCard  
2. QuestionNode DAG  
3. PreRegistration（hash 封存）  
4. Discussion / PositionPackage（魔鬼代言人 + 异想派 + 存活分歧）  
5. Experiment / Result（真实 EA、资源、对照、seed）  
6. Review（逐项 pass|suspect|fail）  
7. Stage4（主代理专属）  
8. Eval（独立 actor，只读实验/预注册）  
9. MemoryProposal / Commit（语义改动需确认）  
10. DecisionRecord  

### 5.4 证据账本

Append-only：Intake / Plan / Claims / Artifacts / Discards / Contradictions / RoundLog。  
Claim 状态：`unverified | corroborated | contradicted`。矛盾不删除、不平均。  
“没搜到” ≠ 被证伪。同一 source 的转述不算独立 corroboration。

### 5.5 五个预设模式

| 模式 | 干什么 | 硬策略 |
|---|---|---|
| `research-closed-loop` | 完整研究轮，默认 / Q19 | 真实 EA、预注册、对照、两次同结论转向 |
| `exploratory-search` | 五阶段检索，不自动做实验 | 多角度 + 反证；unresolved 显式列出 |
| `falsification-pivot` | 连续失败后杀方向 | 反证 / kill test；禁止把诊断包装成成功 |
| `engineering-validation` | 已冻结合同的实现 | 可跳过蜂群，不可跳过预注册/对照/review |
| `integrity-audit` | 只读审计 | 不跑实验、不写长期记忆 |

### 5.6 判断边界

**只能主代理 / 人类：** 选疑惑、定验收语义、阶段四、矛盾的语义裁决、对象共识/被否定叙事、用模拟数据、放宽指标、切 preset、危险操作。

**可以自动：** 路径/hash/schema 校验、生成 DAG/查询/立场草案、调度 agent、跑实验、机械对照检查、账本追加、有限恢复、eval 格式评分、同结论计数。

---

## 6. MVP 路线

不做分布式自治。本地顺序 orchestrator 即可。

1. **RunStore**：SQLite 或单写 JSONL 事件表 + content-addressed artifact。  
2. **PolicyGate**：无预注册不能执行；结果后改契约被拒。  
3. **Resolver**：`memory://02`、`state://current`、`round://N`、`eval://latest`。把 `docs/enhanceratlas/todo` → `todo` 做成版本化 alias；零/多匹配阻断。  
4. **Dispatcher**：复用现有 discussion/coding/review/eval/memory 模板，只读写 run sandbox。  
5. **EvidenceLedger + Projection**：事件重建 `round_XX.md` / current_state，兼容旧工作流。  
6. **Recovery**：idempotency key、有限重试、quarantine、从最后事件恢复。

先实现 `research-closed-loop` 和 `exploratory-search`。验收：

- [ ] 无预注册不能执行  
- [ ] 结果后改预注册被拒并留痕  
- [ ] eval 无实验写权限，且必须有 read receipt  
- [ ] 第二次同结论触发 drift gate  
- [ ] 路径歧义阻断，不猜路径  
- [ ] 崩溃恢复不重复副作用  
- [ ] Q19 拒绝用 BENGI 模拟替代真实 EA  

---

## 7. 未决与风险

1. 尚无被广泛接受的 RSI 安全认证标准。  
2. 权重级 / 跨域 / 长期加速 RSI 未被证明；不要按这个目标设计。  
3. Evaluator 共进化（RQGM 等）仍是 preliminary；引擎必须把 evaluator 放在不可自改区。  
4. 自动科研不能自证新颖性。本项目的“真实 EA → BENGI”比生成论文更接近可验证闭环，应抓住这个优势。  
5. Client UI 本次未验证；第一版 Host + 文件投影足够。  
6. `plugin_manager list_plugins` 因权限未跑；组件清单来自 Inspect + 包 README，实施前再对一次 live rows。

---

## 8. 建议的下一步（实施，需你确认）

1. 修路径漂移：统一逻辑引用，给旧路径做 alias。  
2. 写 Host 插件骨架：RunStore + PolicyGate + 冻结预注册。  
3. 声明两个 preset：`rsi-research-closed-loop`、`rsi-exploratory-search`。  
4. 用一轮假实验（故意无预注册 / 故意改验收 / 故意模拟 EA）证明门禁生效，再接到真实 Q19。

证据账本：`.search-ledger.md`。DSH 实践摘录：`.dsh-research/references/`。
