# Praxis v4 验收证据（2026-11-05）

对象：团队研究驾驶舱。契约：`docs/praxis/redesign/20-rewrite-brief.md`。
环境：DSH `0.2.1-rc.5`，Node `v25.2.0`，Chrome（headless，CDP 驱动），插件 `@local/dsh-praxis@0.3.0`。

## 1. 契约测试

```bash
node --test test/praxis/*.test.js
```

```text
ℹ tests 162
ℹ pass 162
ℹ fail 0
ℹ skipped 0
```

| 套件 | 关注 |
|---|---|
| `team.test.js` | 团队投影：live/none、kind、状态归一、currentTask、branchIds；`source=none` 时 members 必空 |
| `branch.test.js` | 分支状态机：b_main 自动建、冻结前拒绝、多 active、证据计数、verdict→merge、B1/B4、权限、dump/load |
| `wire-v4.test.js` | `wireVersion=3`、branches/team/gates/evidenceRows、门禁状态推导 |
| `engine*.test.js` / `graph*.test.js` / `host/http/store/integration` | 既有状态机、图不变量、wire、持久化 |
| `client-build.test.js` | `client.js` 与 `client/*.js` 一致、模块前缀、单例 store |

## 2. 浏览器验收

```bash
node --test test/praxis/acceptance/cockpit.test.js
```

```text
✔ v4 cockpit：1440 驾驶舱 DOM 断言（A2/A3/A4/A6）
ℹ pass 1  ℹ fail 0
```

断言内容：`branch-board` 存在；`branch-card` ≥2 且**同屏可见 ≥2**；`gate-row` = 10；`evidence-band` 存在；`[data-testid="primary"]` = 1；页面无横向溢出；点击分支卡打开检查器且其内 primary ≤1；界面创建分支后卡片数增加；`team-chip[data-source] ∈ {live,none}`；不存在节点/端口/拖拽等拓扑控件。

自管实例（随机空闲端口）+ 独立 statePath + 独立 Chrome profile，结束清理。

## 3. 证据 manifest

```bash
node tools/evidence/capture.mjs --v4 --manage-server
node tools/evidence/verify-manifest.mjs
```

```text
manifest gate passed: 10 shots, build b8cf59210655, running 1440 × 2 with >=2 parallel branches
```

`docs/praxis/evidence/manifest-v4.json`：`ok=true`，10 张图（light/dark × empty/running-1440/running-1024/branch-inspector/team-drawer），每张带 sha256、viewport、theme、scenario 与 `sceneMetrics`（branchCards、visibleCards、gateRows、primaryCount、teamChipSource、overflowX、nodes、ports）。

门禁校验：running 场景必须 ≥2 张并行分支卡同屏可见、10 行门禁、primary=1、无横向溢出、无图节点与端口。

## 4. 手工端到端（CDP，可复跑）

| 场景 | 结果 |
|---|---|
| 空态 | 10 行门禁骨架（未到）+ 3 步引导卡 + 唯一主按钮“新建研究运行” |
| 新建运行 → 记录研究问题 | INTAKE → QUESTION，进度 2/10 |
| 分支创建（界面表单） | 4 → 5 条分支，新分支 `proposed`，标题与可证伪陈述落库 |
| 记录证据（界面表单） | 分支证据数 3 → 4，风险方向记录为“反驳”，时间线新增一行 |
| 给出结论（界面） | 分支 `active → supported`，理由写入 `verdict` |
| 团队投影 | 真实 DSH 会话内 `source='live'`，运行条显示“团队 1 人 · 运行中 0” |
| 检查器 | 打开时预留 372px，画布/时间线/证据带不被覆盖 |

## 5. 未验证

| 项 | 原因 |
|---|---|
| 真实 teammate（>1 人）的实时状态 | 需要一次真实的 `spawn_teammate` 回合；本轮实例未授权工具调用，投影代码路径已由单测覆盖 |
| 团队任务板行 | `listTasks` 在有任务时才有数据；单测用 fake 服务覆盖，运行时未观察到任务 |
| dock chip 截图 | `conversation.input.dock` 仅在真实会话内渲染；代码与槽位注册已验证 |
| 1024 全应用下的分支列宽 | 宿主侧栏占 280px 时列变窄；插件根 1024 宽正常 |
