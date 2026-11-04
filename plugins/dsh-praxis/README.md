# Praxis

DSH 科研判断引擎。面板名 Praxis。工具前缀 `rsi_`。

剧本是声明式 Playbook。第一版打磨通用科研闭环，并保留工程验证、审计红队、知识生产三个剧本入口。Q19 / BENGI 不是产品中心。

## 已验证

- `node --test test/praxis/*.test.js` 锁定：无契约拒绝实验、冻结后改契约、同结论漂移、未知恐惧、评估器越权、记忆提交仅用户、旋钮改动分叉、人格缺绑定拒绝、矛盾不平均。
- Host 与面板调用 `src/host.js` 的同一 `execute`。

## 未验证

- 安装后的 GUI 像素。安装与 slot occupant 是独立观测，不代替截图。
