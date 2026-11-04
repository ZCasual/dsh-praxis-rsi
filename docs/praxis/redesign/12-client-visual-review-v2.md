# 12 · 客户端模块视觉评审 v2

> 日期：2026-11-05 01:10（北京时间）。只读评审，未修改任何源码。
> 依据：`client/` 8 个 part（最后更新 01:03）、[10-v2-contract §5.7](./10-v2-contract.md)、[11 视觉验收清单](./11-visual-acceptance-checklist.md)。
> 证据限制：`node plugins/dsh-praxis/build-client.mjs --check` 在 01:09 已通过（client.js 与 8 个 part 一致），但 `docs/praxis/screenshots/` 最新仍是 16:41 的旧版本截图，且 `dock-light.png` 与 `canvas-inspector-advanced-light.png` sha256 相同，没有当前 build 的 manifest。**因此本轮没有像素签收，只有静态与几何评审。**旧截图只作历史对照，不作为当前 UI 证据。

## 0. 范围与方法

- 逐文件阅读：`00-primitives`、`10-store`、`20-layout`、`30-canvas`、`40-inspector`、`50-panels`、`60-shell`、`70-css`。
- 对照 §5.1–5.6 与 §5.7 的 D5-1…D5-13；用冻结几何手算 1440/1024 的实际尺寸。
- 与旧截图（一字长蛇、常驻 320 检查器、9 个等权按钮）对照，仅判断“旧硬伤是否在结构上被消除”，不当作新界面的视觉通过证据。
- S1 = 阻断视觉门/首屏定向或验收不可执行；S2 = 当日修；S3 = 入视觉债务。每条 S1 给出可执行修复与对应断言。

## 1. S1（必须在视觉门之前修）

### S1-01 primary 所有权在 inspector / drawer / modal 之间失效

**证据**
- `client/60-shell.js:107`：`inspectorOpen` 时运行条 primary 被替换成非动作的“收起面板”。若检查器节点没有动作表单，`client/40-inspector.js:911-921` 的 fallback 又提示“请从运行条主按钮继续”——但该按钮此时不存在，屏幕上 0 个 primary。
- 抽屉：`client/50-panels.js:399 / 494 / 740` 分别渲染“保存 / 新建运行 / fork” primary；`50-panels.js:908` 的遮罩从 `top:60px` 开始，运行条 primary 仍可见，于是同屏 2 个 primary。
- 模态：`client/60-shell.js:467 / 481 / 488` 的“确认保存 / 放弃修改 / 创建”是 primary，底层运行条 primary 仍渲染，违反 §5.4 U3 与 §5.7 D5-7。

**修复**
1. 在 `ShellApp` 引入 `primaryScope`（`run|inspector|drawer|modal|none`），由当前最上层决定唯一渲染者；底层 primary 加 `inert`/`aria-hidden` 或直接不渲染。
2. `inspectorOpen` 且节点无 action form 时，保留运行条 primary；有 form 时由检查器渲染（`data-testid="primary"` 跟着当前 owner）。
3. fallback 文案不得指向隐藏按钮；改为“点击节点动作或运行条动作”。
4. 所有 primary 加 `data-primary-scope`，抽屉/模态的 primary 在同一时刻不得与底层并存。

**验收**：运行/阻塞/空态=1；selected+form=1；selected+fallback=1；任意 drawer/modal 打开时，可见 primary 恰为顶层 1 个；`11` 的 B-V03/B-V20。

### S1-02 主按钮点击不是执行，是“选中节点”

**证据**：`client/60-shell.js:225-229` 的 `onPrimary` 只有 `setSelectedId`，没有任何 `submitAction`/`StoreSend`。按钮文案来自 catalog 动作（如“冻结预注册”），用户点击后只有节点被选中；无 payload 的动作（`eval_read`、`close` 等）还要再点一次检查器里的同文案按钮。违反 §5.1“唯一主按钮”与 §5.7 D5-7 的执行语义。

**修复**
- 按 action metadata 判定：无 payload → 直接 `submitAction(actionId, {})`，按钮进入 busy 并显示“提交中…”；有 payload → 打开检查器并把焦点放到第一个必填 `.px-input`，按钮同步“收起面板”前先保留 primary。
- 记录 `data-action-id`，点击后 200ms 内断言出现 `/command` 请求或 inspector 打开 + focus。

**验收**：B-V20；无 payload 动作点击后必须产生一次 `POST /command`；有 payload 动作点击后 `document.activeElement` 在 action form 内。

### S1-03 1024 下有效字号破线，且与冻结节点高度冲突

**证据**
- `client/30-canvas.js:1288`：当前角标 `8px`；`:1297`：条件 chip `10px`；`:1275`：泳道标签 `10px` 且 `writing-mode: vertical-rl`、容器宽仅 10px。
- 1024 根下 `LayoutFit` 为 `min((1024−64)/1076, …) ≈ 0.892`（`20-layout.js:30-31,194-205`，max 1.0）。有效字号：角标 7.1px、chip 8.9px、泳道 8.9px，低于 §5.7 D5-3 的 9px/10.5px 下限；1440 下 chip 10px 也低于 10.5。
- 若把 chip 提到 10.5px，节点 64px 高度需要重排：目前 title 16 + sub 14 + chip 16 + gap 4 + padding 12 = 62px，加 0.5 行高后接近上限，长中文可能被裁。

**修复**
- 角标 10.5px（或删除文字角标，只保留左轨+实心点+`aria-current`，避免 8px 中文）；chip 10.5px/line-height 12.5px；泳道标签 11px，改为水平放在泳道左上、不占用节点列（或宽度 ≥14px、line-height 12px）。
- 节点内容重排后做 64px 高度自检：title/sub/chip 总高 ≤48px（padding 12 + gap 2×2）；必要时 chip padding 1px 4px、line-height 12px。
- 用 `[data-testid="world"]` 的 `data-scale` 计算有效字号（见 S1-04）。

**验收**：B-V06；1024 下 title≥11、sub≥9.5、chip/badge/lane≥9、无 `<9px` 可见文本；截图 1024 亮/暗。

### S1-04 视觉验收不可执行：缺 world/scale 钩子与当前截图证据

**证据**
- `client/30-canvas.js:1133-1135` 的 `.px-canvas-world` 没有 `data-testid="world"` / `data-scale`，而 D5-11 和 B-V06 依赖它；测试只能解析 transform 字符串（脆弱）。
- `client/60-shell.js:263-272` 的 loading/error boot 分支没有 `data-testid="praxis-shell"` / `data-scene` / `data-theme`；只有加载完成的分支（`:339-345`）有。
- `InspectPrimary` 的 testid 是 `inspector-submit`（`40-inspector.js:228-232`），不是 `primary`；D5-11 的主按钮钩子不成立。
- `node plugins/dsh-praxis/build-client.mjs --check` 在 01:09 已通过，但没有 build 后的 1440/1024 截图与 manifest；无法做像素签收。

**修复**
- `CanvasView` 在 world 上加 `data-testid="world"` 与 `data-scale={CanvasZoom}`；boot 分支加 `data-testid="praxis-shell" data-scene="loading"|"error" data-theme`；`InspectPrimary` 加 `data-testid="primary" data-primary-scope="inspector"`。
- 构建已 current；按 11 清单在 1440/1024 × light/dark 各拍 `running/empty/selected/blocked`，写 manifest；没有这些就不签收视觉门。

**验收**：D5-11 全钩子存在；`--check` 通过；截图 manifest 的 build hash 与当前一致。

### S1-05 进度语义错误且重复渲染

**证据**
- `client/60-shell.js:88-93` 显示 `graph.progress.done/total`（“4/15”）并用 title“已完成”；§5.1 要求“当前阶段 3/10 + 细进度条”，不是节点完成数。空态 `graph=null` 时渲染 `0/0`。
- `client/40-inspector.js:1055-1057` 再次显示 `进度 done/total`；`InspectRunSummary` 在 `:985` 还有一条同样的进度，`InspectRunSummary` 还有一根进度条；同一事实至少出现 3 次，违反 §5.1“禁止重复渲染”。

**修复**
- 运行条只保留一个阶段指示：`active.state` 在 `STATE_ORDER` 的索引 + 1 / 10；无 active 时不渲染进度与 0/0。
- 检查器 header 删除 done/total；如需进度，用同一份阶段文本，且不得再画一根条（或只在检查器摘要中保留一次）。
- 加 `data-testid="progress"` 与 `data-progress-kind="stage"`。

**验收**：B-V11；任意场景 `[data-testid="progress"]` 恰 1 个，文本为 `当前阶段 n/10`；空态无 `0/0`。

## 2. S2（当日修）

| ID | 缺陷 | 证据 | 修复 |
|---|---|---|---|
| S2-01 | 三条泳道仍是“大卡片”：`::before` 填充 28%/52% + 6px 圆角，等于 3 个大框装 15 个节点，违背 D5-4 的“纸面导轨” | `30-canvas.js:1272-1274`；`70-css.js:211` 还留着 `.55` 的旧定义 | 去掉 `::before` 填充与圆角容器，只保留上/下 1px 细线 + 水平 11px 标签；删除 70-css 的重复 `.px-lane` 规则 |
| S2-02 | 横幅出现会压缩画布高度 | `70-css.js:104`（`flex:0 0 auto`）+ `60-shell.js:354` | 固定 36px 槽或画布内 overlay；断言节点 rect 前后变化 ≤1px |
| S2-03 | 检查器标题用 raw `node.label`（如 Intake），与画布中文明标签不一致 | `40-inspector.js:1055`、`:1200` | 复用 `CanvasNodeLabel`/catalog 中文标签；或要求 graph label 即中文 |
| S2-04 | 检查器 fallback 提示使用隐藏的运行条主按钮 | `40-inspector.js:911-921` + `60-shell.js:107` | 见 S1-01 修复；文案改为节点动作入口 |
| S2-05 | 空态仍渲染 `0/0` 进度与视图切换 | `60-shell.js:88-105` | 无 active 时隐藏 center；蓝图已 disabled（保留） |
| S2-06 | ≤1180 检查器变底部 sheet，但没有把选中节点移出遮挡区 | `70-css.js:332`；`60-shell.js` 无相机平移 | 打开 sheet 时调用 `LayoutClampCamera/Focus` 或滚动 canvas，使选中节点 rect 与 sheet 不相交 |
| S2-07 | 1024 下软阻塞原因被隐藏，hardBlocked 只剩 title tooltip | `70-css.js:331`（`.px-runbar-reason{display:none}`）+ `60-shell.js:113-117` | 1024 保留一行可见原因（可截断），不要只依赖 title |
| S2-08 | `LayoutFit` 允许 0.5，和 D5-2 的 0.75 下限冲突；在 744px 主区会静默缩到 0.63 | `20-layout.js:30` | 下限 0.75；raw<0.75 时进入“视口不足”提示/要求折叠宿主，不缩字 |
| S2-09 | 边线 1px，低于 D5-13 的 1.2–1.6；箭头与端口 10px 的关系未验证 | `30-canvas.js:1308-1310` | 常态 1.2px，active 1.6px；箭头 offset ≥4px；截图/几何断言 |
| S2-10 | `InspectWhyBlocked` 在 catalog 缺 reason 时显示 `原因码 xxx` | `40-inspector.js:932` | 回退到“条件未满足”，原因码仅进 technical fold |
| S2-11 | 运行条状态 chip 在 catalog 缺失时回退 raw state（如 PREREG_FROZEN） | `60-shell.js:87` | 禁止 raw 回退；无 catalog 时显示“状态未知”并记 console/test 失败 |

## 3. S3（视觉债务）

- `PrimMenu` 无 `aria-expanded` / `aria-haspopup`，关闭不归还焦点（`00-primitives.js:91-118`）。
- `PrimModal` 无焦点陷阱/`aria-labelledby`（`00-primitives.js:132+`）；抽屉已有焦点恢复，模态没有。
- 无 `prefers-reduced-motion`：骨架 pulse、进度 width transition（`70-css.js`）。
- `.px-lane` 同时在 `70-css.js:211` 与 `30-canvas.js:1272` 定义，后写覆盖前写，留下 dead CSS 与调试歧义。
- `PrimShort` 按 UTF-16 截断，可能切分代理对；建议 `Array.from(text)`。
- done 与 pending 的 sub 同用 `label-secondary`（`30-canvas.js:1296`），状态主要靠边框/glyph；灰度下依赖形状但视觉重量偏弱，建议 done 的 sub 用 `label-primary` 的 80% 或 success 文本 token。

## 4. 已消除 / 未验证

**代码层已消除的旧硬伤（待截图确认）**
- 单行 60px 运行条替代 84px 品牌头 + 46px 运行条；重复品牌与 9 个等权按钮收进“更多”。
- 3 泳道 world bbox 1076×304 替代 3166px 一字长蛇；1024 根下 fit≈0.892，理论上 15/15 可见。
- 检查器默认关闭、360 浮层，画布不再被常驻 320 挤压；空态有 3 条泳道骨架 + 最近运行 + 单一 primary。
- `hardBlocked` 与 soft block 分离（`60-shell.js:74`），由主按钮解决的 blocker 不再自动禁用；空态蓝图禁用。
- 节点状态有中文映射与 shape 通道（左轨/点/斜纹/双线/glyph），edge 有 execution tone。

**未验证（不能签收）**
- 无当前 build 截图：对比度、深色主题、真实 1024 布局、focus ring、灰度可分、边线/箭头是否压端口均未看像素。
- 无 build 后截图：`client.js` 已 current，但 3080 上是否已加载新 bundle 未验证；旧截图不能当新界面证据（且 dock 截图重复）。
- 无 manifest；无 01:03 之后的截图；设计门只能记录“代码初审”，不能记录“视觉通过”。

## 5. 门禁结论

- S1 共 5 项；其中 S1-01/02 是“唯一动作”与执行语义，S1-03/04 是 1024 可读性与验收可执行性，S1-05 是进度真值。
- S1 全部修完 + build + 4 组截图（1440/1024 × light/dark，running/empty/selected/blocked）+ 11 清单通过后，才可提交设计签字。
- 在此之前，任何“视觉已通过”的说法不成立。
