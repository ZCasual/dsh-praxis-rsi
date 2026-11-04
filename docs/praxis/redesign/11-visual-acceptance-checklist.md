# 11 · 视觉验收清单 v1（可自动化）

> 对应 [10-v2-contract §5.7](./10-v2-contract.md)。这是浏览器测试的断言清单，不是设计稿说明。
> 判定规则：表中 **B**（blocking）项全部通过才算视觉门通过；任何一项失败必须输出场景名、实际值、期望值、截图路径。
> 所有度量在 `.px-shell` 根节点内进行；选择器优先使用 §5.7/D5-11 规定的 `data-*`，class 只作后备。

## 0. 夹具与场景

| 场景 id | 数据/操作 | 期望根尺寸 | 主题 |
|---|---|---|---|
| `running-1440` | 默认 playbook 15 节点；4 done、1 active、10 pending；无 inspector | `.px-shell` = 1160×940（全应用，宿主侧栏 280） | light / dark |
| `running-1024` | 同上，宿主侧栏折叠或独立挂载（**签收根**） | `.px-shell` = 1024×840 | light / dark |
| `running-1024-compat` | 同上，1024 全应用，宿主侧栏 280（**compat，不签收**） | `.px-shell` = 744×840 | light / dark |
| `running-700` | 同上，700×600 视口 | `.px-shell` = 700×600 | light |
| `empty` | 无 Run、无 graph；最近 Run 0–3 条 | 同上两个尺寸 | light / dark |
| `loading` | `/state` 延迟 ≥2s | 1440 | light |
| `error` | `/state` 返回 500，且无旧 snapshot | 1440 | light |
| `stale` | 命令返回 409，响应带新 view | 1440 | light |
| `audit-fail` | graph.audit.ok=false，violations 非空 | 1440 | light |
| `selected` | 在 `running` 上选中 `n_review`（非 current） | 1440 / 1024 | light / dark |
| `drawer-source` | 打开源码抽屉（有“保存”primary） | 1440 | light |
| `modal-confirm` | 打开“确认保存蓝图”模态（有“确认保存”primary） | 1440 | light |
| `blocked` | current = `g_prereg`，condition=missing | 1440 | light |
| `nodes-14` | 移除 `n_synthesis` 的默认图 | 1440 | light |

固定前置：Store `phase='fresh'`；调用一次“适配”；不 hover、不 focus；inspector/drawer 关闭，除 `selected`；截图关闭动画（`prefers-reduced-motion` 或等待 300ms）。

## 1. 度量函数（测试共用）

```js
const rect = (el) => el.getBoundingClientRect();
const shown = (el) => {
  const r = rect(el), cs = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && cs.display !== 'none'
    && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01;
};
const inside = (a, b, tol = 0.5) =>
  a.left >= b.left - tol && a.top >= b.top - tol && a.right <= b.right + tol && a.bottom <= b.bottom + tol;
const worldScale = () => Number(document.querySelector('[data-testid="world"]').dataset.scale);
const effectiveFont = (el) => parseFloat(getComputedStyle(el).fontSize) * worldScale();
function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg, bg) {
  const a = luminance(fg), b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
```

`bbox` 取全部 `.px-node` 的并集，外扩 4px；`canvas` 取 `[data-testid="canvas"]`；面积 = bboxW×bboxH / (canvasW×canvasH)。

## 2. 断言表

| ID | 检查项 | 选择器 / 度量方法 | 阈值 | 失败示例 |
|---|---|---|---|---|
| **B-V01** | 可见节点比例 | 全部 `.px-node`：`shown()` 且 `inside(nodeRect, canvasRect)` | 100%（15/15；14 节点夹具 14/14） | 12/15，右侧 Prereg Gate 超出 canvas 40px |
| **B-V02** | 内容包围盒占比（canonical 892×304） | 节点并集外扩 4px，按测量根测 `W/Wc`、`H/Hc`、`area` | 1440 签收根：宽≥0.75、高≥0.28、面积≥0.24；1024 签收根：宽≥0.85、高≥0.28、面积≥0.28；1024 compat / 700：不套 | 1440 宽 0.769 通过；若用旧阈值 0.90 则假红；面积 <0.24 或高 <0.28 |
| **B-V03** | primary 按钮数量 | `.px-btn.primary` 且 `shown()`；按场景矩阵 | running/blocked/empty/selected=1；loading=0；error=1（重试）；任意场景 ≤1 | 同屏 3 个黑按钮（新建/冻结/提交） |
| **B-V04** | 内部码出现次数 | 扫描 `.px-runbar,.px-node,.px-empty*,.px-inspector,.px-run-item` 的可见文本，排除 `[data-technical],code,pre,[data-raw=true]`；见 §3.1 正则 | 0；节点标题 CJK 覆盖 100%；primary 文本不匹配 `^[a-z_]+$` | 节点出现 `gate:prereg`；检查器出现 `prereg_freeze`；`PENDING` |
| **B-V05** | current/selected 去色可分 | `selected` 场景：DOM 形状断言 + 注入 `html{filter:grayscale(1)}` 截图两节点 ±8px 裁切 | 像素差 ≥0.8%；current 左轨 3px 且亮度差 ≥0.05；selected `outline-style=dashed`、2px、offset 3 | current 与 selected 都是 1px 实线 brand 边框，像素差 0% |
| **B-V06** | 字号下限（有效，仅签收根） | `effectiveFont()` 取样：节点 title/sub/chip、泳道 label、运行条 title/status、检查器 body/label；1440/1024 签收根 fit=1.0 | title≥11；sub≥9.5；chip/lane≥9；runbar title≥12；runbar status≥10；inspector body≥11.5、label≥10；无可读文本<9。1024 compat / 700 不套，必须出提示 | 签收根 title 10.0；chip 8.9 |
| **B-V07** | 1024 无横向溢出 | `document.documentElement.scrollWidth ≤ innerWidth`；`shell.scrollWidth ≤ shell.clientWidth`；根 1024 签收 / 744 compat | 两种口径均 0px 溢出；所有主要区域 rect 在 shell 内 | 页面 scrollWidth=1040；运行条溢出 24px |
| **B-V08** | 明暗主题对比度 | 解析 `getComputedStyle` 前景/背景；按 §3.3 配对；亮/暗各测 | 文本≥4.5:1；非文本（左轨/虚线环/箭头/进度/focus）≥3:1 | 暗色 label-secondary 3.1:1；warn chip 3.8:1 |
| **B-V09** | 空态唯一入口 | `data-scene=empty`：`.px-btn.primary` 数；“新建研究运行”出现数；最近 Run 行数；`.px-node` 数；蓝图是否可用 | primary=1；“新建研究运行”=1；最近 Run≤3 且非 primary；节点=0；泳道骨架标签=3；蓝图禁用 | 空态有“新建研究运行”+“新建运行”两个主入口 |
| B-V10 | 截断与重叠 | `.px-run-title,.px-node-title span,.px-node-sub,.px-node-chip`：`scrollWidth>clientWidth+1` 时必须 `text-overflow=ellipsis` 且有 title/aria-label；运行条子元素两两相交面积=0 | 0 个无提示截断；0 对重叠 | 标题被裁无 title；primary 与进度重叠 |
| B-V11 | 进度语义唯一 | `[data-testid="progress"]` 数量；文本匹配 `^当前阶段 \d+/10$` 或契约指定格式 | 1 个；不得用节点 done/total 冒充阶段；空态不渲染 `0/0` | 运行条显示 `4/15`，同时状态 chip 显示 `Question` |
| B-V12 | 运行模态破坏控件 | `.px-danger`、`[data-testid="port"]`、删除菜单项 | 运行态 0；蓝图态仅在确认后出现 | 运行态出现“删除节点” |
| B-V13 | 检查器默认/位移/遮挡 | 默认无 `.px-inspector`；打开前后节点 rect 差；selected 节点 rect ∩ inspector rect | 默认关闭；rect 变化 ≤1px；交集面积=0；首屏 `.px-field` ≤5 | 打开面板画布右移 360px；选中节点被面板盖住 |
| B-V14 | 横/竖屏横幅不推画布 | `audit-fail`/`stale`/`error` 场景对比节点 rect；横幅文本；错误态含最后成功时间 | 节点 rect 变化 ≤1px；横幅可见且为中文；错误态有 `最后成功 HH:MM` | 出现横幅后画布高度减少 40px |
| B-V15 | 状态场景正确性 | `empty/loading/error/stale/audit-fail` 各自的 primary、节点、横幅、旧数据 | loading 0 primary 且无 current；error 1 primary + 重试；stale/audit 保留修复动作 | loading 显示旧 current；error 无重试 |
| B-V16 | 连线几何 | SVG `.px-edge` 路径采样 20 点；长度/曼哈顿；与节点矩形相交；箭头终点距节点 | 长度比 ≤1.15；0 交点（端点 4px 除外）；箭头在边界外 ≥4px；描边 1.2–1.6 | 28px 间隙出现反向 S 卷；箭头被端口圆点遮住 |
| B-V17 | 泳道是导轨不是卡片 | 3 个 `[data-lane]` 标签的 y 与 §2.1 公式；`.px-lane` 背景 alpha、圆角、阴影 | 标签=3；y 误差 ≤2px；背景 alpha ≤0.05；无圆角容器/阴影 | 三条 55% 填充大卡片包住节点 |
| B-V18 | 14 节点夹具 | `nodes-14`：可见数、节点计数文案、泳道标签 | 14/14 可见；计数=14；布局不写死 15 | 少一个节点仍显示 15/15 |
| B-V19 | 键盘与焦点 | Tab 顺序覆盖 primary/更多/节点；Esc 关 inspector/drawer；focus-visible 计算样式 | 可达；Esc 生效；2px 可见环；对比≥3 | 键盘聚焦无可见环；Esc 不关闭 |
| B-V20 | 主按钮执行语义 | 无 payload 动作点击 → `/command` 请求；有 payload → inspector 打开且首字段聚焦；blocker 由该动作解决时按钮 enabled | 200ms 内发请求 / 焦点正确 / enabled；不得 dead click | 点击“冻结预注册”只选中节点，不发命令 |
| **B-V21** | 1024 全应用 compat | `.px-shell` 744×840；15 节点可见；`[data-testid=hint]` 出现；页面/根无横向溢出；画布拖拽改变 pan | 15/15；hint 可见；overflow 0；pan Δ≥10px；不套字号/面积 | 744 宽下节点被裁或没有提示；拿 compat 当签收 |
| **B-V22** | 700×600 降级 | `.px-shell` 700×600；15 节点可见；hint 可见；拖拽可用 | 15/15；hint 可见；pan 可用；不套字号/面积 | 700 下仍套 0.75 宽阈值假红 |

## 3. 复杂断言实现

### 3.1 内部码正则（B-V04）

```js
const forbidden = [
  /\b[a-z]+(?:_[a-z]+)+\b/,                                  // prereg_freeze, close-or-new-run
  /\b(?:gate|stage|action|node)\s*[:：]\s*[a-z0-9_-]+/i,     // gate:prereg
  /\b(?:INTAKE|QUESTION|PREREG_FROZEN|DISCUSSION|EXECUTING|REVIEW|STAGE4|EVAL|MEMORY|DECISION)\b/,
  /\b(?:pending|active|done|blocked|failed|quarantined)\b/i, // 裸执行态
];
```
失败示例：节点副行 `gate · prereg`、检查器“可执行动作 prereg_freeze”、执行态 `PENDING`。允许出现在 `[data-technical]` 折叠区内的原始值。

### 3.2 current/selected 灰度（B-V05）

1. 场景 `selected`：current=`n_question`，selected=`n_review`；
2. DOM 断言：current 的 `::before` 宽 3px、`data-current=true`；selected 的 `outline-style` 为 `dashed`、`outline-width` 2px、`outline-offset` 3px；两者不得共享同一 `border` 签名；
3. `page.addStyleTag({content:'html{filter:grayscale(1)!important}'})`；
4. 截图整张 canvas，按两节点 rect 外扩 8px 裁切；
5. `diff = count(|a-b| > 8) / (w*h)`；要求 `diff ≥ 0.008`；
6. current 裁切左侧 3px 列的平均亮度与节点内部亮度差 ≥0.05。

失败示例：两者都只有 1px 实线 brand 边框，灰度后差异 <0.1%。

### 3.3 对比度配对（B-V08）

| 前景 | 背景 | 阈值 |
|---|---|---|
| node title / node sub / chip | `.px-node` 背景 | 4.5 |
| runbar title / status / progress text | `.px-shell` 背景 | 4.5 |
| primary 文本 | primary 填充 | 4.5 |
| warn/error/success chip 文本 | 各自底色 | 4.5 |
| current 左轨 / selected 虚线 / 箭头 | node 背景 / canvas | 3.0 |
| focus ring | 相邻背景 | 3.0 |
| lane label | canvas | 4.5 |

### 3.4 主按钮场景矩阵（B-V03 / B-V20）

| scene | `.px-btn.primary` | 说明 |
|---|---|---|
| running | 1 | 运行条动作，catalog 中文 label |
| blocked（可由 primary 解决） | 1 | 保持 enabled，旁边有可见原因 |
| blocked（audit/conflict） | 1 | 修复动作，不得全禁 |
| empty | 1 | `新建研究运行` |
| loading | 0 | 骨架屏 |
| error | 1 | `重试` |
| selected + inspector 有动作 | 1 | 在 inspector，runbar 不渲染 primary |
| selected + inspector 无动作 | 1 | 保留 runbar primary |
| drawer-source | 1 | 顶层抽屉 primary；底层 runbar primary 隐藏/inert |
| modal-confirm | 1 | 顶层模态 primary；底层 primary 隐藏/inert |

## 4. 记录格式

每条失败必须记录：`scene` / `id` / `selector` / `expected` / `actual` / `screenshot`；S1 阻断合并，S2 当日修，S3 进视觉债务。截图 manifest 使用 D3 的 `sha256 + viewport + theme + scene + build hash`，同一 build 不得复用旧截图（本轮已出现 `dock-light` 与 `canvas-inspector-advanced-light` 同 sha256 的重复证据）。
