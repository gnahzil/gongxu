# 外部需求与视觉来源锚点

PRD、视觉来源和产品文档是事实源；必要结论与有效指针进入当前 `state.md`。
每条指针包含来源类型/provider、稳定 locator、提供的事实、核实基线以及重读条件。

视觉契约是 provider-neutral 的，至少记录状态、视口、期望锚点、交互和证据。
配置可覆盖 provider；`auto` 在输入明确提供 Figma 来源时自动选择 Figma adapter，
其他 provider 使用可用适配能力。非 UI 任务或无视觉来源时不调用视觉适配器，也不
创建视觉门禁。缺少 verifier 或页面不可达时必须记录 evidence gap，不能静态降级
为视觉 PASS。

范围使用 `IN`、`RESERVED`、`OUT`、`UNKNOWN`。`IN/RESERVED` 必须完整取证；
共享视觉面影响 `OUT` 时保存同状态、路径和视口的前后证据；`UNKNOWN` 未消除前
不得批准实现。
