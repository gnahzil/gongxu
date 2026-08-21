---
name: brainstorming
description: "Use when creating a feature, changing behavior, or splitting a large requirement before implementation begins."
---

# 头脑风暴：路由并冻结可执行的子 Spec

brainstorming 先按规模与迷雾选择入口，再把当前子 Spec 变成获批方向和可恢复
状态；不默认生成 design、plan、summary 或 verification。

## 1. 硬门槛

除极小档外，在用户确认设计方向前不得写实现代码。开始时必须读取：

- `../../rules/spec-sizing.md`：规模与子 Spec 边界；
- `../../rules/ai-first-artifacts.md`：状态结构和压缩门禁；
- `../../rules/unknowns-pass.md`：只保留会改变结果的未知项；
- `../../rules/workspace-paths.md`：工作根与不自动 commit。

承接 PRD、视觉来源 或产品文档时还必须读取
`../../rules/requirements-anchor.md`。涉及第三方或 DDL 时分别读取对应规则。

## 2. 规模与迷雾路由

先做浅层 intake，只读取足以命名 Destination、识别独立业务结果和判断迷雾的
PRD/视觉来源 根结构、工作区地图与代码领土。不要在路由阶段提前做子 Spec 设计。

按 `rules/spec-sizing.md` 走且只走一条路径：

1. **极小档**：退出 brainstorming，按快速通道确认、修改和验证。
2. **高迷雾需求**：目标可命名，但阻碍规模判定的关键路线无法在一次会话内
   澄清；调用 `wayfinder`，本流程停止。Wayfinder 收敛后回到本节重新判定规模。
3. **路线清晰的单 Spec**：跳过 Wayfinder，直接进入第 4 节完整流程。
4. **路线清晰的大需求**：跳过 Wayfinder，进入第 3 节拆分流程。

目标尚不能命名时，先用 `grilling` 澄清目标；不得用 Wayfinder 代替基本 intake。
PRD 很长、视觉来源 页面很多或 touched 服务多，都不能单独触发 Wayfinder。

## 3. 路线清晰的大需求入口

大需求只做拆分所需的浅层探索：

1. 读取 PRD、视觉来源 根结构、工作区地图和相关长期领域知识。
2. 按独立业务结果拆成子 Spec，记录依赖、共享契约和仍在迷雾中的区域。
3. 主 agent 创建或更新 initiative `index.md`，格式来自
   `rules/ai-first-artifacts.md`。
4. 展示拆分并等待用户确认。
5. 父流程停止；选择一个子 Spec，从第 4 节完整重新开始。

父需求不冻结 视觉来源 Coverage，不创建所有子 Spec 的空文档，也不进入 P/G/E。
父级探索、grilling 或 Shared Contracts 都不能替代任何子 Spec 自己的
brainstorming。

## 4. 单个子 Spec 完整流程

无论父级是否运行过 Wayfinder，每个子 Spec 都必须从本节起点完整执行。父级
Destination、Source Pointer 和 Shared Contract 只是输入，不是已完成的子 Spec
设计。

1. **建立状态**：主 agent 惰性创建当前 `state.md`，写 Destination、有效来源
   指针、初始 Scope 和 Resume，并设置 `revision: 1`。
2. **探索领土**：读取当前代码、调用方、配置、`WORKSPACE.md`、相关服务
   context、领域语言和 ADR。能查到的事实自己查，不询问用户。
3. **扫描未知项**：只保留会改变契约、数据、权限、验收或发布的未知项。
4. **冻结外部锚点**：PRD/视觉来源 结论进入 `Frozen Contract` 和 `Scope`。
   视觉来源 必须精确到当前子 Spec 的 Node 和状态；存在 `UNKNOWN` 不得继续。
5. **逐项访谈**：必需使用 `grilling`。每次只问一个关键问题，说明它会改变
   什么并给出推荐答案。
6. **即时落盘**：每个答案确认后，主 agent 立即更新 Contract、Decision 或
   Open Question 并递增 `revision`，不等访谈结束批量总结。
7. **方案比较**：存在真实取舍时给出 2–3 个方案、失败路径和推荐；无真实
   取舍时直接展示目标方案。
8. **展示设计**：按业务结果、链路、数据/接口、异常、权限和验收边界展示；
   只展开本子 Spec 实际涉及的维度。
9. **确认方向**：用户确认后把 phase 改为 `planning`，运行压缩前检查点，然后
   交给 `harness-orchestration`。此处不是实现授权；harness 在 planner 和
   manual-e2e 就绪后只请求一次实现批准。

只有出现术语歧义、上下文边界冲突或长期难逆转决定时才使用
`domain-modeling`，不得把它固定在每个子 Spec 或每次 grilling 前。只有跨需求仍
有效的术语进入领域文档；ADR 必须同时满足难逆转、非显然和真实取舍。

## 5. 视觉来源 约束

- 根节点只发现结构；精确 Node 才是设计依据。
- `IN / RESERVED / OUT / UNKNOWN` 只覆盖当前子 Spec。
- `RESERVED` 必须冻结静态、禁用或隐藏，以及数据和 Network 行为。
- 修改共享视觉面时，把受影响 `OUT` 写入条件式非回归范围。
- 用户确认 Coverage 前不得把 phase 改为 `planning`。

视觉问题需要共同观察时，读取 `visual-companion.md` 并单独提供视觉伴侣；它不
替代 视觉来源 精确取证。

## 6. 状态检查点

进入 harness 或压缩上下文前，逐项确认：

- [ ] 精确数值、顺序、负向要求和 `RESERVED` 行为已进入 Contract。
- [ ] 非显然选择及必要理由已进入 Decisions 或 ADR。
- [ ] blocker 为零；无法解决的内容已由用户移出本期。
- [ ] Source Pointer 写明了何时重读，而不只是路径。
- [ ] Resume 指明下一步为 planner，并列出必读来源。
- [ ] `revision` 已递增。

检查失败就继续当前会话，不得依靠压缩摘要补齐。

## 7. 正式文档例外

默认不调用 `writing-design-doc`。仅当用户明确要求或项目硬规则要求正式技术
评审文档时使用该 Extra，从已冻结 `state.md` 生成
`exports/technical-design.md`；该导出不是 P/G/E 的状态源。若 Skill 未安装，不自动修改
配置或静默降级，提示用户运行
`npx gongxu@latest extra enable writing-design-doc`；非持久化 Git 或本地来源同时提供
`--source <source>`，待启用后再继续导出。
