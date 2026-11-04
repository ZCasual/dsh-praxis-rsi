# Praxis 验收证据（2026-11-04）

## 1. 测试

```text
$ node --test test/praxis/*.test.js
ℹ tests 70   ℹ pass 70   ℹ fail 0   ℹ skipped 0
```

覆盖：engine 39（13 状态机、10 条硬规则、评分、地图、fork/幂等/冲突、dump/load、权限矩阵、RunView）、store 6、host 10、http 14、integration 1。

连续运行两次结果一致，exit 0。

## 2. 安装与激活

```text
plugin_manager install_bundle target=/home/z/CBAT-W/zbh/plugins/dsh-praxis
→ bundle @local/dsh-praxis, enabled true, row praxis (include:praxis)
→ 修复 "Invalid effect"（async apply 返回值被 Cordis 当 disposer）后，
  新实例日志：praxis.store.loaded runs=2；HTTP /praxis/api/state 200
```

## 3. 端到端流程

通过 HTTP API 在真实 Host 进程内跑通：

```text
start → prereg_freeze → pin_persona → discussion → experiment → review
→ stage4 → eval_report → eval_read → map_claim×3 → map_edge×2
→ memory_propose → memory_commit → decision → set_knobs(fork)
```

全部 `committed`；fork 生成子 Run，`lineage.children` 可见；重启后 `load` 恢复 runs 与 knobs。

## 4. 界面证据

`docs/praxis/screenshots/`：

| 文件 | 内容 |
|---|---|
| `praxis-tower-light.png` / `-dark.png` | 观测塔：DECISION、野心 0.81/1.00/0.81/0.80、时间线 |
| `praxis-map-light.png` / `-dark.png` | 认知地图：3 节点、2 边、frontier、均值回归 |
| `praxis-contract-light.png` / `-dark.png` | 已冻结契约与哈希 |
| `praxis-discuss-light.png` / `-dark.png` | 讨论与异质度 |
| `praxis-experiment-light.png` | 实验记录与复核 |
| `praxis-eval-light.png` / `-dark.png` | 评估与 eval.read |
| `praxis-memory-light.png` | 提案与提交 |
| `praxis-lineage-light.png` | 父 Run + fork 子 Run |
| `praxis-audit-light.png` | 17 条事件 |
| `praxis-knobs-light.png` / `-dark.png` | 10 个超参滑杆 |

验证环境：本机 `dsh web --port 3081`，独立临时 Chrome profile（1440×1000）。亮/暗主题通过 profile `ui-theme.preference` 切换后重启实例；截图后已恢复 `light`。

## 5. 3080 线上页面（用户已连接实例）

安装完成后对用户已连接的 3080 页面做 Client Inspect：

```text
sidebar.panellist occupants: plugins, schedules, praxis(active:true, order:35)
main occupants:            plugins, conversation, schedules, praxis(active:true)
conversation.composer.dock: activity, usage, context-diet, praxis(active:true, order:40)
```

三处 occupant 均 active，说明 Client half 已装配到当前页面。Host half 由同一 bundle 提供，且独立实例（3081）已验证 `/praxis/api/state` 200 与持久化恢复。

未验证：3080 的 `/praxis/api/state` 未直接 curl（需要该实例的一次性 token）；以 3081 的等价证据替代。
- 真实科研数据训练（Q19/BENGI）不在本插件验收范围；插件只提供契约与门禁，不内置数据。
- 真实 subagent 派工（discussion/experiment 由独立 worker Session 执行）尚未接入；当前面板提供 actor 派工面，工具与 UI 共用同一 Host 命令。

## 6. 安装后检查清单

```text
[ ] Config.listConfigs: include:praxis active
[ ] Slots.listSubTree(sidebar.panellist): occupant praxis
[ ] GET /praxis/api/state → 200 + product Praxis
[ ] 侧栏 Praxis → 主面板渲染
[ ] node --test test/praxis/*.test.js → 70 pass
```
