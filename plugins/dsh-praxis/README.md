# Praxis（@local/dsh-praxis）

DSH 科研工作流引擎与观测台。面板名 Praxis，模型工具 `rsi_run`，HTTP API 前缀 `/praxis/api`。

## 结构

```text
index.js              Host 插件装配（工具、命令、HTTP 路由、持久化）
client/               Client 源码，构建为 client.js（build-client.mjs）
src/engine.js         Run 状态机、动作分派、权限、fork、迁移、receipt
src/graph.js          图模型、布局 v2、双轴状态、I1–I6 审计、端口推导
src/host.js           命令门面、view/catalog、evidence、委托 actor
src/http.js           wire v2 路由（200 / 409 / 422 / 428）
src/store.js          持久化适配
client.js             生成产物，禁止手改
```

## 已验证

- `node --test test/praxis/*.test.js` → 140 pass / 0 fail（状态机、双轴图状态、不变量、fork/迁移、wire v2、模块构建）。
- `node --test test/praxis/acceptance/*.test.js` → 真实 Chrome：1440/1024/700 视口、亮/暗实例、全生命周期到 `DECISION`。
- 证据：`docs/praxis/evidence/manifest.json`（ok=true，25 张截图，逐对 WCAG 对比度）。

## 构建

```bash
node build-client.mjs          # 生成 client.js
node build-client.mjs --check  # 校验是否最新
```

修改 `client/*.js` 后必须重建；DSH 需要重启才会重新加载 Client bundle。
