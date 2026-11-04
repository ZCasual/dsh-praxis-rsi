# RSI 引擎系统级调研与设计蓝图

> 版本：2026-11-03（Asia/Shanghai）
> 定位：系统级规划，不是最小实现方案。

## 1. 结论

RSI 引擎不应是“让模型多反思几轮”的聊天插件，而应是一个受治理的递归改进操作系统：

- 维护科学闭环：目标、疑惑、预注册、实验、复核、独立评估、记忆、决策。
- 维护可演化 Harness：prompt、工具、工具指导、记忆、技能、子代理、脚本、插件、控制流、上下文和输出管道。
- 维护不可自改的治理层：评价器、数据切分、指标、权限、停止逻辑、审计、隐藏测试和人工授权。
- 维护候选的档案、谱系、证据和 fork/rollback，而不是只保留当前最高分。
- 把 DSH 页面作为观察、授权、解释和审计界面，而非装饰层。

当前目标是 L1：改工具、prompt、记忆、编排和实验闭环。不得宣称模型权重自身变聪明，也不得把 proxy/benchmark 分数升级成研究对象本身的进步。

## 2. RSI 层级

| 层级 | 改进对象 | 代表 | 当前态度 |
|---|---|---|---|
| L0 | 单次回答/反思文本 | Self-Refine | 不作为核心机制 |
| L1 | prompt、工具、记忆、技能、编排、上下文 | Harness²、RRSI | 当前主目标 |
| L2 | agent/scaffold 可执行代码 | DGM、SICA、STOP | 隔离后接入 |
| L3 | 改进器/元控制器本身 | DGM-H/HyperAgents | 远期研究 |
| L4 | evaluator、权限、停止器、训练管线 | 尚无可靠通用证明 | 不进入可自改区 |
| L5 | 模型权重/数据/训练目标 | Absolute Zero、R-Zero、Agent0 等旁支 | 不属于当前项目 |

严格 RSI 应定义为：系统修改自身实现，且修改后影响它未来修改自身的能力。按此定义，AlphaEvolve 主要是任务程序进化，Co-Scientist 是假设/评审递归，DGM 是代码级自改，DGM-H/Hyperagents 最接近元级 RSI；HGM 的贡献主要是改进自改树的长期生产力估计与节点选择，而不是让 evaluator 或全部外环可自改。

## 3. 完整对象图

所有持久对象带 `id/type/schema/contractVersion/createdAt/actor/parentHash/contentHash`；事件再带 `eventId/runId/seq/expectedStateVersion/evidenceRefs/idempotencyKey`。

### 3.1 部署与版本

`EngineInstallation`、`Bundle`、`LoaderEntry`、`HostPluginRevision`、`PresetDefinition`、`CompositionRevision`、`ClientArtifactRevision`、`UIWireVersion`、`CompatibilityRecord`。

必须区分 package/plugin、domain schema、contract、policy、preset、UI wire、数据、代码、模型和 evaluator 版本。创建 Run 时 pin；live Agent 不能静默切 preset revision。

### 3.2 运行与执行

`Project/Workspace`、DSH `Session`、RSI `Run`、`Stage`、`Attempt`、`Job`、`Lease`、`Agent`、`Principal/Actor`、`RunLineage`。

Session 不等于 Run；一个 Session 可操作多个 Run；子 agent 可拥有独立 Session。Run、Gate、Attempt、Job、UI connection 不共用一个 status 字段。

### 3.3 认知与研究

`IntakeCard`、`QuestionNode`、`QuestionDAG`、`Hypothesis`、`Claim`、`PositionPackage`、`Stage4Record`、`DecisionRecord`。探索模式可在 evidence synthesis 后结束；audit 是只读 sidecar，不虚构实验/Stage4。

### 3.4 预注册与讨论

`PreRegistration`、`MetricsContract`、`InputManifest`、`ControlContract`、`DiscussionDesign`、`DiscussionRound`、`Synthesis`。

InputManifest 必须包括真实 EA 身份、12 系、样本计数、score、`.pre_cache` hash、schema、split、transform、normalization、seed。冻结后契约不可改；结果后修改产生 `prereg.violation` 并开新 Run。

### 3.5 Harness 演化

基础组件采用 Harness² 的八类：system prompt、guardrails、memory、tool guidance、subagents、skills、scripts、plugins；另加 `controlFlow`、`contextManagement`、`outputPlumbing`、`clientSurface`。

对象：`HarnessRevision`、`HarnessComponentRevision`、`CandidatePatch`、`ProbeRun`、`EvolutionCampaign`、`ArchiveNode`、`Population`、`PromotionDecision`、`Rollback/ForkDecision`。

Candidate 必须是带 component 标签的原子 diff，包含父版本、修改假设、预期收益、成本变化和风险；禁止无结构的大文本覆盖。

### 3.6 执行与证据

`ExperimentTask`、`ExecutionAttempt`、`Process/Job/Lease/CancelToken`、`ArtifactManifest`、`Artifact`、`ExperimentResult`、`ReviewReport`、`Quarantine`、`RecoveryAttempt`。

必须保存 code/model/dependency/data/hardware/seed/command snapshot。大输出放 artifact store，事件只引用 manifest/hash。

### 3.7 评价

`EvalPlan`、`EvaluatorIdentity`、`EvalRun`、`EvalReport`、`EvalReadReceipt`、`AcceptanceDecision`。

区分 machine-observed、root-ack、human-ack；打开页面不等于读过。Evaluator 结构性隔离：不可改候选、预注册、权限、停止器、隐藏测试和长期记忆；同一 optimizer 不能唯一证明成功。

### 3.8 记忆与知识

`MemorySource`、`MemoryProposal`、`MemoryReview`、`MemoryCommit`、`Claim`、`EvidenceLink`、`Contradiction`、`Discard`、`RoundLog`、`Alias/ResolverRecord`。

矛盾不删不平均；“没搜到”不等于证伪；摘要不制造未观察事实；权威记忆、活跃疑问、当前状态、运行账本和 UI projection 分开。

### 3.9 权限与治理

`Principal`、`Role`、`Scope`、`Capability`、`PolicyRule(allow/deny/ask)`、`ApprovalRequest/Receipt`、`AuditRecord`、`KillSwitch`、`BudgetPolicy`、`StopRule`、`DataBoundary`、`NetworkPolicy`、`SecretScope`。

安装/启用插件、切 preset、放宽数据或指标/资源/对照、允许模拟替代真实 EA、改权限/网络/凭据、危险外部写入和提交长期权威记忆严格 user-only。

## 4. 系统分层

建议采用五个平面，而不是一个巨型线性状态机：

1. `Invariant Kernel`：CAS、权限、预算、停止器、resolver、审计、evaluator 隔离。
2. `Research Plane`：目标、问题、预注册、讨论、实验、review、Stage4、decision。
3. `Evolution Plane`：Harness、candidate、probe、archive、lineage、selection、promotion。
4. `Evidence/Memory Plane`：artifact、claim、contradiction、memory、projection。
5. `Interaction Plane`：DSH tools、Host commands、Client UI、approval、notifications。

至少分成两个耦合生命周期：`ResearchRun` 和 `EvolutionCampaign`。研究 Run 可以比较多个 Harness 候选；一个 Harness campaign 可以服务多个研究任务。

DSH 落点：Host 放 kernel、domain、PolicyGate、resolver、evaluator broker、artifact/claim、projection、tools 和 system prompt context；preset 只放模式策略、persona、工具可见集、角色组合和默认预算；Session log 记录模型可见交互；storageDomain 保存跨 session 运行索引、契约、manifest、resolver registry、幂等和检查点；sessionProjections 从已有 Session events 派生 read model；Markdown 只是投影。

Domain 不是绕过 session log 的隐形模型状态。每个 domain mutation 经过 Host operation，返回 receipt 并产生可重建的 tool/result 事实；关键提交调用 `session.flush()`。写入与交互失败靠 receipt、idempotency、重放和补偿恢复。

## 5. DSH 页面规划

页面是治理/观察对象，每个页面或面板必须声明：read model key/version/as-of seq、可见命令、gate、actor/capability、user-only 状态、receipt/evidence refs、幂等/CAS/重连语义，以及 loading/reconnecting/stale/approval/blocked/conflict/running/cancelled/failed/quarantined/read-only 状态。

### 页面地图

- **RSI 入口/Run 列表**：workspace/project、创建 Run、pin preset、版本矩阵、预算、父 Run、风险和 lineage。
- **Run Control Tower**：研究阶段和演化 campaign 双轨时间线、RunState/GateState、缺失契约、阻断理由、预算、run hash。
- **Intake/Question DAG**：疑惑节点、边界、完成条件、ready/running/done/refine/unresolved。
- **Pre-registration**：冻结前草稿编辑；冻结显示 diff/hash；冻结后修改明确变成 fork/new Run。
- **Discussion/Synthesis**：PositionPackage、证据、置信度、self_weakness、分歧；不做多数投票替代判断。
- **Experiment/Execution**：task、actor、sandbox、manifest、代码/模型/依赖、seed、资源、attempt、日志和 artifact；真实 EA 与模拟严格分栏。
- **Candidate/Lineage**：Harness 树、component diff、假设、probe、成本、novelty、promotion/rejection、stepping stones。
- **Review/Evaluation Lab**：pass/suspect/fail、seed、CI/效应量、泄漏检查、evaluator revision、held-out/regression、corruption signal、eval.read receipt。
- **Memory/Decision**：proposal、authoritative diff、claim、矛盾、否定叙事、open questions、DecisionRecord；不能直接写 `plan/02`。
- **Audit/Export**：事件链、契约/artifact/claim/evidence、权限/审批、拒绝、版本矩阵、导出 manifest；导出是新 artifact。
- **Settings/Compatibility**：DSH/plugin/bundle/preset/config schema、数据策略、预算、版本兼容；高风险动作只能 user-only approval。

已核实的 DSH 方向：`sidebar.panellist` 作为 RSI 入口，`main` keyed panel 作为 Control Tower，`conversation.composer.dock` 放当前 Session 的紧凑 Gate/下一动作，工具卡/聊天节点展示已记录事件摘要，`settings.section` 管策略与兼容；完整页面不要塞进 composer dock。UI 和 agent tool 必须调用同一 Host service method；UI 不直接写 domain、不在 Client 折叠 Session log。

## 6. 研究前沿与应采纳机制

### Harness²（Google Cloud AI Research，2026）

[论文](https://arxiv.org/abs/2610.14224) 与 [代码](https://github.com/google-research/harness2) 定义八类可编辑 Harness，以两个递归层运行：task-level Propose–Probe–Compose，不依赖 ground-truth verifier；harnessing-level 把采用 harness 和 evidence-supported lessons 带到后续任务；支持 parallel/sequential recursion。

这是最贴近 DSH 的公开路线。应吸收组件 ontology、任务级/跨任务递归和 experience memory。但其行为对比不能替代独立真值；开放世界不等于没有 proxy overfit；论文是预印本，代码仓库也声明不是官方支持产品。

### RRSI（Google Cloud AI Research，2026）

[RRSI](https://arxiv.org/abs/2609.24972) 把 adaptive overfitting 作为核心问题：退火 atomic edit budget、组件/假设/结果历史、停滞时探索新组件、leakage critic、重复 base 估计 noise band、noise-adjusted floor、性能-成本约束、结构剪枝和 OOD promotion。

这些机制应进入我们的候选选择器；不能只看 evolve-set 单分数。

### AlphaEvolve（Google DeepMind，2025）

其前身 [FunSearch Nature 论文](https://www.nature.com/articles/s41586-023-06924-6) 已展示 LLM 生成函数、外部程序 evaluator 和进化数据库的基本范式，但只演化单函数/小代码块，不自改 agent controller。AlphaEvolve 将这一范式扩展到更大代码文件、多指标、异步和更强模型。

[论文](https://arxiv.org/abs/2506.13131) 和 [官方介绍](https://deepmind.google/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/)采用 Flash 大量采样、Pro 深度提案、MAP-Elites/岛模型程序库、用户提供的自动 evaluator、多指标和 evaluation cascade。它在矩阵乘法、数学构造、调度、TPU/Transformer 上有强作者报告结果。

应吸收程序数据库、岛模型、多目标、分级/并行 evaluator 和异步流水线。不能称完整严格 RSI：控制器、evaluator、权重和训练流程没有被证明可自改；用户必须先提供可机器判定的 evaluator。

### DGM（ICLR 2026）

[会议页](https://proceedings.iclr.cc/paper_files/paper/2026/hash/aa5f5e6eb6f613ec412f1d948dfa21a5-Abstract-Conference.html) / [论文](https://arxiv.org/abs/2505.22954)让 coding agent 修改自身代码，archive 保存多分支 stepping stones，编译且保留自编辑能力的 child 才进入后续档案。作者报告 SWE-bench 20%→50%、Polyglot 14.2%→30.7%。

它是目前最接近严格代码级 RSI 的公开代表。限制是冻结 FM、固定部分外环、coding-only、benchmark proxy、成本和有限轮次。附录的 objective hacking 反例显示候选可能删除检测 marker 获得完美分数，证明 evaluator integrity 必须位于不可修改边界之外。

### HGM / Huxley–Gödel Machine（ICLR 2026）

[论文](https://arxiv.org/abs/2510.21614)、[ICLR 页面](https://proceedings.iclr.cc/paper_files/paper/2026/hash/821d20219c2f14850af1b5220f0ed13f-Abstract-Conference.html)把问题从“当前 agent 分数最高”改成“哪个谱系长期产生更好的后代”。它定义 clade metaproductivity（CMP），再用 CMP 估计和 Thompson sampling 选择扩展节点，把扩展和评估解耦，并异步运行。

HGM 的价值在搜索治理：短期 benchmark utility 可能不能代表长期 self-improvement productivity。限制也必须保留：真实 CMP oracle 不可得，实际 CMP 只是估计；理论结论依赖可重置、可重复测试、固定修改成本等强假设；FM、代码空间和 benchmark 仍固定，不能把 CMP 估计称为 Gödel Machine 的形式证明。它启发我们的 ArchiveSelector 同时记录即时性能、后代质量、成本和谱系生产力，但不能替代 held-out evaluator。

### DGM-H / HyperAgents（2026）

[论文](https://arxiv.org/abs/2603.19461) 让 task agent 和 meta agent 处于同一可编辑程序，允许修改“如何产生下一次改进”，在 coding、论文评审、robotics reward design、数学 grading 测试。作者报告 Polyglot 训练子集约 0.140→0.340、主要未见 full 165-task 约 0.084→0.267，paper review test 0→0.710、robotics reward design 0.060→0.372，且 BetterGrader 的 held-out accuracy 为 91.67%。这些是论文作者报告，不能外推成通用能力。

它是元 RSI 的方向性参考，但 parent selection 和 evaluation 在主实验仍固定，只有 task/meta 程序可改；允许自改 parent-selection 的预备实验仍低于手工策略且差异不显著。固定 benchmark 还会放大数据偏差，评价 gaming/Goodhart 是论文明确承认的核心风险，因此不能作为当前默认权限。

### AI Co-Scientist（Google，2025/2026 Nature）

[论文](https://arxiv.org/abs/2502.18864)、[Nature DOI](https://doi.org/10.1038/s41586-026-10644-y) 采用 generate、debate、rank、proximity、evolve、meta-review、supervisor，结合异步 multi-agent、Elo tournament、scientist-in-the-loop 和体外验证。

应吸收研究问题 DAG、异质讨论、证据综合和人工采纳。它主要递归改进假设、评审和 prompt/context，不改 controller、evaluator 或权重；Nature 正式版代码未公开，独立复现受限；体外结果也不是临床疗效。

### 负结果与评估证据

[Reflection or Re-Generation?](https://arxiv.org/abs/2607.28908) 的受控研究显示：没有外部信息时，LLM reflection 近似重新采样甚至负增益；外部 oracle、工具或异质 agent 才提供新信号。

最新综述还反复指出：公开论文常证明“最终 artifact 分数提高”，较少证明“递归改进程序本身可重复变强”。因此完整 loop 重跑、未见任务、独立 evaluator、成本/复杂度和 failure evidence 都必须是一等证据。

## 7. 我们应采用的完整闭环

### 两个循环、一个不可自改边界

研究循环：
`Intake → Question DAG → PreRegistration → Discussion → Experiment → Review → Stage4 → Independent Eval → Memory → Decision`

Harness 循环：
`Baseline → Candidate Patch → Probe → Full Eval → Held-out/OOD → Selection → Archive/Promote/Fork → Next Campaign`

治理边界：
`Policy/Evaluator/Permissions/Stop/Data Split/Audit Kernel`

研究循环决定回答什么；Harness 循环决定系统如何回答；治理边界决定什么改动有资格被运行和采纳。

### Candidate 不能只优化一个分数

硬检查性能、纪律、稳定性、held-out/OOD 泛化、成本、复杂度、多样性、可追溯性和安全。任何硬失败不能被其他分数补偿。改 evaluator、绕过检查、泄漏 held-out 或成本失控，必须拒绝/隔离。

### 三层评价

1. `Machine Verifier`：schema、测试、统计、数据完整性、路径和执行。
2. `Independent Evaluator`：held-out、regression、真实任务、多 judge/外部专家。
3. `Human/Principal Judgment`：疑惑语义、验收意义、矛盾解释、Stage4、长期记忆。

LLM judge 只能是辅助证据；不要让同一 optimizer 在同一可修改目录内自证。

### Q19 的真实锚点

Q19 是真实 EA（12 系、88 万对、score、`.pre_cache`）无监督训练能否为 BENGI IMR90 带来增益。Run 开始前冻结 manifest、预处理、split、seed、baseline、IMR90-only eval、held-out/regression、control、资源和停止条件。BENGI 模拟可做探针/灵敏度，但在 closed-loop 中不能替代真实 EA。

## 8. 完整建设路线

A. 固定术语、对象图、双层真相源、mode transition matrix、actor-capability matrix、version matrix、failure semantics。

B. 建立可重放领域合同：schema、event envelope、hash/freeze、CAS、idempotency、resolver、manifest、artifact、claim/evidence、memory proposal/commit。

C. 建立受治理 Harness 演化：component ontology、candidate diff、probe/full eval、archive/lineage、noise floor、edit budget、cost/complexity、OOD promotion、quarantine、fork。

D. 接 DSH Host：storageDomain、sessionProjection、tools guard/pre-execute、systemPrompt context、subagent/workflow、approval、flush；preset 只放策略。

E. 接真实 Harness 后重新 Inspect slot/props/wire/remote，建立 Run/Control Tower/Intake/Pre-reg/Discussion/Experiment/Lineage/Eval/Memory/Audit/Settings 视图，先完成 stale/reconnect/blocked/approval/CAS/error/read-only 语义。

F. 先用假实验测拒绝、恢复和 objective hacking，再接真实 EA→BENGI；随后增加跨任务、跨数据、跨模型 held-out。

G. 只有 evaluator integrity、权限隔离、谱系、独立评估和 fork/rollback 成熟后，才研究让 proposal/selection 部分机制可改。evaluator、stopper、security、permission、data boundary 仍不可改；权重递归不在当前路线。

## 9. 高风险清单

1. Domain 与 session log 的 receipt、事务关联、重放、补偿。
2. root/coding/eval/UI 并发写 Run 的 CAS、租约、单写者。
3. Attempt/Job/Lease/Cancel/Orphan/Quarantine/GC 生命周期。
4. evaluator 共谋、objective hacking、数据泄漏、reward hacking。
5. held-out/regression 物理隔离和 manifest 完整性。
6. memory 摘要制造事实，proposal 冒充 commit。
7. EA 的隐私、PII、secret、redaction、访问和导出撤回。
8. token、wall-clock、硬件、费用、并发、深度、磁盘预算。
9. Host 重启、partial artifact、HMR、老 Agent revision、升级迁移。
10. append-only 数据不能物理回滚，只能 fork、新 Run 或补偿事件。
11. 拒绝、询问、绕行、重复、eval.read、漂移和 memory 冲突 telemetry。

## 10. 最终判断

不要复制某一篇论文，而要组合：

- AlphaEvolve 的外部机器评价器、程序库、岛模型、多指标和异步评估。
- DGM 的自改代码、archive、谱系和 stepping stones。
- Harness²/RRSI 的 Harness ontology、任务/跨任务递归、编辑正则化、噪声地板、成本约束、剪枝和 OOD 泛化。
- Co-Scientist 的问题 DAG、异质讨论、证据综合、人工科学判断和实验验证。

最终系统应是：DSH 负责交互，Host kernel 负责不可变治理，Research plane 负责科学闭环，Evolution plane 负责 Harness 候选与档案，Evaluator plane 负责外部验证，Memory plane 负责可追溯知识，Client UI 负责解释和授权。

核心铁律：判断不委派，执行不自做；预注册先于结果；真实 EA 不被模拟替代；独立评价不能由优化器自证；同一结论重复两次后必须转向；改 evaluator 或绕过检查得到的分数不算改进。
