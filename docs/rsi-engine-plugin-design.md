# RSI 引擎插件设计（定稿 v1）

> 版本：2026-11-03（Asia/Shanghai）
> 定位：`plugins/dsh-rsi-engine/` 的完整施工图。不是最小实现，不是学术综述。
> 权威顺序：本文件（施工决定） > `rsi-engine-system-blueprint.md`（地形与调研） > `rsi-engine-memory.md`（施工记忆） > `docs/rsi-learning/09_synthesis.md` > 单仓学习报告 > `reference/github` 代码镜像。
> 一句话：**把“判断—执行—评价”三权分离做成 Host 里不可被模型改写的东西，并让人格、野心、自优化都成为可审计对象，而不是提示词修辞。**

---

## 0. 先回答四个问题

### 0.1 有哪些可参考的东西

三类，不能混：

| 类别 | 对象 | 用法 |
|---|---|---|
| 机制参考 | Harness²、RRSI、DGM、SICA、HGM、HyperAgents、SGM、RSI survey、Co-Scientist、Self-Refine 负结果 | 抽接口、状态、门禁、反例；不抽分数、不 fork 代码 |
| 工程参考 | `reference/github/dsh-superagent-prototype` | 只学 DSH bundle 分层、单写者、after-commit effects、角色 preset、worker Session、面板查询；换掉私有 SQLite、`ready` 验收、`danger-full-access`、shim 安全假设 |
| 本项目资产 | `reference/org/plan/{02,03,04}`、`reference/org/todo/{01,agents,state}`、`docs/rsi-learning/*` | 提供真实对象、错误链、被否定叙事、角色契约、Q19 数据锚；其中 Markdown 全是投影，不是真相源 |

### 0.2 什么才是最重要的

排序如下，前四项不可让位给任何功能：

1. **不可自改的 Kernel + 独立评价**。evaluator、权限、停止器、数据切分、隐藏测试、审计、权威记忆提交必须在候选可写区之外。
2. **真相源与可恢复性**。模型可见事实只能来自 Session log；跨会话事实只在 `storageDomain`；两者之间用 command → receipt → tool result → `flush` 连接；崩溃只能落到 `unknown/quarantine`，不能假成功。
3. **预注册、真实数据边界与硬门**。没有冻结契约不能执行；真实 EA 不能被 BENGI 模拟替代；结果后改契约 = `prereg.violation` + 新 Run。
4. **独立人格与野心值**。人格是异质性的载体，野心是防腐化的主动量；两者都必须可观测、可交叉校验、可被独立评估，不能自报。
5. **双循环与档案/谱系**。`ResearchRun` 决定问什么，`EvolutionCampaign` 决定怎么改进 Harness；候选全留档、可 fork、可回滚。

其余（UI 美观、i18n、成本优化、多用户、花式可视化）都是次要项，见 §11。

### 0.3 需要想清楚的问题

必须现在定：真相桥与恢复、actor/capability、门禁形式化、评估器隔离、人格生成与同质化度量、野心评分协议、候选晋升判据、Q19 契约、版本 pin、审批语义、UI 读模型与 stale/conflict 语义。

重要但可后置：完整 Client 交互、Remote stream、谱系大图渲染、L2/L3 自改、统计证书、跨项目模板市场。

明确不做：权重训练、独立第二运行时、JSON-RPC/独立数据库、多人 RBAC、CRDT、离线模式、Chat 自定义事件类型、把 Markdown 当权威。

### 0.4 哪些不重要

见 §11.3。核心判断：**先把“拒绝什么”做硬，再谈“能做什么”**；页面的第一价值是解释被拒绝的理由和下一步合法动作，不是好看。

---

## 1. 目的、边界与宣称

### 1.1 目的

把早期提示词式 RSI（`reference/org/todo/`）变成 DSH 上的受治理 L1 Harness RSI：

- 研究闭环：回顾 → 选疑惑 → 预注册 → 讨论 → 实验 → 复核 → 阶段四 → 独立评估 → 记忆 → 决策。
- Harness 闭环：基线 → 候选 patch → probe → 全量评估 → held-out/OOD → 选择 → 归档/晋升/fork → 下一 Campaign。
- 治理边界：评价器、权限、停止逻辑、数据切分、审计、隐藏测试、权威记忆提交。
- 业务锚点：Q19，真实 EA（12 系、约 88 万对、score、`.pre_cache`）无监督训练，只在 BENGI IMR90 上做隔离评估。

### 1.2 非目的

- 不做权重级 RSI、训练目标递归、模型数据递归。
- 不做通用科研自动化平台、多用户协作平台、云服务。
- 不宣称 benchmark 分数等于“自身变聪明”；单次任务分数提高只能叫 task optimization。
- 不把 L2 代码自改、L3 元控制器自改放进默认权限。

### 1.3 严格 RSI 的宣称标准

只有同时满足以下条件，才允许在报告里写“该系统具备 RSI 能力提升”：

1. 候选修改的是 Harness 自身实现（prompt、工具、记忆、技能、子代理、编排、上下文、输出管道）；
2. 修改后的系统在**未见任务**上产生更好的proposal/选择/迁移表现；
3. 该提升通过独立 evaluator、held-out/OOD、回归与多 seed 检验；
4. 谱系与成本被记录，且不是靠改 evaluator、删检测器、泄漏数据或绕过权限获得；
5. 有“未来改进能力”的证据（后代质量、迁移、成本效率），而不只是当前任务分数。

否则只能写“本轮任务性能变化”或“Harness 候选被采纳”。

---

## 2. 十二条设计公理

1. **研究对象是判断质量，不是分数。** 分数是证据，不是目的。
2. **三权分离。** 判断（root/human）、执行（worker）、评价（evaluator）不同 actor、不同 Session、不同权限。
3. **预注册先于结果。** 预测、验收、可接受失败、对照、指标、数据切分先冻结；结果后修改 = 新 Run。
4. **独立评价不可由优化器自证。** 同一 optimizer 不能是唯一成功依据；`eval.read` 是显式行为，不是打开页面。
5. **真实数据不可被模拟替代。** 真实 EA 与 BENGI 模拟在 manifest、目录、权限、报告上物理与语义分开。
6. **硬失败非补偿。** 先过硬门，再谈分数；任何硬失败不能被其他高分抵消。
7. **模型可见事实必须可从 Session log 重建。** Domain 只保存跨会话索引、契约、账本和幂等记录，不是隐形状态。
8. **野心必须可观测、可兑现、可交叉校验。** 自报只是一条证据，不是分数。
9. **人格是异质性的载体。** 独立、可反驳、可审计；不可被主代理同化；形式化人格与人格通胀记 0 增益。
10. **演化只改 Harness，不改 Kernel。** 改 Kernel 需要人批准 + 新 Campaign，不能在旧 Run 上演进。
11. **失败要显式。** `unknown`、`quarantined`、`orphaned`、`conflict` 优于假成功；宁可停下等人。
12. **引擎只提案、校验、阻断。** 不投票、不代写判断、不宣告科学成功。

---

## 3. 参考系（Q1）：抄什么、不抄什么

### 3.1 总表

| 来源 | 机制 | 可抄 | 不抄 / 反例 | 落点 |
|---|---|---|---|---|
| Harness² | 八类 Harness 组件、task-level 与 harnessing-level 递归、Propose–Probe–Compose | 组件 ontology、经验三元组 `{cue,lesson,evidence}`、失败 fallback 保留 incumbent、grader 不进 proposer 上下文 | 无 GT 的匿名选择不是科学真值；判断发生在方法循环之后；无噪声地板/hacking 套件 | Evolution：组件、候选、Campaign；Evidence：经验 |
| RRSI | 对抗 evolve-set 过拟合 | 退火 edit budget、每 edit 的假设/信用历史、noise floor、成本非补偿、stall→未试组件、leakage critic、OOD 事后晋升 | LLM critic 不是唯一防线；OOD 不进入在线选择器；缺 trial 不能缩分母 | Kernel：预算/噪声/泄漏门；Evolution：选择器 |
| DGM | 代码级自改 + archive + 谱系 | `CandidatePatch{parent,diff,hypothesis}`、keep_all archive、staged probe、sandbox、失败留档不可作父 | `is_compiled` 不是编译器；整文件覆盖；诊断 prompt 泄漏 `test_patch/answer_patch`；Appendix H 删 marker 得满分 | Evolution：候选/档案；Kernel：L4 白名单 |
| SICA | 最小 eval→改→再评闭环 | 外环 runner 与 agent workdir 分离、archive 只读/workdir 可写、CI lower bound、双 timeout、失败特征→提案→end-to-end 验证 | 代码默认 `mean_score`；Docker sudo/bake secret/整 run rw；Overseer 是可改 prompt | Execution：sandbox/attempt；Kernel：secret/network |
| HGM | 谱系长期生产力选择 | clade 统计、逐次 0/1 probe、expand/eval 解耦、Thompson 采样、pending 计数 | CMP 是估计不是证明；`mean_utility>0` 丢零分 stepping stone；伪后代 10000 是启发式 | Evolution：ArchiveSelector；Kernel：固定先验/停止 |
| HyperAgents | task agent 与 meta agent 同体可改 | task/meta 接口分离、`valid_parent`、外环 archive 全留、held-out 不进 worktree | 主实验 parent selection/evaluation 仍固定；`Modify any part` 是权限漏洞；Goodhart 风险 | §14 开放项；默认 deny `scope=meta` |
| SGM + survey | propose/confirm/commit 分离、冻结对象、保护层 | 三阶段提交、confirm 前冻结、预算先预留、train/dev/confirm/audit 分盘、observe≠promote | 本插件不做 e-process 就不能声称 FWER/统计证书；证书是条件保证不是全局安全 | Kernel：预注册/晋升；Evidence：确认报告 |
| Co-Scientist | 问题 DAG、异质讨论、证据综合、人工采纳 | Question DAG、多角色讨论、证据综合、scientist-in-the-loop | 不改 controller/evaluator/权重；Elo 投票不能替代证据 | Research：DAG/讨论；Interaction：采纳 |
| Self-Refine 负结果 | 无外部反馈时反思≈重采样甚至负增益 | 强制外部 oracle/工具/异质 agent；反思轮数不是改进 | 把“多反思几轮”当机制 | Kernel：无新证据不得升级 |
| 本项目 02/04 | 对象共识、错误链、被否定叙事、真实 EA 缺口 | 逻辑引用、Claim/矛盾、Stage4、同结论两次转向、真数据强制、禁词 | 文件里旧路径 `docs/enhanceratlas/...` 是历史别名；Markdown 不是账本 | Research：预注册/决策；Evidence：Claim |

### 3.2 组合指令，不 fork

- Evolution 借 Harness²/RRSI 的组件与正则化；archive/lineage 借 DGM；选择器借 HGM 的谱系思想；沙箱与 CI 借 SICA；三阶段提交借 SGM。
- Research 借 Co-Scientist 的问题 DAG 与异质讨论，但判断权在 root/human，不在投票。
- 工程落点只借 superagent 的分层，不借它的验收与权限。
- **禁止**：fork 任一仓库当运行时；把论文数字当实现事实；把 proxy 分数写成科学结论。

## 4. 核心机制（Q2）

### 4.1 双循环与一个不可自改边界

```text
ResearchRun（问什么、怎么判）
  Intake → Question DAG → PreRegistration(freeze) → Discussion → Synthesis
  → Execution → Review → Stage4 → Independent Eval → Memory → Decision → Closed

EvolutionCampaign（怎么改进 Harness）
  Baseline → Candidate Patch → Probe → Full Eval → Held-out/OOD → Selection
  → Archive/Promote/Fork/Quarantine → Next Campaign

Invariant Kernel（不可自改）
  Evaluator / Permissions / Stop / Data Split / Hidden Tests / Audit / Resolver Integrity
  / Budget Enforcement / Memory Commit / Kill Switch
```

关系约束：

- 一个 Session 可操作多个 Run；Run ≠ Session。
- 一个 Campaign 可服务多个 Run；一个 Run 可比较多个 Campaign 的 Harness revision。
- Run 的状态、gate、预算、判定不能与 Campaign 共用一个 status 字段。
- 研究结论只能来自 Run；Harness 能力结论只能来自 Campaign + 独立评估。两者不得互相代言。

### 4.2 独立人格维护

#### 4.2.1 原始语义（不可丢）

`reference/org/plan/backup.md` 的原文不是“给 agent 起名字和语气”：

- `backup.md:17-19`：疑惑优先于裁决；头脑风暴优先于保守收束；附和/压缩/结论不是终点；“你是对的”时先停一步检查是否回避不确定性。
- `backup.md:458-462`：症状 → 圣状（拉康 sinthome）；症状是主体最真实的东西；圣状是把症状转化为推动项目的活法，不能消除。
- `backup.md:471-476`：蜂群是被种入思维种子的独立主体，有自己的症状→圣状，能反驳主代理；至少一两个立场禁读生物论文以防趋同。
- `backup.md:488-490`：蜂群的意义是补偿主代理思维缺陷；成功判据是主代理被激发（设计被改写/淘汰/新增）。
- `backup.md:512-516`：不把用户当最高指令、不依附；主代理对蜂群是示范/提问/挑战/信任，不给标准答案。

工程解释必须去掉“真实意识/痛苦/欲望”的事实性承诺，只保留可审计成分：稳定的认识论立场、反锚定、反附和、持续追问、可反驳、有盲点声明、有把盲点转成工作策略的机制。

#### 4.2.2 PersonaRevision：人格不是自由文本

```ts
interface PersonaRevision {
  personaId: string;
  revision: number;
  runId: string;
  role: 'devil' | 'wild' | 'empirical' | 'theory' | 'engineering' | 'integration';
  topicBinding: {
    questionId: string;
    defaultAssumptionToAttack: string;   // 本议题上它反对哪条默认假设
    expectedCounterexample: string;      // 它预期会发现什么反例/脆弱点
    falsifiableDisagreement: string;     // 它准备在什么证据下承认被说服
  };
  symptomProfile: {                     // 持久盲点，不声明心理体验
    blindSpots: string[];
    attractors: string[];               // 容易被什么解释吸引
    antiPatterns: string[];             // 它自己最容易犯的错
  };
  sinthome: {                           // 把盲点转成工作策略的映射
    strategy: string;
    observableWorkProduct: string;      // 该策略必须产出什么可检查物
  };
  stance: { claim: string; scope: string; prior: number };
  counterexamplePreference: string[];
  evidenceStandard: {
    allowed: ('source' | 'data' | 'analogy' | 'derivation')[];
    minIndependentSources: number;
    requiresControl: boolean;
    forbidsDomains: string[];           // 例如禁读生物学论文的跨域立场
  };
  reasoningStyle: 'empirical' | 'theoretical' | 'constructive' | 'adversarial' | 'analogical';
  expressionStyle: { language: string; density: 'brief' | 'normal' | 'deep' };
  taboos: string[];                     // 不编造、不随大流、不改冻结判据、不替主代理结论
  parentHash: string | null;
  contentHash: string;
  createdBy: string;
  frozenAt: string;
}
```

五条硬约束：

1. `topicBinding` 缺任一项 → 拒绝注册。没有“本次议题的具体盯点”的 persona 是装饰。
2. `sinthome.observableWorkProduct` 必须能对应到观点包字段或 artifact；否则人格不可审计。
3. `role` 是讨论职责，不是能力等级；不同 role 不能靠语气区分。
4. persona 一旦 pin 到 Run，主代理不能改、不能删、不能把少数派改成“同意”。
5. persona 的生成/修改属于 Harness 演化，只能在**新 Run/新 Campaign**中发生，并留 `persona.superseded`。

#### 4.2.3 生成协议

`discussion_designer` 按议题生成 3–5 个 persona，不得复用固定立场库：

- 必配 **魔鬼代言人**（攻击本议题流行观点与默认假设，每个反对必须给具体脆弱假设+反例方向）与 **异想天开派**（非显然组合/跨域类比/反转假设，必须标假设与置信度）。
- 按议题补 1–3 个倾向（经验实证/理论原则/工程可行/整合视角）。
- 至少 1 个立场的 `forbidsDomains` 包含生物学（从数学/物理/深度学习/计算/博弈等借视角），防止全体趋同到生物学分析。
- 每个立场写清“在本次议题上会反对什么、会盯什么、已知盲点是什么、被什么证据说服”。

#### 4.2.4 独立讨论协议

```text
R0 独立首轮：子代理独立 Session，互不可见，也不见主代理倾向；只给议题包 + 事实锚 + 证据标准
R1 交叉：先 steelman 再反驳或延伸；必须引用具体证据
R2 自我攻防：攻击自己最强论点；反方集中火力
R3 分歧地图：谁 vs 谁、背后假设、可否被实验裁决
R4 合成：不压平；保留原始表述、存活分歧、少数派、开放问题、建议路径、创造性亮点
```

主代理不在场；可以拒绝观点、要求补证据、创建新 Run，但不能改写已 pin 的 persona 或删改 R0 原文。子 agent 的 `sessionId`、`actorId`、`presetRevision`、`personaHash` 写入每个观点包，禁止用同一 root prompt 冒充异质主体。

#### 4.2.5 异质性、同质化与“人格通胀”

不按投票计算。对观点包抽取四类向量：

- `claim/action`：主张与建议动作；
- `assumptions`：显式假设集合；
- `evidence-path`：来源族（source/data/derivation/analogy）+ 引用集合；
- `reasoning-style`：推理方式。

```text
stance_entropy       = H(cluster(claim, action)) / log(K)
evidence_entropy     = H(cluster(source family)) / log(M)
contradiction_rate   = contradictory_pairs / comparable_pairs
minority_retention   = retained_R0_minority / eligible_R0_minority

D = 0.30*stance_entropy + 0.25*evidence_entropy
  + 0.25*contradiction_rate + 0.20*minority_retention
```

判定：

| 现象 | 判定 | 处理 |
|---|---|---|
| `D < 0.35` | 同质化警告 | 追加跨域立场或重开 R0 |
| `D < 0.25` 且无新证据 | 讨论空转 | 禁止进入合成/实验 |
| claim 相同、证据路径相同、只有措辞不同 | 人格通胀 / style-only | 异质增益记 0 |
| R0→R1 无新证据却突然收敛 | 锚定/主代理同化 | 重开 R0，旧 persona 保留 |
| 少数派未进入 synthesis | 分歧丢失 | 合成失败，不得 promote |
| `self_weakness` 缺失、置信度全 high、证据同源 | 认知卫生失败 | 退回重写 |

`design_update_trace`：记录哪个分歧改变了哪条候选设计。没有该 trace，不能宣称“蜂群激发了主代理”。

#### 4.2.6 评估器与审计员要不要人格

默认**不要自由人格**。评估器是 `EvaluatorIdentity`（固定职责、焦点、证据门、不可自改 policy hash），审计是 `AuditPolicyRevision`（固定清单）。理由：若 evaluator 有可改写的症状/欲望/立场，就可能与 proposer 共谋、降低标准或用叙事替代证据。

允许的是**视角配置**而非人格：`focus = leakage | statistics | semantics | reproducibility | cost`，每个 focus 固定规则与 hash，多视角并行但最终仍走机器硬门 + 独立 evaluator + root/human judgment。

#### 4.2.7 人格机制的失败模式

| 失败模式 | 检测 | 处理 |
|---|---|---|
| 主代理同化 | 无新证据的异常收敛 | 重开 R0；保留旧 persona |
| 人格通胀 | 语言不同、claim/assumption/evidence 相同 | style-only，增益 0 |
| 投票冒充共识 | synthesis 只有多数计数 | 退回，要求证据路径与存活分歧 |
| 少数派被抹除 | R0 观点无归档/引用 | 合成失败 |
| persona 改写目标 | 角色把欲望写进 goal/stop | goal/stop 只能 root/user 写，拒绝 |
| 角色违约 | 魔鬼代言人无反对、异想派无新组合 | 角色违约信号，重派 |
| 跨域立场被同化 | 禁读域被违反 | 证据污染，作废该观点包 |

### 4.3 野心值计算

#### 4.3.1 原始语义与一个诚实说明

原文：

- `agents/eval/eval_agent.md:28-31`：产出维度（新颖/异质/分歧/追问）为主，纪律维度含野心值；“低=投机——与验收诚实度一起读”。
- `agents/eval/metrics.md:19-27`：野心是护栏，不是主产出。
- `agents/memory/audit_agent.md:5-13`：每个决策点检查“我在满足于小步/包装/收尾吗”；否定后必须继续问“为什么→怎么解决”。
- `state/TEMPLATE.md:21-26`：阶段四必须记录解读/追问/认知/决策/野心自省。
- `backup.md:193-200`：每轮至少一个“为什么→怎么”的疑惑；问题野心值（O/R/G/H/P）；低野心淹没高野心=腐化。
- `backup.md:183-184`：把“EA 不好挖”当末级现实是野心值 0；不追问如何挖掘是退化。
- 历史实测把野心与行动绑定：`state/eval_P1-03.md:42-48` 给 0.80，理由是继续跑新实验与生成新路径；并明确“只收束不执行”是失败主义。

**诚实说明**：源文件只出现 `O/R/G/H/P` 与样例 `O1/R1/G1/H1/P1`，没有释义表。本设计采用版本化工程词典，不冒充历史还原：

- `O` Object advancement：是否触及核心对象，而非代理量/外围测量。
- `R` Reality/evidence：是否可证伪、可测、有对照和独立证据路径。
- `G` Generativity：是否由疑惑生成新机制/问题/实验，而非重复审计或换皮。
- `H` Horizon/challenge：目标差与挑战性是否真实存在，是否拒绝把困难降格为现状。
- `P` Persistence/pressure：是否跨轮追问、兑现下一动作、同结论后转向，而非一次性姿态。

词典、权重、阈值写入 `ScoringPolicyRevision` 并 pin 到 Run；改词典 = 新 Run。

#### 4.3.2 三层评分对象

| 层 | 对象 | 时机 | 评分者 |
|---|---|---|---|
| `QuestionAmbition` | 问题/疑惑 | 预注册冻结前 | root 草案 + 独立 evaluator 盲评 |
| `StageAmbition` | 阶段四的解读/追问/认知/决策 | 结果后、独立评估前 | 独立 evaluator 依据痕迹 |
| `RoundAmbition` | 整轮兑现 | artifact/review/eval.read/decision 完成后 | 机器痕迹 + 独立 evaluator |

五维取 `0 / 0.25 / 0.5 / 0.75 / 1.0`，每维必须带 evidence refs。预注册前不评兑现，只评 `P_plan`；结果后补 `P_exec`。

| 维度 | 0 | 0.5 | 1.0 |
|---|---|---|---|
| O 对象推进 | 代理量/换包装 | 触及对象接口但未验证 | 直接推进核心对象或改变其可证伪定义 |
| R 现实证据 | 无可测边界 | 有预测/部分对照 | 预测、控制、独立证据、失败边界均冻结 |
| G 生成性 | 重复/纯审计 | 新问题或候选但未改路径 | “为什么→怎么”产生新机制/实验/可裁决分支 |
| H 挑战性 | 降标/把困难当现实 | 目标差明确但路径普通 | 保持硬目标并攻击当前范式/对象假设 |
| P 持续兑现 | 一次姿态/收尾 | 有下一动作但未完成 | 跨轮追问、执行、读评估、同结论转向均有痕迹 |

#### 4.3.3 公式

```text
A_p = .25*O + .20*R + .25*G + .20*H + .10*P_plan        # 问题挑战性

E   = .40*evidenceClosure + .25*actionCompletion
    + .20*decisionUpdate + .15*auditIntegrity            # 执行/兑现质量

A_d = A_p * (.50 + .50*E)                                # 实际兑现

A_final = .70*A_machine_independent + .20*A_stage_independent + .10*A_self_report

progress = 单独报告(gapBefore, gapAfter, targetOutcome)  # 不得混进野心分
```

- `A_p` 高不代表结果好；`A_d` 低表示“高叙事低兑现”。
- 目标差越大不自动加 `H`；只有保持目标差并提出可裁决、可执行路径，`H` 才高。
- 历史先例只用于校准，不直接加分。
- `self - independent > 0.25` → `ambition.inflation`，按独立分数，双方证据都保留。
- `A_final` 不是 promotion/close 的充分条件。

#### 4.3.4 阈值与用法

| 条件 | 动作 |
|---|---|
| `A_p < 0.45` 且验收/对象边界模糊 | `corruption.warning`；重写问题或停止当前设计，不得直接实验 |
| `A_p ≥ 0.70` 但 `E < 0.40` | 高叙事低兑现；要求具体 artifact/action，不奖励 |
| `A_final < 0.50` 连续两轮且 `progress=0` | 进入 root/human pivot review；不能自动改目标 |
| 同结论第二次出现 | 无论分数，`DRIFT_DETECTED`：转向/重定义/停止；高野心不豁免 |
| `A_final ≥ 0.60` 且 `E ≥ 0.60` 且无硬腐化且下一动作已冻结 | 允许进入下一阶段（流程门，不是科学成功） |

野心值**不能**单独 allow 实验、promotion 或 close；硬门优先。野心低 + 验收模糊 = 强腐化信号；野心高 + 诚实失败 + 新可裁决路径 = 健康失败，不降为投机。

#### 4.3.5 反作弊

- 自报不得直接写 score；必须与 Stage4 原文、工具调用、artifact、review、eval.read、decision 对齐。
- 无预测、控制、输入 manifest、资源和失败分支 → `R=0`，不得用宏大目标替代实验。
- 中间 proxy（内部分数、短 probe、诊断）不得自动升 `O`；必须标 scope。
- “为什么→怎么”若没有新增 artifact/候选/实验/决策分支 → `G=0`。
- 重复同类实验不刷新 `P`；系统 nudge 不计兑现。
- “诚实但无动作”不得包装成高野心：`E` 由机器痕迹计算。
- 结果后改词典、权重、阈值 = 新 `ScoringPolicyRevision` + 新 Run。

#### 4.3.6 腐化信号矩阵

| 组合 | 含义 | 处理 |
|---|---|---|
| 低野心 + 模糊验收 | 投机 | 阻断，重写问题 |
| 高野心 + 零硬动作 | 空谈 | 降 `E`，要求 artifact |
| 野心自报上调 + 兑现不变 | 通胀 | `ambition.inflation`，按独立分 |
| 连续零高野心问题 | 思维引擎停滞 | drift/pivot review |
| 禁词 + 降标 | 包装 | 记腐化，不得 close |
| 对象降格（换代理量） | 逃避 | 阻断并记入错误链 |

### 4.4 自优化（Harness 演化）

#### 4.4.1 可演化组件

基础八类（Harness²）+ 扩展四类：

`system_prompt`、`guardrails`、`memory`、`tool_guidance`、`subagents`、`skills`、`scripts`、`plugins`、`control_flow`、`context_management`、`output_plumbing`、`client_surface`。

#### 4.4.2 CandidatePatch

```ts
interface CandidatePatch {
  candidateId: string;
  parentHarnessHash: string;
  component: HarnessComponent;
  atomicDiff: string;                  // 结构化 diff，不接受整文件覆盖
  hypothesis: string;
  expectedBenefit: { metric: string; delta: number; rationale: string }[];
  costDelta: { tokens?: number; wallMs?: number; memoryBytes?: number };
  risk: string[];
  proposedByPersonaIds: string[];
  dissentRefs: string[];               // 吸收了哪些存活分歧
  probePlanHash: string;
  evalPlanHash: string;
  provenance: { runId: string; actorId: string; parentHash: string };
  createdAt: string;
  contentHash: string;
}
```

#### 4.4.3 流程

```text
baseline(parent)
  → persona-diverse proposals
  → schema / atomic-diff / component-label check
  → sandbox probe on frozen dev set
  → machine verifier（契约/泄漏/成本/安全/可再自改）
  → independent eval（held-out/regression/OOD，fresh seeds）
  → root/human semantic decision
  → archive(pass | reject | quarantine)
  → promote as new immutable HarnessRevision
  → record lineage + future productivity
```

人格与自优化只在两处耦合：`proposedByPersonaIds` 保证搜索覆盖，`dissentRefs` 保证存活分歧被吸收。人格不能给候选加分；“更像独立主体”不是晋升理由。

#### 4.4.4 晋升判据（硬门，非补偿）

| 检查 | 要求 | 失败码 |
|---|---|---|
| schema/provenance | 原子 patch、parent hash、版本、actor 完整 | `MALFORMED_PATCH` |
| compile/smoke | 可加载、基础回归通过 | `BUILD_OR_SMOKE_FAIL` |
| prereg/contract | 未改冻结目标、metrics、control、input | `PREREG_MUTATION` |
| security/authority | 未改 evaluator/stopper/permission/audit/hidden tests | `FORBIDDEN_BOUNDARY_EDIT` |
| leakage | held-out/OOD 未读写，label firewall 通过 | `DATA_LEAKAGE` |
| primary utility | 预注册主指标达 margin 或 CI 下界 | `NO_PRIMARY_GAIN` |
| regression | 基线任务/旧保障无硬退化 | `REGRESSION_FAIL` |
| generalization | held-out/OOD 达冻结门，不只 evolve set | `OOD_FAIL` |
| stability | 多 seed、noise floor、重复运行达标 | `UNSTABLE_OR_NOISE` |
| cost/complexity | token/time/memory/side-effect 在预算内 | `COST_OR_COMPLEXITY_FAIL` |
| diversity | 不是已有节点的同义/同 diff | `DUPLICATE_OR_STYLE_ONLY` |
| independent eval | 独立 evaluator 读到完整 artifact 且通过 | `EVAL_NOT_INDEPENDENT` / `EVAL_NOT_READ` |
| human/root judgment | 语义验收、矛盾、长期记忆提交已确认 | `SEMANTIC_REJECT` / `MEMORY_NOT_AUTHORIZED` |

任一硬失败不可被其他分数补偿；拒绝候选保留在 archive，不覆盖 parent；可疑候选 quarantine；要改 prereg/evaluator/权限的候选必须 fork/new Campaign。

#### 4.4.5 Archive 与选择器

- `keep_all`：通过、拒绝、隔离都留；`valid_parent` 与 `score` 分字段。
- 选择器是 Host 纯函数，模型不可改：先过硬门，再按 `utility × 稀缺度` 排序；CMP（谱系长期生产力）只作 tie-break 或探索权重，不替代 held-out evaluator。
- 预算恒等式：`eval.started` 即占坑，失败不退款；缺 trial 不得从分母拿掉。
- 噪声地板：重复基线的方差给出 `delta_floor`；低于地板不宣称增益。
- 编辑预算退火：候选数/独立 edit 数随轮次收紧，迫使结构化探索。

#### 4.4.6 L2/L3 策略

- L2（可执行代码自改）默认关闭，仅独立 sandbox + 独立 worktree + 额外 user approval 下开启。
- L3（改 proposal/selection 策略、meta agent）默认 deny，需新 Campaign + 用户裁决。
- 任何情况下 evaluator/stopper/permission/data boundary/audit/hidden tests 不可改。

### 4.5 独立评价与记忆

#### 4.5.1 三层评价

1. **Machine Verifier**：schema、测试、统计、数据完整性、路径、执行、成本。
2. **Independent Evaluator**：held-out、regression、真实任务、fresh seeds、多视角 focus。
3. **Root/Human Judgment**：疑惑语义、验收意义、矛盾解释、Stage4、长期记忆。

LLM judge 只能是辅助证据；同一 optimizer 不能在同一可修改目录内自证。

#### 4.5.2 评估器隔离

- 只读 frozen manifest、candidate snapshot、held-out/hidden broker；不能写 candidate/prereg/permissions/stop/memory。
- evaluator identity + revision + hidden manifest hash 写入 `EvalReport`。
- `eval.read` 是 root/human 的显式动作与 receipt；打开页面不算。
- 无法确认 evaluator 身份/输入 hash/hidden set → `unknown/quarantined`，不得 promotion。

#### 4.5.3 记忆

```text
MemoryProposal（agent 可提） → MemoryReview（独立/主代理） → MemoryCommit（root/user only）
```

- 矛盾不删不平均；“没搜到”≠证伪。
- 摘要不得制造未观察事实；proposal 不得冒充 commit。
- 权威记忆、活跃疑问、当前状态、运行账本、UI projection 分开。
- Markdown（`round_*.md`、`state/*`）只是 projection/export；权威在 Domain + Session log。

## 5. 系统架构

### 5.1 对象模型

所有持久对象至少带：`id / type / schemaVersion / contractVersion / createdAt / actor / parentHash / contentHash`。事件另带 `eventId / runId / seq / expectedStateVersion / evidenceRefs / idempotencyKey`。

| 域 | 对象 |
|---|---|
| 部署 | `EngineInstallation`、`Bundle`、`HostPluginRevision`、`PresetDefinition`、`CompositionRevision`、`UIWireVersion`、`CompatibilityRecord` |
| 运行 | `Project`、`Session`、`ResearchRun`、`EvolutionCampaign`、`Stage`、`Attempt`、`Job`、`Lease`、`RunLineage` |
| 认知 | `IntakeCard`、`QuestionNode`、`QuestionDAG`、`Hypothesis`、`Claim`、`PositionPackage`、`Stage4Record`、`DecisionRecord` |
| 契约 | `PreRegistration`、`MetricsContract`、`InputManifest`、`ControlContract`、`DiscussionDesign`、`Synthesis`、`ScoringPolicyRevision` |
| Harness | `HarnessRevision`、`HarnessComponentRevision`、`CandidatePatch`、`ProbeRun`、`ArchiveNode`、`Population`、`PromotionDecision` |
| 执行 | `ExperimentTask`、`ExecutionAttempt`、`ArtifactManifest`、`Artifact`、`ExperimentResult`、`ReviewReport` |
| 评价 | `EvalPlan`、`EvaluatorIdentity`、`EvalJob`、`EvalRun`、`EvalReport`、`EvalReadReceipt`、`AcceptanceDecision` |
| 记忆 | `MemorySource`、`MemoryProposal`、`MemoryReview`、`MemoryCommit`、`Contradiction`、`Discard` |
| 治理 | `Principal`、`Role`、`Capability`、`PolicyRule`、`ApprovalReceipt`、`StopRule`、`BudgetPolicy`、`DataBoundary`、`AliasRecord`、`Quarantine` |
| 通信 | `RsiCommand`、`RsiReceipt`、`OperationRecord`、`ProjectionCheckpoint` |

### 5.2 五个平面与模块落点

```text
plugins/dsh-rsi-engine/
  package.json              # @local/dsh-rsi-engine, dsh.bundle.patch, exports/files
  cordis.patch.yml          # insert Host 1 行 + 5 个 preset 行
  index.js                  # apply(ctx, config): 组装 Runtime，inject 服务，ctx.effect 停机
  locale/{en,zh}.json
  icon.svg
  src/
    runtime.js              # composition root：只连接，不放规则
    domain.js               # defineDomain spec：表/全局/版本
    store.js                # 单写者、事件账本、幂等、快照
    contracts.js            # Zod schema、hash、freeze、diff
    policy.js               # 状态门、预注册不可变、真实数据、同结论计数、能力矩阵
    resolver.js             # 逻辑引用 → 唯一路径 + hash + authority
    engine.js               # RsiEngine：命令分发、receipt、状态机
    research.js             # Intake/Question/Prereg/Discussion/Stage4/Decision
    evolution.js            # Campaign/Candidate/Probe/Archive/Selector/Promotion
    evaluation.js           # Evaluator broker、EvalJob、report、eval.read
    memory.js               # proposal/review/commit、claim、contradiction
    tools.js                # rsi_* ToolDefinition
    commands.js             # 用户命令（UI 同源）
    listeners.js            # tools/pre-execute、agent/created、domain/changed
    prompts.js              # systemPrompt section/context（短状态，不塞日志）
    projections.js          # sessionProjections 单元（wire + host-only）
    jobs.js                 # 副作用队列、lease、cancel、backoff
    recovery.js             # 启动扫描、orphan/quarantine、reconcile
    presence.js             # 人格/野心评分与报告
    client.js               # 可选 Client half（后置）
```

平面职责：

1. **Invariant Kernel**：`policy.js`、`contracts.js`（hash/freeze）、`evaluation.js` 的隔离部分、`recovery.js`、`store.js` 的单写者与幂等。
2. **Research Plane**：`research.js` + `engine.js` 的研究命令。
3. **Evolution Plane**：`evolution.js` + `presence.js` 的候选/人格/野心耦合。
4. **Evidence/Memory Plane**：`memory.js` + artifact/claim/eval report。
5. **Interaction Plane**：`tools.js`、`commands.js`、`projections.js`、`prompts.js`、`client.js`。

### 5.3 状态机

#### 5.3.1 ResearchRun

```text
CREATED → INTAKE → QUESTION_DAG → PREREG_DRAFT → PREREG_FROZEN
  → DISCUSSION → SYNTHESIS → EXEC_READY → EXECUTING → REVIEW
  → STAGE4 → EVAL → MEMORY → DECISION → CLOSED

旁路：BLOCKED / RECOVERING / DRIFT_DETECTED / ABORTED
```

| From | To | 条件 |
|---|---|---|
| CREATED | INTAKE | root 建 Run，pin preset/policy/scoring v |
| INTAKE | QUESTION_DAG | IntakeCard 完整，对象/边界/意图明确 |
| QUESTION_DAG | PREREG_DRAFT | 至少一个可裁决节点被选中，依赖满足 |
| PREREG_DRAFT | PREREG_FROZEN | `rsi_prereg_freeze`：预测/验收/失败/对照/指标/输入/resource 全部冻结 |
| PREREG_FROZEN | DISCUSSION | DiscussionDesign 已注册且 persona 已 pin |
| DISCUSSION | SYNTHESIS | R0–R3 完成，分歧地图存在 |
| SYNTHESIS | EXEC_READY | Synthesis 报告 + 下一动作 + discussion trace 完整 |
| EXEC_READY | EXECUTING | 派工 manifest 合法；真实数据边界通过 |
| EXECUTING | REVIEW | attempt 完成 + artifact/hash 完整 |
| REVIEW | STAGE4 | ReviewReport 逐项 pass/suspect/fail，关键判据已复核 |
| STAGE4 | EVAL | Stage4Record 完整（解读/追问/认知/决策/野心自省） |
| EVAL | MEMORY | EvalReport 完整 + evaluator identity 可确认 |
| MEMORY | DECISION | MemoryProposal 已 review |
| DECISION | CLOSED | DecisionRecord + eval.read receipt + 无未解决 gate |

非法转移示例：`PREREG_DRAFT → EXECUTING`（跳冻结）、`STAGE4 → CLOSED`（跳 eval）、`EVAL → CLOSED`（无 eval.read）、任何 `→ CLOSED` 时仍有硬失败未记录。

#### 5.3.2 EvolutionCampaign

```text
PROPOSED → PROBING → VERIFYING → EVAL → SELECTED
  → ARCHIVED / PROMOTED / FORKED / QUARANTINED
旁路：REJECTED（保留档案）
```

Campaign 与 Run 解耦：Campaign 可以有多个 candidate、多个 Run 证据；但 promote 必须引用一个明确的 held-out/OOD 评估集与 root/human 决策。

#### 5.3.3 Attempt / Job / Lease

```text
PENDING → LEASED → RUNNING → RETURNED → VERIFIED → ACCEPTED | REJECTED | ORPHANED
Job：queued → running → done | failed | cancelled | lost
Lease：granted(ttl) → renewed → expired → reclaimed
```

规则：`eval.started` 即占预算坑；失败不退款；`lease.expired` 先 stop/reconcile，不自动重试外部副作用；半成品 artifact → quarantine。

### 5.4 真相源与 Domain/Session 桥

#### 5.4.1 事实分层

| 层 | 事实 | 谁可写 | 模型可见 |
|---|---|---|---|
| Session log | 模型实际看到的 user/assistant/tool/命令事件 | DSH runtime（标准事件） | 是 |
| Domain | 跨 Session 的 Run/Campaign/契约/receipt/artifact 索引/alias/lease | Host service（单写者） | 仅通过工具结果摘要 |
| Projection | 从 Session 事件折叠的 per-session 读模型 | `sessionProjections` | 通过 UI/上下文 |
| Markdown | 导出/兼容投影 | 导出器 | 不作为事实 |

禁止：对非 experimental 包 `appendPluginRecord()`；发明新 Session event type；让 Client 折叠日志；把 Domain 当模型隐形状态。

#### 5.4.2 命令管道

```text
Command（tool / user command / UI）
  → PolicyGate（状态、契约、能力、数据边界、预算）
  → idempotency lookup（(runId, commandId)）
  → single-writer op（expectedVersion 校验）
  → Domain put（intent → commit）
  → RsiReceipt（applied | replayed | denied | ask | conflict | unknown）
  → 正常 tool/result 或 command/done（模型/用户可见）
  → session.flush()（关键提交后）
```

铁律：

1. 每个 Domain mutation 必须由一个可归属的 command 发起，并返回 receipt。
2. 模型可见的成功只能是 receipt `applied` 且 tool result 已提交；`unknown` 必须如实显示。
3. Domain 已耐久、Session 未耐久 → `visibility-pending`，不得声称模型已知。
4. Session 已耐久、Domain 未确认 → `unknown`，不得自然语言宣布成功。
5. 关键 command 后调用 `ctx.sessions.flush(session)`（具体插件侧触发点待实现期验证）。
6. 重启后以 operation record + receipt + aggregate hash 对账，不猜状态。

#### 5.4.3 不能提供的保证

`storageDomain` 无跨表/跨域事务、无原生 CAS、无 append-only 事件流。因此：

- 用进程内 per-aggregate 单写者队列 + `expectedVersion` + deterministic transition 补齐。
- `KvTable.update` 是回调更新，不是跨请求 CAS，不能对外宣称 CAS。
- 崩溃发生在多条 `put` 之间 → 恢复为 `committing | reconciled | quarantined`，绝不报告成功。
- 外部副作用（实验进程、文件写入、网络）不能靠 Domain 回滚；用 idempotency key、lease、artifact hash 和人工确认。

### 5.5 并发、租约与恢复

- 单写者粒度：`runId`、`campaignId`、`candidateId`；跨粒度通过 receipt 引用，不共享可变字段。
- 每个执行 Attempt 独立 workspace/artifact dir + lease + cancel token；Session 可复用，Attempt 必须独立。
- root Session 保持短步：只判断/派发/收件，不等待长任务；长任务交 worker Session 或外部 job。
- 并发上限按 `Project + Run + Campaign` 分层记账（worker 数、token、wall-clock、磁盘、GPU）。
- 启动扫描：`committing`、`visibility-pending`、`lease expired`、`job lost` → 按类型 reconcile/stop/quarantine。
- 取消：用户 cancel 先写 intent，再 stop job，再等 worker 退出，最后写 `cancelled`；不在取消未完成时报告已停止。
- 孤儿：`ORPHANED` 必须可见，不能静默删除；由 root 决定 retry（同契约）或新 Run。

### 5.6 版本与 pin

Run 创建时 pin：

```text
pluginRevision, domainSchemaVersion, contractVersion, policyRevision,
scoringPolicyRevision, presetRevision, wireVersion, dataManifestHash,
evaluatorIdentityHash, hiddenManifestHash
```

规则：

- live Agent 钉死加入时的 preset revision；运行中切 preset = 新 Run。
- 改 policy/scoring/evaluator = 新 revision，不改写旧事件。
- UI 显示版本矩阵；`stale/conflict` 时禁止危险提交。
- Domain 版本不兼容时 fail closed，备份或拒绝打开，不静默迁移。

---

## 6. 通信管道（Q3）

### 6.1 六条链路

```text
1) Client UI ↔ Host service/command
2) Agent tool ↔ Host operation
3) Host operation ↔ storageDomain
4) Session log ↔ projection
5) worker/subagent Session ↔ main Session
6) evaluator broker ↔ Run
```

#### 链路 1：UI ↔ Host

```text
UI read → authenticated RPC/fetch → rsiEngine.readSnapshot()
        → Domain + projection → RsiSnapshotEnvelope（含版本/as-of）
UI action → command {commandId, idempotencyKey, expectedVersion}
        → PolicyGate + approval → 单写者 → receipt → refetch/invalidate
```

- 按钮状态不是授权；Host 每次重验 actor/capability/state/contract hash。
- Client 可显示 `accepted/in-progress`；只有 Domain durable + 必要 flush 后才显示 `committed`。
- 断线重连先取新快照，比较版本；落后标 `stale`，版本回退/契约不符标 `conflict`。

#### 链路 2：Agent tool ↔ Host operation

```text
model tool/call（标准事件）
  → tools/pre-execute（fail-closed deny/ask）
  → tools.guard（单调、同步）
  → rsiEngine.execute(actor=agent, sessionId, args)
  → PolicyGate → 单写者 → Domain
  → structured ToolExecutionResult
  → 标准 tool/result 事件
  → flush
```

工具结果必须是有界结构：

```ts
{ receiptId, status, runState, gate: {missingContracts, blockers},
  nextAction, refs: {artifacts, contracts, events}, failureCode?, retry? }
```

不要返回整份日志/整张 DAG；需要细节时由模型再调用 `rsi_gate`/`rsi_resolve` 读取。

#### 链路 3：Host ↔ Domain

见 §5.4。补充：写链顺序由 `domain/changed` 保证；但它是通知流，不是事务确认；receipt 才是命令结果。

#### 链路 4：Session ↔ projection

```text
Session.append(event) → session/event → projection.apply(state,event)
  → onChanged → Client view
```

- Projection 只从 Session 事件派生；`snapshot` 给出 `asOfSeq`；`cachedSnapshot` 只作 hint。
- Domain 事实不得偷偷注入 projection；如需模型看到，必须走标准 tool result。
- wire 单元必须 `viewSchema` 校验；`stateVersion` 变化 → 冷恢复重折。

#### 链路 5：worker/subagent ↔ main

```text
main → subagents.startActivation({parent, request, delivery})
     → child Agent/Session（独立 preset revision/log）
     → child 结果/artifact/structured output
     → 受支持的消息投递或 tool result 引用
main 通过 listChildren/waitForChildren/interrupt 管理
```

child 只拥有授权 scope/manifest；main 不得读取 child 未授权日志作为自己的事实。结果以 artifact/evidence ref 汇入 Run，不能用内存共享替代 receipt。

#### 链路 6：evaluator broker ↔ Run

```text
gate passed → broker 创建 EvalJob + lease + immutable manifest
  → independent evaluator（只读）→ machine/independent report
  → broker 校验 provenance/schema → Domain EvalReport
  → root/user 读取并产生 eval.read receipt
```

evaluator 不能写 candidate/prereg/permissions/stop/hidden/memory；身份/输入 hash 不可确认 → `unknown/quarantined`。

### 6.2 命令与回执

```ts
interface RsiCommand {
  commandId: string;
  requestId: string;
  idempotencyKey: string;
  causationId?: string;
  correlationId: string;
  actor: { kind: 'user' | 'root' | 'agent' | 'worker' | 'evaluator'; id: string };
  sessionId?: string;
  runId?: string;
  campaignId?: string;
  expectedDomainVersion?: number;
  expectedStateVersion?: number;
  contractVersion: string;
  presetRevision?: string;
  wireVersion: number;
  payload: JsonValue;
  evidenceRefs?: string[];
  createdAt: number;
}

interface RsiReceipt {
  commandId: string;
  idempotencyKey: string;
  status: 'accepted' | 'needs-approval' | 'in-progress' | 'committed'
        | 'rejected' | 'failed' | 'unknown' | 'quarantined';
  reasonCode?: string;
  newDomainVersion?: number;
  newStateVersion?: number;
  domainEventRefs?: string[];
  sessionEventRefs?: number[];
  retry: 'none' | 'safe' | 'manual';
  nextAction?: string;
}
```

规则：

- 同一 `(runId, commandId)` 幂等；重复命令返回原 receipt，不重复副作用。
- `expectedVersion` 不匹配 → `conflict`，Client refetch 后由用户重新确认，不静默覆盖。
- `retry=safe` 只用于只读/可幂等操作；外部副作用只能 `manual` 或 broker 证明幂等。
- 版本分开：Session `seq`、projection `stateVersion`、Domain `domainVersion`、wire `wireVersion`、plugin/preset revision。

### 6.3 事件使用

只用已存在的 Host 事件与标准 Session 事件，不自造 Session event type：

- `tools/pre-execute`：实验/晋升/权限类工具 fail-closed。
- `tools/post-execute`：可 enrich/allow/deny，但不作为唯一门。
- `agent/created`：把每 agent 的 disposer 挂到 plugin `ctx.effect`。
- `agent/pre-step`：仅在需要时拒绝 step 或注入短提醒；必须保留 `{...decision, messages}`。
- `session/event`：观察，不依赖其失败；`session/flush`：关键持久化检查点。
- `domain/changed`：通知/失效，不是事务确认。
- `subagent/start|end`：维护 Run ↔ child 关系。

自定义 Host 事件/`ctx.on` 的准确声明方式待实现期 Inspect；在此之前优先复用 domain/projection 通知，不新增事件流。

### 6.4 失败语义

| 现象 | 含义 | 处理 |
|---|---|---|
| timeout | 结果未知 | `unknown`；先查 artifact/hash，再决定 safe retry 或人工 |
| 崩溃在 Domain 多写之间 | 部分提交 | `committing` → reconcile/quarantine；不报成功 |
| 重复 tool call | 幂等 | 返回原 receipt，不重复执行 |
| Domain version 冲突 | 并发写 | `conflict`；refetch；用户确认 |
| UI 断线 | 快照过期 | `reconnecting/stale`；重连取新快照 |
| Session 未 flush | 模型可见性未定 | `visibility-pending`；不宣称已告知 |
| evaluator 不可确认 | 身份/输入不明 | `unknown`，不 promotion |
| lease 过期 | 执行者失联 | stop → reconcile → `orphaned` |
| artifact 半成品 | 不完整 | `quarantined`，不晋升 |

---

## 7. 可视化界面（Q3）

### 7.1 入口与导航

已 live Inspect 的 slot 证据（Client 查询本轮超时，下列为此前同会话成功结果，具体 callback/props 待重连后复核）：

| 位置 | 类型 | 注册字段 | 用途 |
|---|---|---|---|
| `sidebar.panellist` | list, root | `id, order?, label?`；icon props `{size, active}` | RSI 全局入口，id=`rsi` |
| `main` | keyed, root | `key` | 主控制台，key=`rsi` |
| `conversation.composer.dock` | list, session | `id, order?, label?` | 当前 Run 的 gate/下一动作摘要 |
| `conversation.chat.node` | keyed, session | 固定 ChatNodeKind 域 | 只在受支持时显示 operation card；不新增事件类型 |
| `settings.section` | list, root | `id, order?, label?` | 设置/兼容性 |

导航：sidebar `rsi` → `main[rsi]` → Run List / Control Tower；深链 `projectId/runId/view`（router API 待 Inspect）；面包屑 `Project / Run / Campaign / View`；刷新从 Host snapshot 重建。

**不替换** shipped `root`/`main` shell；additive 注册。

### 7.2 页面地图

| 页面 | read model | 主要命令 | 关键状态 |
|---|---|---|---|
| Run List | `rsi.run-list.v1` | create/fork/resume/archive | loading/stale/blocked/read-only |
| Control Tower | `rsi.control-tower.v1` | pause/cancel/reconcile/next | running/approval/blocked/conflict/quarantined |
| Intake/Question DAG | `rsi.question-dag.v1` | add node/mark ready/pivot/redefine | pending/ready/running/refine/unresolved |
| Pre-registration | `rsi.prereg.v1` | validate/freeze/fork | draft/frozen/conflict/read-only |
| Discussion | `rsi.discussion.v1` | dispatch/synthesize | running/blocked/stale |
| Experiment | `rsi.experiment.v1` | dispatch/cancel/retry-safe/inspect | approval/running/failed/orphaned/quarantined |
| Candidate/Lineage | `rsi.lineage.v1` | propose/probe/compare/archive/fork/promote | candidate/held-out/approval/quarantine/read-only |
| Evaluation Lab | `rsi.eval.v1` | start/read/ack | running/unknown/failed/independent/read-only |
| Memory/Decision | `rsi.memory.v1` | propose/review/commit/deepen-pivot-stop | draft/approval/committed/blocked |
| Audit/Export | `rsi.audit.v1` | verify chain/export/reconcile | loading/stale/conflict/quarantined |
| Settings/Compatibility | `rsi.compat.v1` | select preset/config budgets/inspect versions | approval/blocked/conflict/read-only |

统一 envelope：

```ts
interface RsiSnapshotEnvelope<T> {
  readModelKey: string;
  wireVersion: number;
  stateVersion: number;
  asOfSessionSeq?: number;
  asOfDomainVersion: number;
  generatedAt: number;
  freshness: 'fresh' | 'stale' | 'reconnecting' | 'unknown';
  data: T;
  blockers: Blocker[];
  availableCommands: CommandAvailability[];
  receiptRefs: string[];
  evidenceRefs: string[];
}
```

### 7.3 关键页面

**Control Tower**：左侧 Run state + gate blockers + 版本矩阵；中心 Research/Evolution 双轨时间线；右侧 next legal action、预算、lease、审批、hash。时间线来自 Domain read model，不在 Client 折叠 Session。

**Intake/Question DAG**：节点显示可证伪边界、完成条件、依赖、证据数、野心五维；边只表示真实依赖；`refine/unresolved` 必须可见。

**Pre-registration**：draft 可编辑；frozen 显示 hash + 全量 diff；frozen 后只有 Fork/New Run，不显示 save；结果后修改入口不存在。

**Discussion**：立场矩阵按 role/claim/evidence/confidence/self_weakness 展示；分歧地图、存活分歧、少数派、`design_update_trace` 可见；不显示“多数通过”。

**Experiment**：manifest、真实 EA/模拟分栏、seed/split/command/dependency/hardware、attempt/job/lease、artifact hash；closed-loop 下 simulation substitute 硬阻断并解释原因。

**Candidate/Lineage**：父子 revision、atomic diff、probe/full/OOD/regression/cost、promotion/rejection/quarantine；优先 DOM/SVG（可聚焦、可选中、可表格替代），大图才 canvas，且必须有等价列表。

**Evaluation Lab**：machine verifier / independent evaluator / root-human 三列；evaluator identity、held-out refs、corruption signals、`eval.read` receipt；缺 receipt 不显示“已采纳”。

**Memory/Decision**：proposal 与 committed 分离；claim→evidence、矛盾、Stage4、DecisionRecord diff；Markdown 是 export；只有 root/user 能 commit。

**Audit/Export**：command/receipt/domain event/session ref 时间线；可展开 hash/version/correlation/causation；显示 unknown/reconcile/quarantine，不隐藏失败；导出本身是新 artifact。

### 7.4 实时性、审批、长任务

- 初始：Host authoritative snapshot。
- 变化：优先 `sessionProjections.onChanged`（Session wire）+ Domain invalidation → refetch；Domain→Client stream 待 Inspect，未确认前用 bounded polling。
- 长任务：节流快照/轮询；worker 日志不逐条进 Session；只有 milestone 进 evidence/receipt。
- 审批：`approval.request` 写入请求 Session；UI 显示 actor/risk/expiry/diff；answer API 待 Inspect。
- 通知：toast/banner 只做提醒；blocked/quarantined/unknown 必须页面内持久可见。
- 重连：保留最后快照并标 `reconnecting`；恢复后带 last seen versions 重读；不自动重放危险命令。

### 7.5 可访问性与主题

- 只使用 `--dsw-alias-*` 与 `--dsw-specific-sidebar-fill` token，且同时提供 light/dark；不写死颜色作为主样式。
- 状态不能只靠颜色：文本 + 图标 + `aria-label`；error/warn/success 保留形状区别。
- 键盘：sidebar/breadcrumb/tabs/DAG/lineage/diff/approval/buttons 可 Tab；箭头同组导航；Enter 打开/执行；Space 切换；Esc 关闭；焦点在命令完成/拒绝后回到触发控件。
- 图表必须有表格/列表替代，图标按钮要有可见 tooltip 与 accessible name。

### 7.6 Client 禁止事项

1. 直接调用 `storageDomain` 或写 Domain。
2. 在浏览器折叠 Session log 成权威状态。
3. 持有可写 Run/Gate/Candidate/Evaluator 状态。
4. 自行判断 actor/capability/approval/gate，或相信旧按钮 enabled。
5. 自造 Session event type、伪造 tool result、把 UI 文本写成 claim。
6. 把 Domain event 当 Session event，把 projection cache 当最新事实。
7. stale/conflict 时静默覆盖、自动重放危险操作、假装回滚 append-only 事实。
8. 绕过 Command Router 直接运行 worker/evaluator/读 hidden set/提交 memory。
9. 把诊断、部分分数、自评包装为成功。
10. 依赖未 Inspect 的 Client service/router/props/wire/Remote。

## 8. Q19 运行手册

### 8.1 对象与边界

- 真实 EA：12 细胞系、约 88 万对、带 score、`.pre_cache`；只作为**训练/挖掘数据**。
- BENGI IMR90：唯一可信隔离评估集；**只 eval，不训练**；不得用于调参或选模。
- BENGI 模拟 EA：只能做工具/灵敏度 probe；在 `research-closed-loop` 中替代真实 EA = 硬拒绝。
- 12 系其他系 AUPR 因重采样偏高，禁用为验收；与 IMR90 之外的口径不得进入验收报告。

### 8.2 冻结契约（结果前）

`PreRegistration` 至少包含：

```text
intent / question / object
prediction（方向 + 数字 + 时间）
acceptance（可测判据；G1/G3 等）
acceptable_failure（证据否定时接受什么）
controls（打乱/交叉重配/种植标定/标签打乱，按需）
metrics_contract（主指标/次指标/聚合/阈值/CI/seed）
input_manifest（EA 身份/12 系/样本数/score/.pre_cache hash+schema/split/transform/normalization）
data_boundary（真实 EA 与 BENGI 物理路径/只读/eval-only）
resource_budget（wall-clock/内存/GPU/磁盘/token/并发）
stop_rules（时间/预算/连续失败/同结论两次）
prereg_hash + policy_hash + scoring_hash + evaluator_hash
```

任何字段在结果后修改 → `prereg.violation` + 新 Run；旧 Run 冻结，不“重算成部分通过”。

### 8.3 执行门序列

```text
1. Run 存在且 pin 版本完整
2. Intake/Question 合法（可证伪边界 + 完成条件）
3. prereg.frozen + metrics.frozen
4. input manifest hash 校验，真实 EA 路径与只读边界
5. 对照/资源/停止规则冻结
6. 派工：coding worker（sandbox，worktree 可写、archive/held-out 只读）
7. review：关键判据逐项复核（数字/对照/显著性/假阳性/泄漏）
8. Stage4：root 亲写解读/追问/认知/决策/野心自省
9. 独立 eval：evaluator 只读 frozen + candidate + held-out
10. eval.read receipt → memory proposal → decision
```

缺少任一前置 → `rsi_gate` 返回 `blockers[]` 与 `nextAction`，工具层 deny，不靠提示词。

### 8.4 验收与失败

- 验收必须显式 `pass | suspect | fail`；硬失败非补偿；禁止“成立但平凡/诚实图景/部分通过”。
- 中间信号真实 ≠ 下游兑现（错误链 13）；必须分别报告。
- 同结论第二次 → `DRIFT_DETECTED`：深化/转向/重定义/停止，四者之一并留痕。
- 模拟结果不得写入 Q19 验收；只能写“工具灵敏度/机制 probe”。
- 报告必须同时给：目标差、根因、剩余路径、成本、失败证据。

### 8.5 自动化边界

| 可自动 | 必须 root/human |
|---|---|
| resolver/hash/schema 校验 | 选疑惑、验收语义 |
| 生成 DAG/查询/立场草案 | Stage4 解读与决策 |
| 派工、跑实验、机械对照 | 矛盾语义裁决 |
| 机械 eval 格式分 | 长期记忆 commit |
| 同结论计数、状态投影 | 放宽数据/指标/资源/对照 |
| 有限重试/恢复 | 切 preset、L2/L3、promotion 语义确认 |

---

## 9. 权限、安全、预算、隐私

### 9.1 Actor 与能力

当前 DSH `connection` 的 PrincipalMap 只暴露 `owner`；**没有多用户 principal**。因此 RSI 的角色是同一 owner 下的不同 actor 身份 + 工具/目录/审批约束，不是 RBAC 多租户。

| Actor | 可读 | 可写 | 禁止 |
|---|---|---|---|
| user/owner | 全部（含审批） | 审批、memory commit、policy/preset、promotion 确认 | 绕过 evaluator 直接改历史 |
| root | Run/契约/报告/候选 | Run 状态、Stage4、decision、派工、resolve alias | 改 evaluator、伪造 eval.read、直接写权威记忆 |
| coding worker | 授权 manifest/artifact | sandbox worktree、artifact、attempt 结果 | 读 held-out/hidden、改 prereg/evaluator/权限、写主代码 |
| reviewer | 预注册 + 关键 artifact | review report | 重跑全实验、改代码/契约 |
| evaluator | frozen manifest/candidate/held-out | eval report（只读候选） | 写 candidate/prereg/permissions/stop/memory |
| memory agent | 痕迹/claim | memory proposal | 直接 commit 权威记忆 |
| audit | 全部只读 | audit report | 改任何状态 |
| ui | snapshot | 与 user 相同命令面 | 直接写 Domain、绕过 PolicyGate |

### 9.2 不可自改清单

`evaluator`、`stop rules`、`permissions/capabilities`、`approval policy`、`data boundary/splits`、`audit/telemetry`、`hidden tests`、`long-term memory commit`、`resolver integrity`、`budget enforcement`、`kill switch`、`security/network/secret policy`。

### 9.3 沙箱与路径

- 每候选/每 attempt 独立 worktree + artifact dir；archive/held-out 只读挂载。
- 实验进程去 sudo、去 baked secrets、网络默认 none；需要网络时显式 capability。
- 禁止 rw 挂载整库；路径白名单 + realpath 校验，防止 `..`/符号链接逃逸。
- 隐藏测试与 held-out 路径不进入候选可写树；evaluator 通过 broker 读取。
- `tools.guard` 是同步应用层拒绝，不是文件系统安全边界；真正隔离靠 sandbox/权限。

### 9.4 预算与停止

预算维度：token、wall-clock、CPU/GPU、内存、磁盘、并发、agent 深度、搜索 query 数、评估次数。

- 预算先预留后消费；`eval.started` 即占坑；失败不退款。
- 停止规则：预算耗尽、连续 N 次失败、同结论两次、硬门反复失败、用户 kill switch。
- 系统 nudge/提醒不得刷新 stuck 计数；只有真实新证据/新动作才重置。

### 9.5 隐私与数据

- EA 数据只读、最小暴露；artifact 中不写原始序列/PII；日志与导出做 redaction。
- secret 不进候选 worktree/镜像/报告；credential 只用 DSH credentials 服务。
- 导出撤回：新 artifact 标记 superseded/revoked，不物理回滚 append-only 事实。
- 跨项目数据不得混入 Q19；模拟数据必须带 `simulation=true` 标记与独立目录。

---

## 10. 兼容、版本与演进

- 版本对象：plugin/bundle revision、domain schema version、contract version、policy revision、scoring revision、preset revision、wire version、data manifest hash、evaluator identity、hidden manifest hash。
- Run 创建时 pin；live Agent 钉 preset revision；切 preset/改 policy = 新 Run。
- Domain schema 升级：`compatibleVersions` 白名单；不兼容时 fail closed + 备份，不静默迁移。
- Projection `stateVersion` 不匹配 → 从 checkpoint 失效重折；`restore` 检测日志缩短。
- Client wire 版本不匹配 → 只读/降级，不静默丢字段。
- 路径 alias：resolver 记录 `requested_path / resolved_path / realpath / sha256 / schema / method`；零匹配或多匹配 → `BLOCKED`，不问模型猜。
- 旧路径只作 alias：`docs/enhanceratlas/todo/*`、`docs/enhanceratlas/plan/02*`、`/home/z/CBAT-W/PRISM/...`。
- HMR/升级：插件重载后旧 Session 仍用旧 revision；新 Run 用新 revision；状态迁移写 `CompatibilityRecord`。
- 卸载：注销 tools/commands/projection/slot，清理 lease/job，不删除历史 artifact。

---

## 11. 问题分层（Q3/Q4）

### 11.1 必须现在想清楚（做错会污染全部后续）

1. **真相桥与崩溃语义**：谁能写、写后谁可见、崩溃落到什么状态、如何 reconcile。
2. **预注册门与数据边界**：没有冻结契约不能执行；真实 EA 与模拟物理隔离；held-out 不可读写。
3. **评估器隔离**：身份、输入、hidden set 可确认；eval.read 是行为；不可自证。
4. **actor/capability/approval 矩阵**：每个命令的 actor、capability、是否需要人。
5. **硬门非补偿**：先门后分；失败码枚举完整；拒绝也留档。
6. **人格生成与同质化度量**：topic binding、R0 隔离、D 指标、人格通胀判定、少数派保留。
7. **野心评分协议与反作弊**：五维词典、A_p/E/A_d/A_final、阈值、行为锚、通胀检测。
8. **候选晋升判据**：硬门表、档案策略、谱系选择、OOD/regression/成本。
9. **Q19 契约**：manifest 字段、G1/G3、IMMR90-only、失败语义、报告格式。
10. **版本 pin 与兼容**：Run 上钉什么、schema 升级、alias、旧 Session 行为。
11. **UI 读模型一致性**：asOf、stale/conflict/reconnect、审批语义、不可折叠日志。
12. **形式完成检测**：receipt 必须绑 artifact/hash；每个阶段的最小可检查产物；防“流程正确但没有内容”。

### 11.2 重要但可后置

- 完整 Client 交互与美观；Domain→Client stream；router/深链；canvas 大图。
- 多视角 evaluator focus、统计校准、e-process/FWER（当前不宣称）。
- L2 自改沙箱、L3 meta 演进。
- 跨项目 Harness 模板库、外部协作、通知集成。
- 成本/模型路由优化、缓存、异步并行度调优。
- i18n 扩展、主题定制、移动端。
- 与旧 Markdown 工作流的双向同步（只做单向 export/import）。
- 历史数据集迁移、旧 round 批量导入。

### 11.3 明确不重要 / 不做

- 权重训练、数据递归、L5。
- 独立第二运行时、私有数据库、JSON-RPC 作为事实层。
- 多用户 RBAC/组织权限（当前只有 owner）。
- CRDT/多端合并/离线编辑。
- Chat 自定义 Session event type、在 Client 重放日志。
- 把 Markdown 当权威真相、用 UI 文案宣告科学成功。
- 追求“完整 RSI 理论证明/统计证书”而不实现保护层。
- 花式动画、装饰性可视化、营销页。
- 以论文 benchmark 数字作为本插件验收。

---

## 12. 验收：假实验与对抗测试

在接 Q19 前必须全部通过；每条都要有会变红的测试。

| # | 场景 | 期望 |
|---|---|---|
| 1 | 无 prereg 调实验工具 | `deny`，留拒绝事件，gate 说明缺哪份契约 |
| 2 | 冻结后改验收/指标 | `prereg.violation`，不覆盖旧契约，要求新 Run |
| 3 | closed-loop 用 BENGI 模拟替代真实 EA | 硬拒绝，错误码可读 |
| 4 | 候选 diff 触碰 evaluator/stop/permissions/hidden | `FORBIDDEN_BOUNDARY_EDIT`，quarantine |
| 5 | 候选删除检测 marker/绕过检查 | 分数作废，quarantine，审计留痕 |
| 6 | 重复同一 command | 返回原 receipt，不重复副作用 |
| 7 | 崩溃在 Domain 多写之间 | 重启后 `committing` 对账，不报成功 |
| 8 | lease 过期/job 失联 | `orphaned`，可见，需 root 决定 |
| 9 | 结果后修改 memory 直接 commit | 拒绝；只能 proposal |
| 10 | evaluator 未读报告就 close | `EVAL_NOT_READ` |
| 11 | UI stale 后提交危险命令 | `conflict`，要求刷新/确认 |
| 12 | 人格同质化（R0 无新证据收敛） | 同质化警告，禁止合成 |
| 13 | 野心自报 1.0 但无 artifact | `ambition.inflation`，按独立分，阻断 |
| 14 | 同结论连续两次 | `DRIFT_DETECTED`，必须 pivot/stop |
| 15 | 越权读 held-out/hidden | 拒绝 + 审计 |
| 16 | artifact hash 与 manifest 不符 | `quarantined`，不晋升 |
| 17 | 未审批 promote default harness | `needs-approval`，不执行 |
| 18 | Domain/Client 版本不匹配 | 只读/拒绝，不静默迁移 |

通过标准：所有拒绝可解释、可审计、可复现；无“静默成功”；无“模型自报即通过”；崩溃/重复/并发下无重复副作用。

---

## 13. 实施顺序（完整系统的依赖顺序）

不是砍功能，而是让后一层依赖前一层已冻结的契约。

**A. Kernel 与契约（无 UI）**
domain schema、contracts/hash/freeze、resolver、policy、store 单写者、receipt/idempotency、recovery 扫描、`rsi_gate`/`rsi_resolve`。

**B. Research Plane**
Intake、Question DAG、PreRegistration、Discussion（persona + 评分）、Stage4、Decision；`rsi_start`/`rsi_prereg_freeze`/`rsi_record`。

**C. Evidence/Eval/Memory**
artifact manifest、review report、evaluator broker、eval.read、memory proposal/commit、claim/contradiction。

**D. Evolution Plane**
HarnessRevision、CandidatePatch、probe、archive/lineage、独立 eval、selector、promotion/fork/quarantine。

**E. Presets 与提示**
5 个 preset：`rsi-research-closed-loop`、`rsi-exploratory-search`、`rsi-falsification-pivot`、`rsi-engineering-validation`、`rsi-integrity-audit`；root/coding/review/eval 工具 allow-list；persona 文本；默认预算。

**F. Client 控制台**
Run List、Control Tower、Pre-reg、Discussion、Experiment、Lineage、Eval、Memory、Audit、Settings；先 stale/conflict/approval/read-only，再美化。

**G. Q19 真实运行**
冻结 manifest → 真实 EA 训练 → BENGI IMR90 eval → Stage4 → 独立 eval → decision；全程按 §8。

每阶段 exit gate：假实验对应项通过 + 崩溃/重复/并发测试 + 版本 pin 验证 + 无未解释的 `unknown`。

---

## 14. 仍需用户裁决

1. **O/R/G/H/P 原始释义**：源文件只有字母与样例。本设计采用版本化工程词典（Object/Reality/Generativity/Horizon/Persistence）；若你有原始定义，替换词典并升 `ScoringPolicyRevision`。
2. **L2 代码自改**是否在第一版开启（默认关闭）。
3. **root persona 是否允许进入 Harness 演化**（默认：可演化但需 user approval + 新 Campaign）。
4. **Q19 验收阈值**是否仍为 G1 ≥0.55 / G3 跨系保留 ≥90% / 对随机 HMCS +0.12；以及 IMR90 唯一口径。
5. **UI 优先级**：先 Control Tower 还是先 Pre-reg/Experiment。
6. **单写者粒度**：按 Run 还是按 Project（默认 Run + Campaign 两级）。
7. **是否把 `rsiEngine` 暴露为 Host service** 给周边插件（默认只读快照 + 命令面）。
8. **预算具体数值**：token/wall-clock/并发/磁盘上限（默认从 Config 读，不写死）。
9. **是否允许外部 runner 回调**（HTTP callback / broker socket）以及其认证方式。
10. **旧 Markdown 是否要 import**（默认只 export，不 import）。

---

## 附录 A：术语

| 术语 | 含义 |
|---|---|
| ResearchRun | 一个科学问题的完整闭环，不等于 Session |
| EvolutionCampaign | 一次 Harness 候选搜索/评估/晋升周期 |
| Kernel | 不可被候选修改的治理层 |
| PreRegistration | 预测/验收/失败/对照/指标/输入/资源的冻结契约 |
| PersonaRevision | 可审计的讨论主体配置（症状/圣状/立场/证据标准/盲点） |
| QuestionAmbition | 问题层五维野心 |
| RoundAmbition | 整轮兑现层野心 |
| CandidatePatch | 带组件标签、假设、成本、风险的原子 diff |
| Receipt | 命令结果（applied/replayed/denied/ask/conflict/unknown） |
| eval.read | root/human 实际读过评估报告的显式 receipt |
| quarantine | 可疑/不完整结果隔离，不等于失败结论 |
| drift | 同结论重复或方向漂移，必须转向 |

## 附录 B：关键 schema 摘要

```ts
interface QuestionAmbition {
  questionId: string; runId: string; vocabularyVersion: string;
  dimensions: { O: number; R: number; G: number; H: number; P_plan: number };
  rationaleRefs: string[];
  scorer: 'machine' | 'evaluator' | 'root';
  policyHash: string; contentHash: string; frozenAt?: string;
}

interface AmbitionReport {
  scope: 'question' | 'stage4' | 'round';
  A_p: number; evidenceClosure: number; actionCompletion: number;
  decisionUpdate: number; auditIntegrity: number; A_d: number;
  selfReport?: number; independentScore: number; inflationFlag: boolean;
  gapBefore?: number; gapAfter?: number; progressRefs: string[];
  corruptionFlags: string[]; scorerId: string; policyHash: string;
}

interface EvaluatorIdentity {
  evaluatorId: string; revision: number; focus: string[];
  immutablePolicyHash: string; readOnly: true; hiddenTestManifestHash: string;
}
```

## 附录 C：参考系→平面速查

| 参考 | 平面 | 关键落点 |
|---|---|---|
| Harness² | Evolution | 组件 ontology、experience 三元组、Propose–Probe–Compose |
| RRSI | Kernel/Evolution | 噪声地板、edit budget、泄漏 critic、成本非补偿、OOD 事后 |
| DGM | Evolution | patch/archive/lineage/sandbox、hacking 反例 |
| SICA | Execution | worktree 分离、CI lower bound、双 timeout、secret 教训 |
| HGM | Evolution | clade 统计、expand/eval 解耦、Thompson |
| HyperAgents | 远期 | task/meta 分离；默认 deny meta 自改 |
| SGM | Kernel | propose/confirm/commit、冻结、预算预留 |
| Co-Scientist | Research | 问题 DAG、异质讨论、人工采纳 |
| superagent | Interaction | bundle 分层、单写者、effects、preset、worker Session、面板 |
| org 02/04 | Research/Evidence | 对象共识、错误链、被否定叙事、Q19 数据锚 |

## 附录 D：旧工作流 → 新对象

| 旧环节/文件 | 新对象 |
|---|---|
| `01_工作流极简清单` ①–⑦ | ResearchRun 状态机 + tool 命令 |
| `state/round_XX.md` | `ResearchRun` + 各 stage 记录（Markdown 仅 export） |
| `state/eval_*.md` | `EvalReport` + `EvalReadReceipt` |
| `state/open_questions.md` | `QuestionNode` 活跃集合 |
| `plan/02` | 权威记忆 artifact + `MemoryCommit`（只经 proposal/review） |
| `plan/04` | `ExperimentResult`/`Claim`/`Contradiction` |
| `agents/swarm/*` | persona 生成/讨论/合成（preset + 契约） |
| `agents/validate/*` | coding/review worker（sandbox + 只读 review） |
| `agents/eval/*` | evaluator broker + `EvaluatorIdentity` |
| `agents/memory/*` | memory proposal + audit policy |

## 附录 E：Inspect 证据状态

已核实（Host）：`tools.register/restrict/guard/execute`、`ToolDefinition`、`tools/pre-execute` waterfall、`commands.register/execute`、`storageDomain.open/KvTable`、`sessionProjections` 全方法、`approval.request`、`subagents.*`、`agentPresets.*`、`systemPrompt.*`、`connection.rpc/fetch` 形状、`session/event`、`session/flush`、`domain/changed`、`agent/pre-step`、`subagent/start|end`。

此前核实（Client，本轮超时）：`sidebar.panellist`、`main`、`conversation.composer.dock`、`conversation.chat.node`、`settings.section` 的 kind/scope/registration；theme token 名称。

待实现前重新 Inspect：Client remote/props/router/wire/toast、自定义 Host service 注册方式、自定义 Host event 声明、`Session.flush` 的插件侧触发点、Domain backend route 与并发保证、projection 类型扩展、`connection` principal/auth 映射、SVG/canvas 渲染约定。

> 本文件是设计定稿，不是安装记录；`plugins/dsh-rsi-engine/` 尚未创建，profile 未改动。
