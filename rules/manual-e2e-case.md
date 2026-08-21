# 手工端到端用例与执行者规则

`manual-e2e.md` 是稳定、可读的 Case 产物，位于解析后的 Gongxu artifact root 中。
每个 Case 包含稳定 ID、完整数据准备、步骤、期望、`executor: agent | user` 和
`purpose: verification | business-understanding`。

## 执行者判定

- `agent`：具备能力与环境权限，且只读，或在明确授权的本地、临时、测试环境内可安全恢复。可执行页面、API、CLI 和数据检查，并提供新鲜证据。
- `user`：涉及生产、特权凭据、破坏性/不可逆操作、付费服务、政策限制、Agent 缺少
    能力，或该 Case 用于帮助用户理解关键业务路径。未执行时标为 `PENDING_USER`。
- 无法安全执行且没有明确人工步骤时标为 `BLOCKED`。

除极小档外，每个 Sub Spec 至少有一个 `executor: user` 且
`purpose: business-understanding` 的关键业务路径。该 Case 用于让交付者亲自理解输入、
业务决策和可观察结果，不得由 Agent 的自动执行结果替代。纯基础设施、无可交互入口等
确实不适用的任务，在 `state.md` 中记录 `NOT_APPLICABLE` 及具体理由。

每个 Case 独立重复准备信息，不引用全局前置条件。UI Case 记录路径、状态、视口与
视觉锚点；API/CLI/数据 Case 记录最小输入和可观察终态。不得在公共产物中包含
真实凭据、生产数据或内部地址。

若启用 `human-owned-testing` profile，执行者统一按该 profile 的人工负责规则处理。
