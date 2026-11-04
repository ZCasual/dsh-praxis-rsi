# DSH 平台装配与上线路径取证

更新时间：2026-11-04。范围：只读安装包、原型、CLI 与当前 Web 地址；未修改源码、profile 或 profile package.json。

状态标记：

- **已验证**：读取了当前安装包/工作区文件或运行了命令并记录输出。
- **未验证**：当前运行条件不允许可靠验证，保留准确原因，不用推测代替。

## 1. WebServer 路由

### 1.1 准确 API

**已验证。** 当前安装包的类型定义是：

- `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-host-webserver/lib/types/index.d.ts:31-47` 定义 `WebRoute`：`kind: 'exact' | 'prefix'`、`path: string`、`handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>`。
- 同文件 `:169-174` 定义 `WebServer.register(route: WebRoute): () => void`，重复 `(kind,path)` 会抛错，成功返回移除路由的 disposer。
- 因此准确写法为：

```ts
const dispose = ctx.webServer.register({
  kind: 'prefix',
  path: '/praxis',
  handler: async (req, res) => {
    // handler owns the complete response lifecycle.
  },
})
```

`path` 是绝对 pathname；类型注释要求无尾 `/`（`index.d.ts:31-40`）。Prefix 同时匹配 `/praxis` 与 `/praxis/<anything>`，实现位于已装包 `lib/index.js:494-503`：exact 优先，prefix 取最长匹配，之后才 fallback。路由 handler 在 `lib/index.js:377-405` 被调用，异常会记录并返回 400（若 headers 已发出则销毁 socket）。

### 1.2 是否可用、生命周期

**已验证（静态）。** `ctx.webServer` 只有在 Host 注入 `@deepseek-ai/dsh-host-webserver` 时可用；类型文件 `index.d.ts:16-20` 通过 Cordis module augmentation 声明 `Context.webServer: WebServer`。webServer 自身在 `lib/index.js:249-291` 构造，在 `:376-493` listen；`register` 不需要等待路由启动，但插件应在 `apply` 中注册，并用 `ctx.effect` 保存 disposer。

推荐：

```ts
export const inject = ['webServer']
export function apply(ctx) {
  const dispose = ctx.webServer.register({ kind: 'prefix', path: '/praxis', handler })
  ctx.effect(() => dispose, 'praxis web routes')
}
```

### 1.3 loopback 与同源校验

webServer 本身没有 server-wide authentication/origin policy。安装包 README `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-host-webserver/README.md:127-131` 明确说明：route owner 自己负责 request policy，非 loopback 绑定会暴露未保护路由。

**已验证。** 可复用的同源参考是 `reference/github/dsh-superagent-prototype/src/app/http.ts:230-247`：

```ts
if (ctx.webServer.host !== '127.0.0.1') throw new Error(...)
ctx.webServer.register({
  kind: 'prefix',
  path: '/orchestrator',
  handler: async (req, res) => {
    if (!sameOrigin(req, ctx.webServer.port)) {
      json(res, 403, { error: 'Same-origin management request required' })
      return
    }
    // route and serialize response
  },
})
```

其 `sameOrigin` 实现位于同文件 `:75-79`：Host 必须是 `127.0.0.1:<port>` 或 `localhost:<port>`，要求 `x-orchestrator-request: 1`，Origin 若存在必须等于当前 Host 的 `http://` origin。该校验属于原型业务层，不是 webServer 内置能力。Praxis 应使用同样的 loopback guard，并且明确拒绝或审慎处理 Origin/Host，而不是认为 prefix route 自带认证。

## 2. Client half 装配

### 2.1 package.json 字段

**已验证。** 官方 decoration 模板 `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/templates/decoration/package.json:1-21` 给出可工作的最小形状：

```json
{
  "name": "@local/dsh-praxis",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",
    "./locale/*.json": "./locale/*.json",
    "./icon": "./icon.svg"
  },
  "files": ["index.js", "client.js", "cordis.patch.yml", "locale/*.json", "icon.svg"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true,
      "inject": ["@deepseek-ai/dsh-client-ui-conversation"]
    }
  }
}
```

字段校验在当前 `dsh-client-modules/lib/client.js:61-74`：`dsh.client` 是对象，`platform` 必须 string；`inject`、`external` 如存在必须为 string array；`immediately` 如存在必须 boolean。`external` 只有在 Client bundle 使用非 baseline runtime module 时才声明；不要把所有 import 都写进 external。

`dsh.client` 的 browser artifact 是 `./client` export；`@deepseek-ai/dsh-client-modules` 的 manifest 类型在 `lib/types/client/manifest.d.ts:41-64` 定义 boot graph row 的 `id,url,rev,inject?,immediately?,external?`。普通 bundle 的 package id 是 entry id。

### 2.2 `window.__ModuleLoader__.load`

**已验证。** “只调用 load 是否足够”要分两种情况：

- 对已由 Host boot graph 投递、且页面已加载 `client-modules` facade 的 bundle，`window.__ModuleLoader__.load({id,factory})` 是正确且必要的 factory 注册形式；`manifest.d.ts:223-239` 定义 facade 的 `load(registration)` 和 `pendingQueue`。
- 它**不是完整插件装配**：Host 还必须把 package 的 client entry 放入 `__DSH_BOOT__` graph，并由 Cordis/Loader import/mount；factory 必须返回 `{ inject, apply }` exports。仅在页面 console 手动调用 `load` 不会自动挂载插件。

当前已装 package 的真实 client 形式是 `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-modules/lib/client.js:1-4`：

```js
window.__ModuleLoader__.load({
  id: '@deepseek-ai/dsh-client-modules',
  factory: (require) => { /* return exports */ },
})
```

官方 decoration 模板 `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-agent-preset/skills/cordis-plugin-development/templates/decoration/client.js:1-22` 给出插件实际形状：

```js
window.__ModuleLoader__.load({
  id: '@local/dsh-praxis',
  factory(require) {
    const React = require('react')
    return {
      inject: ['slots'],
      apply(ctx) { /* ctx.slots.inject(...) */ },
    }
  },
})
```

`manifest.d.ts:195-205` 规定 `factory(require)` 的精确类型，`require` 可同步取 module-table dependency，`require.async` 用于 package-local dynamic chunk。

### 2.3 负缓存、materialization 与重启

**已验证。** `dsh-client-modules/lib/types/client/manifest.d.ts:9-24` 和当前 `lib/client.js` 的实现说明：

- 执行 bundle 只注册 factory；factory body 和 CSS side effects 在 materialization 时执行。
- materialization 结果写入 `ClientModuleLoader.loadCache`，类型定义见 `manifest.d.ts:241-250`。
- `importError(id)` 记录最近一次 import/prefetch 失败（`manifest.d.ts:287-295`）；失败在后续成功或 `invalidate` 时清除。
- `invalidate(id, rev?)` 会丢弃 entry/chunk factories、materialized records 和错误，下一次 prefetch/import 重新获取（`manifest.d.ts:297-305`）。
- 重复执行相同 revision 的 bundle 会在 `lib/client.js:701-713` 抛 duplicate factory registration；不能靠重复 script 解决缓存问题。
- bootstrap module 不能通过 HMR replacement 替换；`lib/client.js:673-675` 明确要求 page reload。

**Host release 与重启。** `lib/client.js:227-280` 的 `ReleaseChangeGate` 在 Host release 与页面 boot release 不同的时候暂停 graph/frame 应用并提示 reload。`@deepseek-ai/dsh-client-hmr/README.md:62-74` 说明普通 graph/rebuilt frame 可热替换，但 Host release 变化仍需页面 reload。对本插件的工程规则：

- 新增 bundle/普通 enable-disable：若当前 web composition 有 HMR，通常可不重启 Host；页面 graph 会同步。
- 替换已安装 package、涉及 host-loaded module、profile 无 HMR 或 HMR 报 `restart-required`：重启 Host，并刷新页面。
- 动态 Client definitions 是 process-local；`@deepseek-ai/dsh-cordis-host-runner/README.md:12` 说明 restart 清空，页面 reload 需要重新加载 Client half。

### 2.4 occupant 判断

**未验证 live 值；已验证查询契约与返回形状。** 当前 Client Inspect 请求 `Slots.listSubTree` 对 `main`、`sidebar.panellist` 和 `Builtin` 均在 10 秒超时，原因是当前页面/Client inspect transport 不可用。不能据此声称当前 slot 已占用或空闲。

已安装 runner 的实现 `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:7086-7101` 给出准确行为：

```json
{ "root": "main" }
```

传给 `ctx.get('slots').snapshot(root)`；返回 `trees`，选择第一个 tree 为 `selected`。精确 Slot 的 `selected` 包含 `occupants`（`client.js:7185-7200`），而不是把树的 `children` 当 occupant。判断规则：

- `requestedRoot.available === false`：slot 不存在/当前 Client 未挂载。
- `selected.type === 'slot'` 且 `selected.occupants` 为空：当前没有 occupant，可注册。
- `selected.occupants` 非空：已有人注册；先检查 occupant 的 `id/key/order` 和 slot 的 `catalog.registration`，避免重复 key 或覆盖风险。
- `selected.type === 'factory'`：查询的是 Factory，不是 Slot；不能用它判断 slot occupant。

查询 schema/说明在 runner `client.js:7076-7084`：输入对象只有可选 `root: string`，输出为 topology trees、requestedRoot、selected、referencedTypes。实际 live 查询需要先打开/重连 Harness 页面；本轮没有完成该验证。

## 3. 本地目录 bundle 安装

### 3.1 plugin_manager install_bundle target

**已验证（静态源码）。** 当前 Plugin Manager 的 `parseInstallSpec` 位于：

`/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-plugin-manager/lib/types/install-spec.js:50-86`。

它接受：

- npm package 名称/range；
- git shorthand/URL；
- tarball；
- **绝对本地目录**；
- `file:/absolute/path` 或 `link:/absolute/path`，因为 `:62-66` 去掉 scheme 后要求 `isAbsolute(path)`。

相对路径会拒绝（`:68-69`），错误原因是 `a local path must be absolute`。因此 Agent-facing `plugin_manager` 的 `install_bundle.target` 可传：

```text
/home/z/CBAT-W/zbh/plugins/dsh-praxis
file:/home/z/CBAT-W/zbh/plugins/dsh-praxis
link:/home/z/CBAT-W/zbh/plugins/dsh-praxis
```

推荐开发用 `link:/absolute/path`，因为 profile package.json 会保留 link source，修改 workspace build output 后便于 HMR/重载；发布或不可变安装才使用 directory/file semantics。最终能否作为 bundle 管理取决于 package 声明 `dsh.bundle.patch`，否则结果是 `error.code: 'not-bundle'`。

Plugin Manager types `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-plugin-manager/lib/types/types.d.ts:114-143` 定义安装结果：`application` 为 `applied | restart-required | overridden | failed | cancelled`，并含 `stage,target,error,pendingBuilds,approvedBuilds` 等字段。工具文案及下一步逻辑在 `types/tools.js:7-20,23-40,46-66`。

### 3.2 `dsh plugin add <path>` 替代路径

**已验证（静态源码；本轮实际执行受 profile 只读阻断）。** `dsh plugin` 只是把剩余参数原样转发给 profile 目录中的 pnpm：

- `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/lib/bin.js:115-126`：`dsh plugin --profile <name> <pnpm-args...>`；示例 `dsh plugin --profile tui add <package>`。
- `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/lib/plugin-BiveYA7h.js:57-98`：`runPlugin` 将 args 交给 `runPluginCommand`/pnpm，工作目录是目标 profile。

因此可行命令是：

```bash
dsh plugin --profile web add link:/home/z/CBAT-W/zbh/plugins/dsh-praxis
# 或
pnpm dsh plugin --profile web add link:/home/z/CBAT-W/zbh/plugins/dsh-praxis
```

它会把 dependency 记录在目标 profile 的 `package.json`，本工作区当前 web profile 的实际文件是 `/home/z/.dsh/profiles/web/package.json:1-25`。该文件目前已有 `dsh-better-sidebar`、`dsh-context-diet` 等依赖，未有 Praxis；没有修改它。

### 3.3 审批禁用时的行为

**已验证（工具代码与本运行政策）。** `plugin_manager` 工具在 `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-plugin-manager/lib/types/tools.js:69-99` 先调用 `approveEscalation`，要求 `danger-full-access` 或可用 approval；随后才调用 manager。当前运行上下文明确为“Approval prompts are disabled”，因此需要审批的 Plugin Manager action 会被拒绝，不应期待安装/启用发生。具体的 UI/remote error wrapper 取决于调用入口；本轮没有调用修改动作，避免误报一个未观察的 wrapper 字符串。

同一政策下，直接 `dsh plugin --profile web add ...` 也需要写 `/home/z/.dsh/profiles/web/package.json`/lock；本轮实际命令 `dsh plugin --profile web add --help` 已失败，原文为：

```text
Error: EROFS: read-only file system, open '/home/z/.dsh/profiles/web/package.json.lock'
[exit code: 1]
```

这证明当前工作区 sandbox 不能把替代 CLI 当作本轮可行安装路径。它不是 Plugin Manager 业务拒绝，而是 profile 文件系统只读。

## 4. 启用与重启 Web profile

### 4.1 当前 profile 与端口

**已验证。** 当前环境变量：

```text
DSH_HOME=/home/z/.dsh
DSH_PROFILE=web
DSH_PROFILE_DIR=/home/z/.dsh/profiles/web
```

当前 profile package.json 的 bundle 顺序在 `/home/z/.dsh/profiles/web/package.json:11-23`；用户 patch 在 `/home/z/.dsh/profiles/web/cordis.patch.yml:1-49`。DSH launcher README 的命令说明（安装包 README 可见于 `/home/z/.npm-global/lib/node_modules/@deepseek-ai/dsh/README.md` 的 installed package root；本 shell 只读过程未能稳定读取该路径）和 `bin.js:39-49` 确认：

```bash
dsh web
# 等价
 dsh --profile web
```

Web 应用自己的 `--port` 属于 app 参数；若 profile patch 的 webserver 保持 3080，就使用 `dsh web` 让它监听相同地址。

### 4.2 推荐重启命令与验证

**命令原文（已验证 launcher 语义，未在本轮重启）：**

```bash
# 先停止当前 profile 进程（由运行它的终端/进程管理器执行）
# 再启动
DSH_HOME=/home/z/.dsh dsh --profile web

# HTTP 可达性
curl -i http://127.0.0.1:3080/

# 页面/boot 检查；需按实际鉴权机制处理 401
curl -sS -D - http://127.0.0.1:3080/ -o /tmp/dsh-web.html
```

本轮 `curl -sS -o /tmp/dsh-web-check.html -w 'HTTP %{http_code}\n' http://127.0.0.1:3080/` 实际输出：

```text
HTTP 401
```

页面服务端口存在，但当前无可用浏览器鉴权 cookie。必须区分“端口 reachable”与“Web GUI 已通过认证/已加载插件”。

如果 profile 启用了 HMR，普通 bundle enable/disable/Client rebuild 可不重启；`@deepseek-ai/dsh-client-hmr/README.md:10-12,30-36` 说明 HMR 会同步 graph/rebuilt frame 并重挂 Client。若安装结果为 `restart-required`、profile 无 HMR、替换 package 触及 host module，必须停掉旧 `dsh web` 后重新执行上述命令，再刷新 `http://127.0.0.1:3080/`。

### 4.3 本轮不可执行的原因

**已验证。** `dsh web --help` 也会先准备 profile root，当前失败原文：

```text
Error: EROFS: read-only file system, open '/home/z/.dsh/profiles/web/cordis.yml'
[exit code: 1]
```

因此本轮没有重启、没有写 profile、没有安装 bundle；不能声称 Praxis 已启用或 HMR 已生效。

## 5. 无头 Chrome 截图

### 5.1 可行命令

**已验证。** 当前系统二进制为 `/usr/bin/google-chrome`。可用独立 user-data-dir，不触碰个人 Chrome 数据：

```bash
tmpdir=$(mktemp -d /tmp/dsh-chrome-profile.XXXXXX)
google-chrome \
  --headless=new \
  --no-sandbox \
  --disable-gpu \
  --disable-dev-shm-usage \
  --user-data-dir="$tmpdir" \
  --window-size=1440,1000 \
  --screenshot=/tmp/dsh-web.png \
  --dump-dom \
  http://127.0.0.1:3080/ \
  > /tmp/dsh-web-dom.html \
  2> /tmp/dsh-chrome.err
status=$?
printf 'exit=%s\n' "$status"
test -s /tmp/dsh-web.png && file /tmp/dsh-web.png
head -n 20 /tmp/dsh-web-dom.html
rm -rf "$tmpdir"
```

本轮实际执行了同等命令（带独立 `/tmp/dsh-chrome-profile.*`，未使用个人数据），输出：

```text
exit=0
/tmp/dsh-web.png: PNG image data, 1440 x 1000, 8-bit/color RGB, non-interlaced
<html>...dsh web authentication required; reopen the URL printed by dsh web...</html>
```

### 5.2 如何确认页面已加载

分三层判断：

1. **网络服务**：`curl -i` 返回 HTTP response；本轮是 `401`，说明端口服务存在。
2. **浏览器 document**：Chrome exit 0、PNG 非空、`--dump-dom` 有 HTML；本轮已满足，但内容是鉴权提示，不是应用 shell。
3. **DSH GUI/插件已加载**：需要认证 cookie 或实际 URL 打印出的 auth context；然后检查 DOM/截图中 Web shell，或通过 `cordis_inspect_query` 查询 Client slots/插件 entry。当前 `Slots.listSubTree` 也超时，故这一层**未验证**。

不要把一张 401 错误页面截图报告为插件 UI 成功。需要先用运行 profile 打印/提供的 URL 和认证方式启动已认证浏览器，再重复相同 user-data-dir 隔离流程。

## 6. 五条结论摘要

1. **Web route：已验证。** `ctx.webServer.register({kind:'prefix',path:'/praxis',handler})` 的 handler 是 `(IncomingMessage,ServerResponse)=>void|Promise<void>`，返回 disposer；签名在 `dsh-host-webserver/lib/types/index.d.ts:31-47,169-174`，实现和最长 prefix 在 `lib/index.js:321-333,494-503`。同源必须由路由 owner 自己做，原型示例在 `reference/github/dsh-superagent-prototype/src/app/http.ts:231-247`。
2. **Client half：部分已验证。** package 需要 `exports['./client']`, `dsh.client.platform`, 可选 `immediately/inject/external`；模板在 decoration `package.json:6-20`。`__ModuleLoader__.load({id,factory})` 只注册 factory，不替代 boot graph/Cordis mount；loader contract 在 `manifest.d.ts:195-230`。occupant 应读 `Slots.listSubTree({root})` 的 `selected.occupants`，代码契约在 `dsh-cordis-client-runner/lib/client.js:7086-7101,7185-7200`；当前 live 查询超时，未验证实时 occupant。
3. **安装：已验证静态，未执行成功。** `install_bundle.target` 支持绝对目录、`file:/absolute`, `link:/absolute`，源码 `dsh-plugin-manager/lib/types/install-spec.js:50-86`；`dsh plugin --profile web add link:/...` 是 pnpm 转发，`dsh/lib/bin.js:115-126`。当前审批/文件权限均阻断 profile mutation；实际 CLI 返回 EROFS，不能把它当安装成功。
4. **重启：命令已验证语义，动作未验证。** 使用 `dsh --profile web`/`dsh web`，确认 `DSH_PROFILE_DIR=/home/z/.dsh/profiles/web` 和 `curl http://127.0.0.1:3080/`；当前 curl 为 HTTP 401，`dsh web --help` 因 profile `cordis.yml` EROFS 失败，故 Praxis 启用和重启后 3080 可用未验证。
5. **截图：已验证命令可运行。** `/usr/bin/google-chrome --headless=new --user-data-dir=/tmp/... --screenshot=... --dump-dom http://127.0.0.1:3080/` 生成 1440×1000 PNG、exit 0；但本轮 screenshot 是 401 auth page，不是 GUI。确认真实页面必须有认证上下文，再检查 shell/Client slot/entry；当前 Client Inspect 超时，未验证。
