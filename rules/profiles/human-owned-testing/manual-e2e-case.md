# 人工负责端到端用例（可选 Profile）

仅当启用 `human-owned-testing` 时适用。`manual-e2e.md` 中每个 Case 必须自包含，
包含数据准备、步骤和期望，并标记 `executor: user` 及适用的 `purpose`。除极小档外，
至少一个 Case 标记为 `purpose: business-understanding`。用户未返回新鲜证据时状态为
`PENDING_USER`，Agent 不得代跑。

步骤优先从用户可见入口开始；页面无法构造设备协议或二进制协议、幂等、并发、
队列等边界时，可描述项目批准的本地/测试环境入口。不得要求生产写入、真实凭据
或不可逆操作。
