# 13 · 像素签收 v2（当前 build）

> 日期：2026-11-05 01:42（北京时间）。只读评审，未改代码。
> 证据：`/tmp/praxis-preview/` 下 01:26–01:28 截图与 metrics；`build-client.mjs --check` 01:34 通过（sha256 `af2e59137057de65`）。
> 对应：[10-v2-contract §5.7](./10-v2-contract.md)、[11 视觉验收清单](./11-visual-acceptance-checklist.md)。
> 结论先行：**本轮不签收（2 个 S1）**；布局、泳道、空态、蓝图通过；1024 全应用只能按 compat 记录；1440 浅色默认截图被抽屉污染，不能作为 canonical 证据。

## 1. 场景裁决

| 场景 | 文件 | 裁决 | 关键证据 |
|---|---|---|---|
| 1440 深色运行 | `frozen-dark-1440x1000.png` | **通过（布局）** | 15/15 节点、3 条纸面导轨、1 个 primary、无遮挡；上下留白对称 |
| 1440 浅色运行 | `frozen-light-1440x1000.png` | **无效** | 截图实际打开了 480px 认知地图抽屉（metrics interaction 记录 menu→map），右侧 3 个节点被遮，不能当默认运行图 |
| 1440 浅色检查器 | `frozen-light-1440x1000-inspector.png` | **S1 失败** | 选中/当前节点「预注册」在 x≈1174–1330，检查器从 x≈1068 起，节点被完全盖住；右列 3 个节点均被盖 |
| 提交后 / 横幅 | `frozen-light-1440x1000-after-submit.png` | **S1 失败 + S2** | 顶部绿色横幅把画布整体下推 36px；检查器标题「讨论」但唯一主动作是「记录实验」 |
| 1024 全应用 | `frozen-light-1024x900.png` | **compat 不签收** | canvas 744×840、fit=0.762、15/15 可见、页面无横向溢出；无“视口不足”提示；有效字号 9.5/8.4/8.0 |
| 空态 1440 | `empty-light-1440x1000.png` | **通过** | 1 个 primary「新建研究运行」、3 条泳道骨架 + 标签、0 节点、无检查器；最近运行为 0 条 |
| 冷启动 | `empty-light-1440x1000-coldstart.png` | **证据无效** | 文件名是 coldstart，实际是运行中的「冷启动验收：结构可分离性」+ 检查器；没有 loading/骨架/空态冷启动 |
| 蓝图 1440 | `frozen-light-1440x1000-blueprint.png` | **通过（结构）** | 无运行条 primary；底部草稿栏唯一 primary「保存蓝图」；0 处修改；导轨与节点正常 |
| 1440 检查器（旧） | `frozen-light-1440x1000-inspector.png` 01:13 版本 | 不作为证据 | build 已更新；以 01:27 版本为准 |

## 2. S1（阻断签收）

### S1-A 检查器遮挡当前/选中节点（1440 宽屏也发生）

**证据**：`frozen-light-1440x1000-inspector.png`。1440 全应用下 canvas 1160×940，内容 bbox 892×304 居中；选中节点「预注册」screen x≈1174–1330，检查器 left≈1068、width 360，完全覆盖该节点；x 列 3 个节点（预注册 / 复核 / 决策）同时在面板后。`30-canvas.js:777` 的避让只覆盖 ≤1180 的底部 sheet，宽屏没有；Lead 所说的“窄屏相机避让”因此只解决了一半。

**影响**：打开检查器后，用户看不到正在检查的节点，也看不到该列的状态；“15/15 可见”在检查器打开时失效，画布与面板失去空间关系。

**修复**
- 在 `CanvasView` 对 `inspectorOpen` 增加宽屏避让：计算 `visibleRight = canvasW - (inspectorOpen ? 372 : 0)`，若选中/当前节点 rect 与该区域相交，平移相机使节点右缘 ≤ visibleRight−16；只在超出时平移，不重置 zoom。
- 或把检查器改为画布右列 dock（canvas 重排并重新 fit），但必须保留“节点不移动”或“全部可见”二选一，并在 11 清单里固定。
- 断言：1440/1024 打开检查器后，选中节点 rect 与 inspector rect 交集面积=0；15/15 节点可见（或明确记录“检查器打开时允许 12/15，但选中节点必须可见”）。B-V13。

### S1-B 检查器把“节点”和“运行下一步”混在一个面板

**证据**：`frozen-light-1440x1000-inspector.png`：检查器标题「预注册」，唯一主动作「提交讨论」；`after-submit`：标题「讨论」，主动作「记录实验」；`coldstart`：标题「研究问题」，主动作「冻结预注册」。当前实现的动作来自 `InspectActionFor(run, catalog)`（run state），不是选中节点（`40-inspector.js:126` 附近），所以选中任意历史节点都会出现一个不属于它的动作。

**影响**：用户会以为“提交讨论”是在操作预注册节点；对已走过节点更危险，会把运行级动作误认为节点级动作。

**修复**
- 动作区只在 `node.config.action === action.actionId` 或 `node.id === graph.current` 时显示为可执行；否则显示只读：“该节点已走过/未激活；下一步在运行条”。
- 检查器 header 明确节点状态，动作区加“运行下一步”标题并显示动作节点名；二者分离。
- 断言：selected 非 action 节点时，inspector 内 primary 数=0 或 disabled，且有只读说明；运行条 primary 仍可用。B-V20/B-V03。

## 3. S2（当日修/补证据）

| ID | 问题 | 证据 | 修复 |
|---|---|---|---|
| S2-A | 横幅出现推画布 36px | `after-submit` 截图；`70-css.js:104` flex auto | 固定 36px 槽或 overlay；节点 rect 变化 ≤1px；B-V14 |
| S2-B | 1024 compat 无“视口不足”提示 | 1024 截图无提示；`30-canvas.js:792-796` 只在 raw<0.75 触发，.762 不触发 | 触发条件改为 `raw<0.75 || canvasW<900`；加 `data-testid="viewport-hint"`；B-V21 |
| S2-C | 默认 1440 浅色截图被地图抽屉污染；metrics nodesVisible 不识别遮挡 | `frozen-light` metrics interaction drawer=map；drawer 480px 盖住右列 | 重新拍无抽屉的 canonical；B-V01 用 `elementFromPoint` 或减去 overlay 矩形 |
| S2-D | “冷启动”截图实际是运行态 | `empty-light-1440x1000-coldstart.png` 显示运行中的 run + inspector | 重拍 loading（骨架）与空态冷启动；B-V15 |
| S2-E | metrics 的 `fontSizeMin=10.5` 未乘 scale | 1024 compat 实际 8.0px；JSON 仍报 10.5 | 测试改用 `getComputedStyle fontSize × world[data-scale]`；B-V06 |
| S2-F | 对比度未进 metrics | 截图采样：light sub #61666b/#fff≈5.8、dark sub #9ea1a4/#232324≈6.05、dark lane label≈8.0；视觉通过但无计算值 | 输出 B-V08 的每对前景/背景 ratio；不依赖目测 |
| S2-G | 检查器 360px 在 1440 盖 3 个节点后，未提示“可平移” | 检查器截图；无箭头/遮蔽提示 | 与 S1-A 一起修；或面板底部加“← 已平移画布”状态 |

## 4. 重点项的明确判断

- **内容垂直居中造成的上下留白**：**通过，不作为阻断**。1440 下 892×304 内容居中，上下各≈318px（内容高占 32.3%），符合 D5-2 的 H≥0.28；视觉上是“纸面呼吸”，不是空场。若后续想更紧凑，只能改 laneGap/画布高度，不建议用放大填满造成字号跳变。
- **泳道纸面导轨**：**通过**。当前 CSS 已是透明 + 上下 1px 细线 + 水平 11px 标签（`30-canvas.js:1321-1322`），没有填充/圆角容器；截图里是三条导轨，不是三个卡片。深色下尤其清楚。
- **检查器与画布空间关系**：**不通过**（S1-A/S1-B）。面板遮住选中节点，且动作与节点不对应。
- **暗色对比度**：**视觉通过、数值待证**。节点副行、标题、导轨标签在深色截图可读；采样 ratio 6.05/8.0，但必须由 verifier 输出 B-V08 的计算值后才能签。
- **空态**：**通过**。唯一 primary、3 条导轨骨架、0 节点、无检查器；空态很空但可接受（单一入口清晰）。

## 5. 11 清单 rollup（本轮可判定项）

| 项 | 结果 |
|---|---|
| B-V01 可见节点 | 15/15 通过（检查器场景见 B-V13） |
| B-V02 内容占比 | 1440：76.9% / 32.3% / 24.9% **通过**；1024 签收根：87.1% / 36.2% / 31.5% **通过** |
| B-V03 primary 数量 | 截图中均=1；drawer/modal 场景未提供截图 |
| B-V04 内部码 | metrics internalTokens=[] 通过 |
| B-V05 灰度可分 | 未提供灰度截图，未判定 |
| B-V06 字号 | 签收根通过；1024 compat 不套；metrics 计算方式有误（S2-E） |
| B-V07 横向溢出 | 1440/1024 `docOverflowX=0` 通过 |
| B-V08 对比度 | 视觉通过；计算值缺失 |
| B-V09 空态唯一入口 | 通过 |
| B-V11 进度语义 | 3/10 阶段进度通过，无 0/0 |
| B-V13 检查器 | 遮挡失败（S1-A） |
| B-V14 横幅稳定 | 失败（S2-A） |
| B-V16 连线几何 | 视觉上正交、无 S 卷；未做路径采样 |
| B-V17 泳道导轨 | 通过 |
| B-V20 主按钮执行 | 截图不可判定 |
| B-V21 1024 compat | 提示缺失，失败（S2-B） |
| B-V22 700×600 | 未提供截图，未判定 |

## 6. 重新签收需要的最小补拍

1. 干净的 1440 light running（无抽屉、无 inspector、无 toast）。
2. 1440 light inspector，选中**当前节点**，修完 S1-A 后节点完全可见。
3. 1440 light selected **非 current 节点**，用来验证动作区只读（S1-B）。
4. 1024 全应用 compat：带“视口不足”提示，15/15 可见，无横向溢出。
5. 1024 签收根（宿主折叠/独立挂载）或书面豁免记录。
6. 700×600 降级：15/15 + 提示 + 拖拽。
7. loading / error / stale / audit-fail 四态；coldstart 不再用运行态冒充。
8. 灰度截图（current + selected 同时存在）、drawer/modal primary 场景、14 节点夹具。
9. metrics 增补：有效字号（×scale）、对比度逐对 ratio、遮挡检测、build hash + 截图 sha256 manifest。

修完 S1-A/S1-B 并补齐上述 1–4 项后，可重新提交像素签收。

---

## Revision 2 输入（2026-11-05 02:10）：S1 修复后的新证据

- build sha256 `7b286197f246`（`build-client.mjs --check` 通过），manifest：`docs/praxis/evidence/manifest-light.json`（14 张）、`manifest-dark.json`（13 张），`ok=true`。
- S1-A 已修：1440 打开检查器后，选中/当前节点与 inspector 交集 = 0（gap 16px），zoom 100% 不变，只做水平平移；1024 底部 sheet 下交集 = 0（垂直 89px 间距）。
- S1-B 已修：选中非当前/非归属节点时，检查器只显示只读块（`action-readonly`）且 primary=0，运行条保留唯一 primary；选中 current 节点时 inspector primary=1。
- 横幅改为画布内浮层（不推布局）；泳道为纸面导轨；`viewport-hint` 触发条件 `raw<0.75 || canvas<900 || worldScale<0.85`。
- 待 designer 复核的关键文件：`docs/praxis/screenshots/v2/clean-light-1440x1000.png`、`selected-light-1440x1000.png`、`selected-noncurrent-light-1440x1000.png`、`running-dark-1440x1000.png`、`blueprint-light-1440x1000.png`。
