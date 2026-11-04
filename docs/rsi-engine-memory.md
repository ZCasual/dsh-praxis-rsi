# RSI Engine 实现记忆（压缩上下文后接着干）

> 写于 2026-11-02。这是后续完整实现 plugin 的权威工作记忆，不是再调研。
> 长报告：`docs/rsi-engine-research-report.md`
> 检索账本：`.search-ledger.md`
> DSH 实践摘录：`.dsh-research/references/`
> 现有提示词 RSI：`todo/`

压缩上下文后：**先读本文件，再读报告第 4–6 节，不要重做学术调研。**

---

## 0. 任务是什么

把早期基于 pi / 提示词的 RSI（`todo/`）做成 **DSH Host plugin + 若干 agent preset**。

不是：
- 再写一套总提示词
- 做权重级 / 无约束 RSI
- 另起运行时

是：
- 把现有铁律变成**不可被模型改写的门禁**
- 现有 `todo/agents/*.md` 变成**受限执行器**
- 模式变成 **preset**
- Markdown（`round_XX.md` 等）变成**投影**，不是真相源

宣称层级只做 **L1 脚手架 RSI**（改工具/prompt/记忆/编排/实验闭环）。禁止把 benchmark 分数说成“自身变聪明”。

---

## 1. 已拍板、不要再争论

1. 现有认知边界正确：判断不委派、执行不自做、预注册冻结、独立评估、真实 EA、同结论 2 次转向、阶段四留痕。
2. 不稳定原因：规则在 Markdown/prompt 里，加上路径漂移（模板写 `docs/enhanceratlas/todo/...`，仓库是根下 `todo/`）。
3. 学术支持同一方向：无外部 verifier 的自反思会退化甚至改坏正确解；有效系统都有环境/测试/独立 oracle。
4. DSH 已有底座，不必另起：agentLoop、presets、subagents、workflow、session、projection、storageDomain、tools waterfall、sandbox、approval、goal（**goal 无独立评估器，必须自建**）。
5. Host 放引擎内核；preset 放模式策略。评估器 / 权限 / 停止逻辑 **不进可自改区**。
6. 第一版 Host-only，不做 Web UI（Client Inspect 当时超时，未验证 slot）。
7. MVP 先两个 preset：`rsi-research-closed-loop`、`rsi-exploratory-search`。其余三个先配置化。
8. 先用假实验证明门禁，再接到真实 Q19。

---

## 2. 现有 todo 映射（实现时对照）

| 旧环节 | 谁 | 新组件 |
|---|---|---|
| ① 回顾 | 主代理 | `RECALLING` + resolver 强制读 `memory://02`、`state://open_questions`、`state://current` |
| ② 选疑惑+验证点 | 主代理 | `QUESTION_PENDING` → `PREREG_PENDING` → `prereg.frozen`（hash） |
| ③ 讨论 | designer/蜂群/synth | subagents + 可选 workflow；契约 `DiscussionDesign` / `PositionPackage` |
| ④ 实验 | coding/review | `EXECUTING` / `REVIEW`；无冻结预注册则 `tools/pre-execute` 拒绝 |
| ⑤ 阶段四 | 主代理 | `STAGE4`；引擎不能代写 |
| ⑥ memory/eval | 委派 | eval 独立 actor、只读实验；memory 只提草案 |
| ⑦ audit | 主代理清单 | 后做 `rsi-integrity-audit` preset |

Agent 模板（继续当执行器提示，禁止它们直接改 `plan/02` 和预注册）：

- `todo/agents/swarm/principles.md`
- `todo/agents/swarm/discussion_designer.md`
- `todo/agents/swarm/synthesizer.md`
- `todo/agents/validate/coding_agent.md`
- `todo/agents/validate/review_agent.md`
- `todo/agents/eval/eval_agent.md`
- `todo/agents/eval/metrics.md`
- `todo/agents/memory/memory_agent.md`
- `todo/agents/memory/audit_agent.md`

工作流清单：`todo/01_工作流极简清单.md`

当前研究焦点（业务，不是引擎本身）：Q19 真实 EA 无监督训练 → BENGI IMR90 AUPR。引擎必须能拒绝 BENGI 模拟替代真实 EA。

权威长期记忆仍宣称在 `docs/enhanceratlas/plan/02`，仓库里实际是 `plan/02_记忆区_共识错误链原则.md`。这是 **alias 第一批必须修的漂移**。

---

## 3. 包与文件落点（第一刀就按这个写）

工作区 bundle，然后 `plugin_manager install_bundle`（需要审批 / Full access）。不要手改 `$DSH_HOME` 或 profile `package.json`。

建议目录：

```
plugins/dsh-rsi-engine/
  package.json                 # name: @local/dsh-rsi-engine
  cordis.patch.yml             # insert Host 行 + 两个 preset 行
  index.js                     # Host apply()
  locale/en.json
  locale/zh.json
  icon.svg
  src/
    domain.js                  # defineDomain spec
    store.js                   # RunStore：append event, reduce state
    contracts.js               # JSON schema / hash / freeze
    policy.js                  # 状态门、预注册不可变、真实数据、同结论计数
    resolver.js                # logical ref → unique path+hash
    projection.js              # 可选：sessionProjections rsiRun
    tools.js                   # rsi_* tools
    listeners.js               # agent/pre-step, tools/pre-execute
    presets/
      research-closed-loop.js  # 或纯 YAML 写在 patch 里
      exploratory-search.js
```

`package.json` 要点：

```json
{
  "name": "@local/dsh-rsi-engine",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": { ".": "./index.js", "./locale/*.json": "./locale/*.json", "./icon": "./icon.svg" },
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } },
  "files": ["index.js", "src", "cordis.patch.yml", "locale", "icon.svg"]
}
```

安装技能流程：`cordis-plugin-development`。设计/改 preset：`editing-cordis-compositions`。Inspect 先于猜 API：`cordis_inspect_list` → `cordis_inspect_query`。

---

## 4. DSH API 速查（已核实，实施时再 query 一次 schema）

### 必须用

| 用途 | 怎么用 |
|---|---|
| 插件状态（跨 session、模型不可见） | `ctx.storageDomain.open(spec)`；`defineDomain({name, version, tables})`。读同步，写先耐久再 `domain/changed`。 |
| 模型可见真相 | 只用已有 session events。不要 `Session.append` 新 type。不要对非 experimental 包用 `appendPluginRecord()`。 |
| 每 session 读模型 | `ctx.sessionProjections.register({key, stateSchema, stateVersion, init, apply, wire?})`。`apply` 同步纯函数，无关事件返回同一引用。 |
| 加工具 | `ctx.tools.register`。拒绝用 `guard()`（同步、与顺序无关）或 `tools/pre-execute` 返回 deny/ask。 |
| 加提示 | `ctx.systemPrompt.section()`。不要靠 `system-prompt/assemble` 塞工具/正文。 |
| 每 agent 行为 | `agent/created` 里挂 `agent.ctx`，**同时**把 disposer 存进 plugin 自己的 `ctx.effect`。 |
| 委派 | `ctx.subagents.startActivation` / 现有 `subagent` 工具。eval agent 用独立 spawn + 限制工具。 |
| 扇出 | `workflow` 仅用户明确要求大规模编排时。caps 是合作式，不是安全配额。 |
| 人工门 | `ctx.approval` / `userQuestions`。阶段四、切 preset、放宽数据、危险操作走这里。 |
| 关键提交 | `ctx.sessions.flush(session)`。root shutdown 可能丢最后 `turn/end`。 |

### 不要误用

- `dsh-goal`：可作“本 session 有一个长目标”，**不能**当独立验收。goal-round-driver 也没有 evaluator。
- `repeat-tool-reminder`：只 nudge，不阻断。RSI 断路器自己做。
- `plan-mode`：文本约束。强制限制靠 sandbox/approval。
- waterfall 不拥有决策时必须 `next()`；改 `agent/pre-step` 要 spread `{...decision, messages}`。
- 可选依赖用 `inject` / `ctx.inject([...], ...)`，缺服务时保持 inactive，不要 throw。
- 可调参数放 plugin `Config`，让用户 patch 能活过升级。

### Host vs preset（写 patch 时）

- Host 行：引擎服务、storageDomain、tools、listeners、policy。
- Preset 行：`@deepseek-ai/dsh-agent-preset`，`config.id` 如 `rsi-research-closed-loop`，`plugins` 含 persona + 可见工具 + 本模式策略。
- override 会**整份替换** config，必须重写全部字段。
- preset 若提供 service，isolate provider 和消费者到同一 realm。
- live Agent 钉死加入时的 preset revision。

当前 profile 已有 preset：`standard` / `ptc` / `minimal` / `cordis`。我们 **insert 新 preset**，不 override 官方的。

Inspect 时 Config 共 197 entries。`plugin_manager list_plugins` 当时因权限未跑；安装前再 list 一次拿准 id。

---

## 5. 状态机与事件（实现 reducer 用这个）

主状态：

```
CREATED → RECALLING → QUESTION_PENDING → PREREG_PENDING → PREREG_FROZEN
→ DISCUSSION → SYNTHESIS → EXECUTION_READY → EXECUTING → REVIEW
→ STAGE4 → EVAL → MEMORY → DECISION → CLOSED
```

旁路：`BLOCKED` | `RECOVERING` | `DRIFT_DETECTED` | `ABORTED`

子问题节点：`pending → ready → running → done | refine | unresolved`  
字段：`question, falsifiable_boundary, completion_criteria, depends_on`

事件（append-only，带 `event_id, run_id, seq, actor, emitted_at, expected_state_version, payload_hash, contract_version, evidence_refs`）：

`run.created` `memory.recalled` `path.manifested` `question.selected`  
`prereg.drafted` `prereg.frozen` `prereg.violation` `metrics.frozen`  
`discussion.designed` `stance.submitted` `discussion.round.completed` `synthesis.completed`  
`experiment.started` `experiment.completed` `experiment.failed`  
`review.completed` `stage4.recorded` `eval.started` `eval.completed` `eval.read`  
`memory.proposed` `memory.committed` `decision.recorded`  
`drift.detected` `recovery.opened` `recovery.retried` `run.closed`

命令与事件分开。命令带 idempotency key。看过结果后改设计 = 新 run，不改旧事件。

---

## 6. 门禁（PolicyGate，第一版就必须有）

硬拒绝：

1. 无 `prereg.frozen` + `metrics.frozen` + 输入 manifest + 对照合同 → 不能进入 `EXECUTING`（coding 工具/bash 实验也拦）。
2. 结果后任何改预注册 / metrics → `prereg.violation`，不重算成“部分通过”。
3. 无完整 result + review → 不能 `STAGE4`。
4. 无 stage4 + 独立 eval + `eval.read` 回执 → 不能 `DECISION` / 收束。
5. eval actor 无实验写权限、无改预注册权限。
6. `research-closed-loop` 下用 BENGI 模拟替代真实 EA → 拒绝。
7. 同一结论第 2 次 → `DRIFT_DETECTED`，必须转向/重定义/停止（或新可证伪问题 + 人工批准）。
8. resolver：零匹配或多匹配 → `BLOCKED`，不问模型猜路径。
9. 禁词当失败：`成立但平凡` / `诚实图景` / `部分通过`（现有 audit 铁律）。
10. 自评 / 同一优化器当唯一成功依据 → 不算通过。

可配置（preset Config，不是代码里写死业务数）：预算、是否启用蜂群、对照清单、真实数据策略、同结论阈值（默认 2）。

恢复：

- transient（timeout/OOM）：同一契约、有限重试、idempotent。
- 已观察到实验结果：不能原契约重跑冒充没看见；要新 run。
- 路径漂移不是普通重试：先 alias+唯一性+hash。

---

## 7. 契约清单（JSON，hash 封存）

每份：`contract_type, version, run_id, created_at, actor, parent_hash, content_hash`

1. **Run/IntakeCard** — 目标、核心对象、实体歧义、intent、时间、排除、QueryType
2. **QuestionNode** — 可证伪边界、完成条件、依赖、预算、verdict
3. **PreRegistration** — 疑惑、预测（数字/方向）、验收、可接受失败、对照、冻结 metrics、数据隔离、资源。提交后不可变
4. **DiscussionDesign / PositionPackage** — 必配魔鬼代言人+异想派；字段 `stance/claim/reasoning/evidence/assumptions/confidence/self_weakness`
5. **ExperimentTask / Result** — 代码、输入 artifact hash、seed、资源/timeout、对照、输出 schema
6. **ReviewReport** — 验收数字、对照、显著性、假阳性（axis/索引/聚合/广播）、泄漏；逐项 `pass|suspect|fail`
7. **Stage4Record** — interpretation / why / cognition / decision / ambition_self_check（主代理）
8. **EvalReport** — 产出维度 + 纪律护栏 + 分环节反馈 + 腐化信号；只评价不优化
9. **MemoryProposal / Commit** — 对象共识/原则/被否定叙事需主代理确认
10. **DecisionRecord** — 深化 | 转向 | 重定义 | 停止

证据账本表：Intake, Plan, Claims, Artifacts, Discards, Contradictions, RoundLog  
Claim：`unverified | corroborated | contradicted`。矛盾不删不平均。“没搜到”≠证伪。

---

## 8. Resolver（必须先做，否则旧模板全坏）

逻辑引用，禁止 agent 猜绝对路径：

| 逻辑 | 当前真实（可能变） |
|---|---|
| `memory://authoritative/02` | `plan/02_记忆区_共识错误链原则.md`（旧：`docs/enhanceratlas/plan/02...`） |
| `state://current` | `todo/state/current_state.md` |
| `state://open_questions` | `todo/state/open_questions.md` |
| `round://<id>` | `todo/state/round_XX.md` 或 `round_P1-XX.md` |
| `eval://latest` | 最大编号评估文件；命名有 `eval_round_NN` 与 `eval_P1-XX` 两种 |
| `agents://swarm/designer` | `todo/agents/swarm/discussion_designer.md` |
| `artifact://...` | content-addressed |

规则：记录 `requested_path, resolved_path, realpath, sha256, schema, resolution_method`。唯一匹配才自动 alias。0 或 >1 → BLOCKED。旧事件保留原请求路径。输入数据同样 path+hash+schema（如 `.pre_cache`）。

第一批 alias：

- `docs/enhanceratlas/todo` → `todo`
- `docs/enhanceratlas/plan/02` → `plan/02_记忆区_共识错误链原则.md`（核对仓库真实文件名后再写死）
- `eval_round_NN` → `eval_P1-NN` 仅当唯一且配置允许

Agent 输出只进 **run sandbox**，禁止写主代码（`models/`、`PRE.py` 等现有 coding_agent 铁律）和权威记忆。

---

## 9. 五个 preset

| id | 何时 | 硬策略 | MVP |
|---|---|---|---|
| `rsi-research-closed-loop` | 默认 / Q19 | 真实 EA、预注册、对照、两次同结论转向、完整 ①–⑦ | 先做 |
| `rsi-exploratory-search` | 调研 | agentic-search 五阶段；反证必做；不自动实验 | 先做 |
| `rsi-falsification-pivot` | 连续失败 | 反证/kill test；禁止包装成功 | 配置占位 |
| `rsi-engineering-validation` | 已冻结合同 | 可跳蜂群，不可跳预注册/对照/review | 配置占位 |
| `rsi-integrity-audit` | 只读审计 | 不跑实验、不写长期记忆 | 配置占位 |

`exploratory-search` 协议（来自工作区 `skills/agentic-search-strategy/SKILL.md`，运行时未注册该 skill，逻辑要进引擎）：

- Phase 0 IntakeCard，禁止把用户原句当 query
- Phase 1 DAG，每节点可证伪边界+完成条件
- Phase 2 每 ready 节点 ≥3 query ≥3 角度；Decision/Factual/Comparative 必须有 counter-evidence
- Phase 3 三维打分 relevance/authority/novelty；丢弃写原因
- Phase 4 gap；反证空 = “试了 K 个角度没找到”，不是证明
- Phase 5 矛盾并列；unresolved 显式列出

预算默认：max_rounds 6 / max_queries_per_round 8 / max_total 40。

Preset 创建时 version+hash 封存。运行中切换 = 新 run。

---

## 10. 工具面（模型能调的）

建议一个工具多 action，避免工具爆炸：

`rsi` 或拆开：

- `rsi_start` — 建 run，选 preset，写 Intake
- `rsi_prereg_freeze` — 冻结预注册+metrics（主代理）
- `rsi_record` — 追加合法事件（stage4、eval.read、decision…）按当前状态校验
- `rsi_gate_status` — 当前状态、缺什么契约、为什么被拦
- `rsi_resolve` — 解析逻辑引用
- 以后再加 `rsi_dispatch`（派 coding/review/eval）

UI 若以后做：同一 Host service method，UI 走 command，tool 调同一 method（`user-actions.md`）。

授权类（批准放宽数据、切模式、危险操作）保持 **user-only**，不要给模型工具。

---

## 11. 判断边界（写进 persona / policy，代码也要拦）

**只能主代理/人类：** 选疑惑、验收语义、阶段四、矛盾语义裁决、对象共识/原则/被否定叙事、用模拟数据、放宽指标/资源/对照、切 preset、确认歧义 alias、危险外部操作。

**可以自动：** 读记忆与 hash/schema、生成 DAG/查询/立场草案、调度 agent、跑实验、机械对照检查、账本追加、有限恢复、eval 格式分、同结论计数、状态投影。

引擎 = 提案、校验、阻断。不是投票器。

---

## 12. 学术/实践硬约束（不要在实现时软化）

来源细节在报告里。实现时记住：

- 无外部反馈的 self-refine 会回归（ICLR 2026 代码：幻觉批评改坏正确解）。
- 验证错误是主瓶颈（约 70%），不是缺反思轮。
- DGM 等自改代码有局部增益，但 sandbox + 人工监督 + 外置 evaluator。
- 自动科研不能自证新颖性；本项目优势是 **真实 EA → BENGI 可测闭环**。
- proxy 升、真实不升是奖励黑客；public proxy 与 held-out 必须分开。
- 系统 nudge 不得刷新 stuck 计数。
- 优化集 / held-out / 回归集物理隔离。
- 不可编辑安全不变量：权限、网络、TLS、审计、停止逻辑。

L0/L1/L2 命名不要混。我们做 L1。

---

## 13. 实现顺序（压缩后按这个开工）

**P0 骨架（能装上、能拦）**

1. 建 `plugins/dsh-rsi-engine/` 按 host-plugin 清单：locale、icon、patch、`apply()`。
2. `defineDomain` + RunStore（events 表 + runs 表）。
3. PolicyGate：无预注册拒绝执行；改冻结契约拒绝。
4. 工具：`rsi_start` / `rsi_prereg_freeze` / `rsi_gate_status` / `rsi_record`。
5. `tools/pre-execute` 或 `guard`：实验类工具在 `PREREG_FROZEN` 之前 deny。
6. Resolver + 第一批 alias；启动时解析失败 → 诊断而不是猜。
7. patch insert 两个 preset（persona 先写铁律，工具集先最小）。
8. `install_bundle`，用 Inspect 确认行出现；**新 session** 测行为。

**P0 验收（假实验）**

- 无预注册调用实验路径 → 被拒且留痕
- 冻结后改验收 → `prereg.violation`
- 模拟 EA 在 closed-loop → 被拒
- `rsi_gate_status` 能说出缺哪份契约
- 崩溃后从最后 event 恢复，idempotency 不双写

**P1 闭环**

- 投影到 `todo/state/round_XX.md`（只读生成，或确认后写入）
- 派 coding/review/eval（eval 独立 spawn、工具限制）
- `eval.read` 回执
- 同结论计数 → drift gate
- Q19 真实数据 manifest（`.pre_cache` hash）

**P2**

- 其余三个 preset
- integrity-audit
- 可选 UI（`conversation.composer.dock` 或 settings.section，先 Inspect slot）
- workflow 五轮蜂群

不要先做：预览 HTML、第二套运行时、自改评估器、Web 花活、权重训练循环。

---

## 14. 安装与验证纪律（技能强制）

- 每个 `plugin_manager` 动作都要审批；list 也要。只在结果决定下一步时才 list。
- 成功看 `application: applied` 和 warnings，不看进程列表。
- 用 `cordis_inspect_query` 确认新行，不要用 `list_plugins` 当唯一证据。
- 改过的行为在**新 session**验证。旧 session 钉死旧 plugin revision。
- 安装会在 Host 进程执行代码。
- 显示清单：有意义的 en/zh title+description、原创/可再分发 icon、exports 含 locale 和 icon。

---

## 15. 压缩后第一轮要打开的文件

按顺序：

1. 本文件 `docs/rsi-engine-memory.md`
2. `docs/rsi-engine-research-report.md` §4–6
3. `todo/01_工作流极简清单.md`
4. 技能：`cordis-plugin-development` → `references/host-plugin.md`、`practices.md`
5. 模板：skill 目录下 `templates/decoration/`（复制到 workspace 再改，不要在 asar/npm 里改）
6. Inspect：`Service.listService`（storageDomain, tools, systemPrompt, sessionProjections）、`Config.listConfigs` 看 storage-domain / agent-preset
7. 仓库真实路径：`plan/02_记忆区_共识错误链原则.md`、`todo/state/` 文件名，用来写 alias

---

## 16. 未决（实现时碰到再问用户，不要默默选）

1. 引擎状态放 workspace 文件 vs `storageDomain`（建议 domain 为主、workspace 投影为辅）。
2. 是否在 P0 就拦 bash，还是只拦 `rsi_*` + 文档约定（建议 P0 就拦明显实验路径，bash 全拦太凶，可用“未冻结则 ask”）。
3. eval 用独立 preset 还是同一 preset + tool restrict。
4. `plan/02` 与 `docs/enhanceratlas/plan/02` 以哪个文件为权威（先 glob 确认只存在一个）。
5. 插件 id 最终用 `@local/dsh-rsi-engine` 还是带项目名。
6. Client UI 延后到门禁测通之后。

---

## 17. 一句话给下一轮模型

> 在 `plugins/dsh-rsi-engine/` 实现 DSH Host bundle：storageDomain 事件账本 + 预注册冻结门禁 + 逻辑路径 resolver + `rsi_start/prereg_freeze/gate_status/record` 工具；insert 两个 preset。不要重做调研，不要发明新 session event type，不要让模型改评估器和权威记忆。先假实验证明拒绝，再接 Q19。
