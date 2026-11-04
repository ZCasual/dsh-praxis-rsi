# 图模型与画布契约 v1（冻结）

> 画布不是视图，是 playbook 的可执行表示。UI 与源码编辑同一模型。

## 1. Graph

```js
Graph = {
  id: string,                 // `${playbookId}:v${version}`
  playbookId: string,
  version: number,
  name: string,
  nodes: Node[],
  edges: Edge[],
  updatedAt: string,
  contentHash: string,        // engine 计算
}

Node = {
  id: string,                 // 稳定；默认 `n_<stage>` 或 `g_<name>`
  type: 'start' | 'stage' | 'gate' | 'actor' | 'end',
  label: string,
  stage?: string,             // stage 节点对应 engine 状态
  role?: string,              // actor 节点
  config: {
    requiredArtifacts?: string[],
    action?: string,          // 点击节点可执行的 engine action
    gate?: string,            // gate 节点：prereg | eval | memory | custom
    hint?: string,
  },
  position: { x: number, y: number },
}

Edge = {
  id: string,
  from: string,
  to: string,
  port: 'contract' | 'artifact' | 'evidence' | 'veto',
  label?: string,
}
```

## 2. 默认图

每个 playbook 由 `buildDefaultGraph(playbook)` 生成：

```text
start → intake → question → prereg_gate → discussion → synthesis
      → experiment_gate → experiment → review → stage4
      → eval_gate → eval → memory → decision → end
```

- `prereg_gate` 类型 gate，config.gate='prereg'，action='prereg_freeze'。
- `experiment_gate` 同时承接 prereg 冻结状态，config.gate='experiment'。
- `eval_gate` config.gate='eval'，action='eval_read'。
- stage 节点的 action 由 stage 推断（discussion/experiment/review/stage4/eval_report/memory_propose/decision）。
- 边端口：stage→stage 用 `artifact`；gate→stage 用 `contract`；review→eval 用 `evidence`。

## 3. 校验（拒绝即 400，带 `errors[]`）

```text
V1 id 唯一
V2 edge.from/to 必须存在
V3 不允许自环与环（DAG）
V4 恰好一个 start；至少一个 end；start 无入边；end 无出边
V5 type 必须在枚举内；stage 节点必须有 stage 且覆盖 playbook 全部 stage
V6 gate 节点必须有 config.gate 且位于其守护 stage 之前
V7 position 必须是有限数
V8 port 必须在枚举内
V9 每条 edge 的 from/to 端口类型兼容：artifact 边只能出 stage/actor 入 stage/gate
```

## 4. Run 叠加

```js
GET /praxis/api/graph?runId= → {
  graph: Graph,
  states: Record<nodeId, 'pending'|'active'|'blocked'|'done'|'failed'|'quarantined'>,
  current: nodeId | null,
  runId,
  version: run.version,
}
```

状态推导（纯函数 `graphStates(run, graph)`）：

- `stage` 节点：run.state 在 playbook 阶段序中位于其前 → done；等于 → active；之后 → pending；run.state=DRIFT_DETECTED → failed。
- `prereg_gate`：run.preregHash 存在 → done；否则 active。
- `experiment_gate`：run.preregHash 不存在 → blocked；存在且未进入 EXECUTING → active；之后 → done。
- `eval_gate`：run.eval.readAt 存在 → done；run.eval.reportHash 存在 → active；否则 pending。
- `memory`/`decision`：按阶段序。
- `current` = 第一个 active/blocked 的节点（按拓扑序）。

## 5. API

| 方法 | 路径 | 行为 |
|---|---|---|
| GET | `/praxis/api/graph?runId=` | 返回 graph + states；无 run 时返回 playbook 默认图 + 空 states |
| POST | `/praxis/api/graph` | body `{playbookId, graph}`；校验 → 保存 → 返回 `{graph, receipt}`；非法 400 `{error, code:'INVALID_GRAPH', errors[]}` |
| POST | `/praxis/api/layout` | body `{playbookId, positions}`；只合并 position → 返回 graph |

保存图使用 Host 命令面之外的管理动作：只允许 `user` actor；写 `graph.saved` 事件到 meta。图保存不影响已存在 Run 的契约。

## 6. 持久化

`store` 的 dump 增加 `graphs: { [playbookId]: Graph }`；加载时缺省用默认图。layout 是图的 position 更新，不另存。

## 7. 测试（test/praxis/graph.test.js、graph-api.test.js）

- `buildDefaultGraph` 覆盖全部 stage，校验通过；
- 环、缺失 start、未知 edge 端点、重复 id、非法 port、gate 顺序错误均返回对应 V 码；
- `graphStates`：INTAKE→intake active；PREREG_FROZEN→prereg_gate done, experiment_gate active；EVAL 且有 readAt→eval_gate done；DRIFT→failed；
- API：GET 200 形状；POST 非法 400 + errors；POST 合法 200 且重启后保留；layout 合并；非 user actor 拒绝 `USER_ONLY`。
