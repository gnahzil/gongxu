---
name: wayfinder
description: "Use when a requirement has a named destination but critical decisions prevent reliable Spec sizing and cannot be resolved within one agent session."
---

# Wayfinder：穿过迷雾再判定 Spec

Wayfinder 只清除阻碍规模判定的决策迷雾。它不交付目标、不生成实现任务，也不是
所有非极小需求的固定阶段。

## 1. 入口门禁

开始时必须读取：

- `../../rules/ai-first-artifacts.md`：initiative `index.md` 的唯一状态契约；
- `../../rules/spec-sizing.md`：收敛后的规模判定；
- `../../rules/unknowns-pass.md`：只保留会改变结果的未知项；
- `../../rules/workspace-paths.md`：工作根与不自动 commit。

承接 PRD、视觉来源 或产品文档时还必须读取
`../../rules/requirements-anchor.md`；涉及第三方资料时读取
`../../rules/third-party-research.md`。

同时满足以下条件才进入 Wayfinder：

- 最终业务目标已经可以命名；
- 关键路线仍存在会改变契约、边界或验收的决策；
- 这些决策无法在一次会话内可靠澄清，因此暂时不能判定单 Spec 或大需求。

目标尚不能命名时，先在当前 brainstorming 中用 `grilling` 澄清目标。路线清晰的
单 Spec 或大需求直接走 `spec-sizing`；不要为了“流程完整”创建 Wayfinder。

## 2. 唯一地图

主 agent 只创建或更新：

```text
<artifact-root>/initiatives/YYYY-MM-DD-<initiative>/index.md
```

按 `rules/ai-first-artifacts.md` 在同一文件维护 Destination、Sources、Decision
Frontier、Sub Specs、Shared Contracts、Fog 和 Out of Scope。不得创建 Issue
Tracker Map、Decision 文件、第二份路线图或其他影子状态。

父级只浅读 PRD、视觉来源 根结构和代码领土以发现决策。这里不定位或冻结精确 视觉来源
Node、状态、视口、视觉契约或 Coverage；这些只属于后续当前子 Spec。

## 3. 建立决策前沿

从整个目标 breadth-first 扫描，不沿第一个问题直接钻入实现：

1. 把现在能精确表述的问题写成 `WD-001` 起的稳定 Decision。
2. 记录问题类型、依赖和状态；只有依赖已解决的 `OPEN` Decision 属于 Frontier。
3. 暂时无法精确表述的问题留在 Fog，不提前切成任务。
4. 超出 Destination 的内容直接进入 Out of Scope，永不从 Fog 自动毕业。

Decision 的答案必须是能缩小路线的结论，不是代码、接口实现、Execution Unit 或
子 Spec。能够开始实施通常意味着已到 Wayfinder 边界，应停止扩图并回到规模判定。

## 4. 推进一个 Decision

除相互独立的只读研究外，每次只推进一个未阻塞 Decision：

1. 主 agent 先把它标为 `ACTIVE`，记录当前会话或 agent 上下文并递增 index
   revision，防止并发重复领取。
2. 根据问题本身选择最小手段：
   - `grilling`：必须由用户参与，agent 不替用户回答；
   - `research`：核实现有代码或权威资料，第三方调研遵守对应规则；
   - `prototype`：只做帮助用户判断的低成本原型；写文件或对外操作前获得相应授权；
   - `prerequisite`：只解除决策前置阻塞，不借机交付 Destination。
3. 只有术语歧义、上下文边界冲突或长期难逆转决定时才调用
   `domain-modeling`；不得把它固定在每个 Decision 前。
4. 把一行结论或事实源指针写回同一 Decision，状态改为 `RESOLVED` 并递增
   revision。跨子 Spec 的稳定结论进入 Shared Contracts；长期决定只保留 ADR
   指针。
5. 将新变清晰的问题从 Fog 移入 Decision Frontier；已被结论否定的 Decision
   标为 `DROPPED`，不伪装成已完成任务。

研究需要并行时，只有在当前 agent 环境和适用规则明确允许委派时才分派；子 agent
只返回结构化事实，由主 agent 核对 revision 后合并 `index.md`。

## 5. 收敛与返回

当不存在阻碍可靠规模判定的 Frontier Decision，且剩余 Fog 不影响本期边界时：

1. 把 index phase 改为 `sizing` 并递增 revision。
2. 返回 `brainstorming`，重新执行 `rules/spec-sizing.md`，不得沿用进入
   Wayfinder 前的规模猜测。
3. 一个独立业务结果进入一个子 Spec；多个可独立验收、上线或回滚的结果先展示
   Sub Specs 并等待用户确认。
4. 每个子 Spec 都从 brainstorming 起点完整执行状态建立、领土探索、Unknowns
   Pass、精确需求锚点、grilling、方向确认和状态冻结。

父级 Destination、Sources 和 Shared Contracts 只能作为子 Spec 的来源，不得让
任何子 Spec 跳过 brainstorming 或直接进入 Planner。

## 6. 红线

- “有大 PRD 就建 Wayfinder”——规模大不等于路线有迷雾。
- “Decision 就是待办任务”——Decision 只回答路线问题，不交付实现。
- “Issue 更适合协作”——本流程唯一父级地图就是 initiative `index.md`。
- “父级已经看过 视觉来源”——根链接不能替代子 Spec 的精确取证和 Coverage。
- “父级已经 grilling 过”——每个子 Spec 仍必须完整重跑 brainstorming。
- “domain-modeling 多跑一次更保险”——只有命中领域边界条件才触发。
