# Praxis 验收证据（2026-11-05 v2/v3）

本文只记录**可复现**的检查。每条写明命令、场景与预期；未验证项在 §7 明列，不假装通过。

环境：DSH `0.2.1-rc.5`，Node `v25.2.0`，Chrome `133`（headless，CDP 驱动），插件版本 `@local/dsh-praxis@0.2.0`。
测试实例：`dsh web --patch /tmp/praxis-test-patch.yml --port 3081 --no-open`，独立 `statePath`，不接触 `~/.dsh/praxis/state.json`。

## 1. 契约测试

```bash
node --test test/praxis/*.test.js
```

```text
ℹ tests 140
ℹ pass 140
ℹ fail 0
ℹ skipped 0
```

| 套件 | 关注点 |
|---|---|
| `engine.test.js` | 硬规则、评分、地图、权限矩阵、fork/幂等/冲突、dump/load |
| `engine-v2.test.js` | `question` 动作、`QUESTION_REQUIRED`、`INVALID_TRANSITION`、fork 纯净性、迁移幂等 |
| `graph.test.js` | 默认图拓扑、端口推导、图操作 |
| `graph-v2.test.js` | 双轴状态、I1–I6 审计、拓扑钳制、gate done 由 receipt+游标决定、保护节点、布局与迁移 |
| `graph-api.test.js` | `GET/POST /graph`、`/layout`、revision 冲突 |
| `wire-v2.test.js` | `wireVersion=2`、`catalog`、409/422 语义、`/evidence` |
| `client-build.test.js` | `client.js` 与本轮模块一致（`--check`）、模块前缀、单例 store、单一 style |
| `store.test.js` / `host.test.js` / `http.test.js` / `integration.test.js` | 持久化、命令门面、HTTP 信封、端到端闭环 |

断言来源是契约（`docs/praxis/redesign/10-v2-contract.md`），不是实现现值的回抄。

## 2. 浏览器验收

```bash
PRAXIS_BASE_URL=http://127.0.0.1:3081 \
PRAXIS_SERVER_LOG=/tmp/praxis-3081.log \
node --test test/praxis/acceptance/*.test.js
```

| 用例 | 断言 | 结果 |
|---|---|---|
| `§5.6 @1440×1000` | 15/15 节点可见、内容包围盒宽 ≥70%/高 ≥20%、唯一主按钮、内部码 0、破坏性控件 0、横向溢出 0 | 通过 |
| `D5-1 @1024×900` | 无页面横向溢出、节点仍全可见、无控制台错误、`world scale < 0.75` 时出现“视口不足”提示 | 通过 |
| `§5.2` | 节点正文只有人类可读状态，无 `prereg_freeze`/`gate:prereg` 等内部码 | 通过 |
| `§5.2/T2.1` | 冻结后 prereg 门显示“已完成/契约已冻结”，不再出现倒挂 | 通过 |
| `§5.4/D6` | 运行模态主按钮唯一，且无“删除节点/连线/拖拽节点”等拓扑控件 | 通过 |
| `§5.3/D5` | 亮/暗主题分别由独立实例验证（同一实例不可切换主题） | 暗色独立实例 8/8 通过 |
| `acceptance/full-loop` | `start→question→prereg_freeze→pin_persona→discussion→experiment→review→stage4→eval_report(delegatedActor=evaluator)→eval_read→memory_propose(delegatedActor=root)→memory_commit→decision→map_claim`，终态 `DECISION`，`actor.delegated` 恰 2 条 | 通过 |

浏览器测试使用独立 Chrome profile 与独立 `statePath`（A1），零 npm 依赖（A2），3081 不可达时显式 skip 并打印原因（A3）。

实测统计（build `17dc23af5f2e`）：
- 亮色实例：`tests 8 / pass 7 / fail 0 / skip 1`（skip 项为暗色，由独立实例证据覆盖）
- 暗色实例：`tests 8 / pass 8 / fail 0 / skip 0`

证据 manifest（`docs/praxis/evidence/manifest.json`）：`ok=true`、`buildChecked=true`、31 张截图（light 16 / dark 15，均 `themeApplied`）、`unexpectedMetricViolations=0`、`expectedMetricViolations=2`（drawer primary 规则）、`signoff.signed=7`、`compat=18`、**`unverified=0`**。
逐对 WCAG：light 正文最小 5.8:1、非文本最小 5.31:1；dark 正文 5.55:1、非文本 9.47:1。选中节点与检查器交集 0（gap 16px）。700×600：`worldScale=0.686`、15/15 可见、页面横向溢出 0。

## 3. 手工端到端场景（CDP 脚本，可复跑）

脚本：`tools/dev/preview.mjs`（dev 工具，非交付物）。

| 场景 | 命令 | 观察到的结果 |
|---|---|---|
| 冷启动 | `node tools/dev/preview.mjs --scenario empty --coldstart` | 空态只有一个主入口 → 新建运行（顶栏无主按钮）→ INTAKE，进度 1/10，主按钮“记录研究问题” → 填写问题/假设/未知 → 提交 → QUESTION，2/10，banner“已提交：记录研究问题” |
| 运行推进 | `node tools/dev/preview.mjs --scenario frozen --flow` | 顶栏“提交讨论”打开检查器 → 载入示例 → 提交 → DISCUSSION，v3→v4 |
| 蓝图保存 | `node tools/dev/preview.mjs --scenario frozen --blueprintsave` | 进入蓝图 → 拖动节点 → 草稿“1 处修改 · 校验：待保存” → 保存 → 确认 diff → graph revision 1→2 → 回到运行态 |
| 抽屉 | `node tools/dev/preview.mjs --scenario frozen --drawer map` | 认知地图抽屉打开：图例、空态、未知前沿/盲点；无控制台错误 |
| 亮/暗主题 | `node tools/dev/preview.mjs --theme dark` | 暗色下节点、泳道、检查器、抽屉全部正常渲染 |
| 1024 窄屏 | `node tools/dev/preview.mjs --size 1024x900` | 无页面横向溢出；`world scale=0.762`；画布内可拖拽 |

上述场景 `consoleErrors = []`。

## 4. 真值修复的验证

| 缺陷（上一版） | 验证方式 | 结果 |
|---|---|---|
| `INTAKE` 时下游 `Prereg Gate` 显示 `DONE` | `graph-v2.test.js` I1–I6 + 浏览器 `§5.2/T2.1` | 修复：执行轴只由 receipt+游标决定；条件轴独立 |
| fork 子 Run 继承 `preregHash` 导致门提前打开 | `engine-v2.test.js` T4.1/T4.2 | 修复：fork 清空 `preregHash`、契约转草稿、`gate('experiment').allow=false` |
| 旧脏数据不会自愈 | `engine-v2.test.js` T4.3 + 迁移端到端脚本 | 修复：`load` 幂等对账，写 `migration.reconciled` |
| 运行态可直接删节点/连线/伪造 actor | 浏览器 `§5.4/D6` + 代码审查 | 修复：运行态无拓扑控件；蓝图态保存需 `expectedRevision` + diff 确认 |
| 独立评估/记忆提议在 UI 是永假按钮（user 角色无权限） | 浏览器 UI 冒烟：未勾选委托复选框 disabled；勾选后提交成功并写 `actor.delegated` | 修复：显式角色委托 + 审计 |
| 认知地图只能看不能登记 | 浏览器 UI 冒烟：地图抽屉登记主张 → `claims=1` | 修复：PanelMap 增加登记/连接表单 |
| 客户端 0 测试覆盖 | `client-build.test.js` + `browser.test.js` | 部分修复：构建一致性与真实浏览器任务断言 |
| 截图可伪造 | `tools/evidence/capture.mjs` + manifest | 每张截图带 sha256、构建 hash、端口、视口、主题、场景 |

## 5. 图与 wire 契约

| 条目 | 验证 |
|---|---|
| `wireVersion=2`、`catalog` 完整（状态/动作/双轴/原因/阻塞/事件） | `wire-v2.test.js` T8.1/T8.2 |
| `GET /graph` 扁平投影，含 `states/current/progress/audit/revision` | T8.3/T8.6 |
| `POST /graph` 缺 `expectedRevision` → 428；过期 → 409 + 当前图 | T8.6 |
| `POST /command` 成功 200 / 冲突 409 / 其他拒绝 422，带 `view`、`nextAction`、`blockers` | T8.5 |
| `GET /evidence` 返回 runs+receipts+events+audit | T8.7 |
| 保护节点、端口推导、V10/V11 | `graph-v2.test.js` T6.1–T6.3 |

## 6. 安装与激活

```text
profile web: "@local/dsh-praxis": "link:/home/z/CBAT-W/zbh/plugins/dsh-praxis"
安装层：Config.listConfigs → praxis 行 active
Client：Slots.listSubTree → sidebar.panellist 出现 praxis occupant；主界面 main[praxis] 渲染
Host：/praxis/api/state 200，wireVersion 2
```

修改 `client.js` 后必须重启 DSH web 才会重新加载 Client bundle；只刷新页面不够。

## 7. 未验证 / 不可判定

| 项 | 原因 | 处置 |
|---|---|---|
| Dock chip 的视觉验证 | `conversation.composer.dock` 作用域是 `session`，无活动会话时不渲染；headless 新 profile 没有会话 | 已确认 slot 注册代码存在；需在有会话的实例里人工确认 |
| 1024 全应用下的有效字号下限 | 宿主侧栏 280px 使画布只有 744×840、world scale 0.798（r7 后）；64px 冻结节点高放不下达标字号 | 按 D5-1 记为“不可判定”；插件根 1024×840 下 scale=1.0 且全部达标 |
| 14 节点场景 | 需要合法的 14 节点图夹具 | 用 engineering-release 11 节点作为“非 15 节点”覆盖（`variant-engineering-11`，诚实标注非 14） |
| error / stale 场景 | 需要 500 注入与 409 触发 | 已验证：error 用请求失败注入；stale 用页面内 `__praxisDebug` 以旧 revision 提交，触发真实 409 与粘滞横幅 |
| 暗色主题浏览器断言 | 主题由 profile patch 固定，运行时不可切换 | 由独立暗色实例验证（`capture.mjs` 管理实例）；同实例测试显式 skip |
| 运行中 Playbook 迁移 | 当前策略是 Run 固定原 revision，不做自动迁移 | 设计决策，非缺陷 |
| 真实 DSH 会话内 `rsi_run` 的工具调用 | 工具只在**新会话**出现；本轮未在对话中实际调用 | 需新会话人工验证 |

## 7.1 设计签收

`docs/praxis/redesign/13-pixel-signoff-v2.md` revision 3：**PASS（build `17dc23af5f2e`，7 signed scenes）**。

| 签收项 | 结果 |
|---|---|
| clean-light / running-light / empty-light / blueprint-light 1440 | 通过 |
| selected-light 1440（3/10 current `n_prereg`，与 inspector gap≈16px，zoom 100%） | 通过 |
| running-dark / selected-dark 1440 | 通过 |
| 1024 全应用 / 700×600 | compat 通过（不套字号/面积） |
| loading | compat：骨架 + “正在连接 Praxis 服务…” 文案已验证（暂停 `/state` 后截图） |
| error / stale / variant-engineering-11 | 证据已生成，归 compat（stale 用旧 revision 触发真实 409） |

## 8. 证据清单

- 截图与 manifest：`docs/praxis/evidence/manifest.json` + `docs/praxis/screenshots/`
- 契约：`docs/praxis/redesign/10-v2-contract.md`
- 视觉验收清单：`docs/praxis/redesign/11-visual-acceptance-checklist.md`
- 设计评审：`docs/praxis/redesign/12-client-visual-review-v2.md`
