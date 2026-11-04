# Praxis Engine 规则审阅

> 对照：`docs/praxis/impl-contract.md` §2–3、`test/praxis/engine.test.js`。本轮执行：engine 39/39 通过。以下是绿测试之外仍需注意的语义风险，不修改源码。

## 1. 结论摘要

当前实现已经覆盖契约的表面 API、主要回执码、RunView 形状、基础幂等、fork、评分和集成 happy path。测试仍未证明：所有动作都遵守 13 状态机的合法前驱；EVAL/记忆/晋升的证书真实性；dump/load 后事件序列与配置不可变；地图字段具有真实语义；评分不会被输入格式或重复文本操纵。

最高风险顺序：

1. 状态跳跃与旁路命令可绕过 REVIEW、STAGE4、EVAL、MEMORY。
2. `eval_read` 可在没有 report 时写入 `readAt`，`promote` 的 `payload.evalRead:true` 还可绕过实际 read。
3. load 后 `seq` 未恢复，新事件可能复用旧序号；导出的 knobs/run 对象仍可能被外部引用修改。
4. fork 混合了“继承研究上下文”和“新 Run 重置状态”两种语义。
5. map 的 frontier/blindSpots/meanReversion 目前主要是占位值。

## 2. 状态机边界

`advance()` 只在目标状态索引更大时前进；它没有验证当前状态是否允许目标动作。因此 `stage4` 可以从 INTAKE 直接跳到 STAGE4，`eval_report` 可绕过 review/stage4，`memory_commit` 可在无 proposal 或无 eval 的早期执行。测试只检查一条成功路径的单调性，没有逐动作非法前驱矩阵。

建议：维护 `ACTION_PRECONDITIONS[action]` 和 `ALLOWED_TRANSITIONS[from][action]`；非法前驱返回 `INVALID_TRANSITION`，不改变 version/state，不写业务成功事件，只写 `gate.denied`。`DRIFT_DETECTED`、`BLOCKED`、`CLOSED` 应为明确的旁路/终态：漂移后默认只允许 `pivot/new-run` 读操作；CLOSED 不再接受业务写入；BLOCKED 只能由满足阻塞解除条件的命令离开。当前没有 `close` 动作，需明确 DECISION 是否终止而不是悄然保留 CLOSED。

## 3. 逐条规则失败语义

| 规则 | 失败必须保持 | 建议失败码/补强 |
|---|---|---|
| 1 prereg | state/version/experiment 不变；写 gate.denied | `PREREG_REQUIRED`、`blockers`、`nextAction`；另测空/部分 contract |
| 2 violation | 原 hash/contract 不变；旧 Run 不继续覆盖 | `PREREG_VIOLATION` + `nextAction:new-run`；重复 violation 幂等 |
| 3 kernel/eval/L2/L3 | candidate 不落库、不换 parent | `FORBIDDEN_BOUNDARY_EDIT`、`EVAL_NOT_READ`、`L2_CLOSED`、`L3_CLOSED`；不能用 payload 布尔值代替真实 read |
| 4 memory | proposal 与 commit 分离；非 user 不得 commit | `USER_ONLY`/`UNKNOWN_PROPOSAL`；commit 前强制 source/evidence、重复 commit 不增记录 |
| 5 drift/fear | drift 后不可继续原路径；fear 不能被空 evidence 隐藏 | `DRIFT_DETECTED`、`UNKNOWN_FEAR`；记录原文、证据缺口和 pivot 入口 |
| 6 persona | 缺字段时不 pin、不占 quota | `PERSONA_DECORATIVE`；hash 应覆盖 canonical persona 与 topic revision |
| 7 knobs fork | parent 不变；child 创建和 lineage 更新应原子 | fork receipt 带 parentId；需明确 child 是否继承 prereg/artifacts，不能 state=INTAKE 却隐含 contract 已冻结 |
| 8 idempotency | replay 不增 version/event/side effect | 同 key 但 payload/action 不同应 `COMMAND_ID_REUSE`，不能无条件 replay 第一结果 |
| 9 conflict | 不写任何 domain/event 业务副作用 | `CONFLICT` + `retry:manual` + current version；冲突拒绝本身是否写审计需固定 |
| 10 corruption | 不阻断正常流程但必须进入 UI 阻断区 | receipt 与 event 都含 `CORRUPTION_WARNING`；评分必须有限、在 0–1，不能由 self-report 单独触发 |

## 4. 具体未覆盖风险

### Replay / persistence

`load()` 没有校验 dump schema、run id/hash、event version 或 receipts 一致性；失败语义未冻结。`seq` 未从 dump 恢复，load 后 append 可能复用旧 seq；`runCounter` 也未恢复。`engine.knobs` 暴露可变对象，调用方可绕过 `set_knobs` 直接改当前 Run 的配置。建议返回冻结副本或代理，并在 load 后以最大 seq/child id 恢复计数器。

回放键应绑定 `(runId, commandId, commandFingerprint)`。同一 commandId 复用但 payload 改变必须拒绝，防止错误请求被伪装为 replay。

### Fork lineage

当前 child 复制整个 run 后清空 events、重置 state，却保留 prereg、claims、memory 和实验结果。若 fork 是新实验，旧结果不能伪装成 child 事件；若 fork 是可重放分支，则 state 不应重置。须冻结一种语义，并保存 `parentSnapshotHash`、fork reason、继承字段清单和 child 初始事件。

### Map

`map_edge` 应验证 from/to 节点存在、禁止未知节点/非法自环/重复边，并把 contradiction 与 edge id 关联。`frontier.testableNext` 当前可为空；`blindSpots=[]` 和 `meanReversion={distance:0,centered:false,suspect:false}` 是形状占位，不是认知地图。应从无证据 claim、未回答 question、反复 conclusion 和缺失 evidenceRefs 推导，且不能把矛盾平均成一个节点。

### Scoring

`scoreHeterogeneity` 把“claim 字符串不同”直接当 contradiction，未区分互补观点与逻辑反例；evidence entropy 按完整字符串而非 source family 计算。无 minority 时 retention=1 可能奖励未产生少数派。应使用 canonical stance/assumption/evidence-path，并分别报告形式分歧与真实分歧。

`scoreAmbition` 没有输入范围/NaN 校验；decision 目前按 payload `ambition` 判低分，而不是统一按 `A_final`/独立分数判定；`high-narrative-low-delivery` 等计算 flag 可能没有完整回传到 receipt/run corruptionFlags。阶段四没有独立评分。应把 self-report 作为证据而非权威，固定 policy hash，保持 `A_p/E/A_d/A_final` 可重算。

## 5. 原设计中应保留、但当前测试未覆盖

- Persona 的 R0 独立首轮、R1 steelman、R2 自攻、R3 分歧地图、R4 不压平合成；测试只检查 topicBinding 字段。
- Persona 的 `seedRefs/symptomProfile/stance/counterexamplePreference/evidenceStandard/taboos`、actor/preset revision hash 和 Run pin；当前只查 `contentHash`。
- 异质度应包含证据路径、立场分布、少数派保留和 style-only 检测；不能用投票或词汇差异替代。
- Objective/GoalContract、metrics/input/control/budget/stop 的不可变版本和 hash；结果后改合同必须新 Run。
- evaluator、permissions、stop、data boundary、hidden tests、audit、long-term memory commit 的不可自改及独立 evaluator 隔离。
- `eval_report`→`eval_read` 的 report hash、actor、read receipt 闭合；未读报告不能晋升。
- 记忆 proposal 的 provenance、矛盾并列、过期/取代状态；未 commit 不能进权威记忆。
- 自优化应保留 candidate parent hash、原子 diff、held-out/OOD、regression、成本、quarantine、rollback/fork 和后代 future-capacity；单次任务分数提升不能叫 RSI。
- 反均值回归应记录重复结论、frontier、blind spot、unknown fear 的证据路径；`meanReversion` 不应是常量。

## 6. 建议下一轮审计测试

补一组非法前驱矩阵、terminal-state 写入、replay key 重用、dump/load 后新事件 seq、直接 mutation 防护、fork snapshot 继承语义、无 report 的 eval_read、伪造 `evalRead:true`、unknown map edge、NaN/越界 ambition、重复 memory commit、未读 evaluator report 的 promote。所有失败均要求“无业务副作用 + reasonCode + 可重试/新 Run 指引”。
