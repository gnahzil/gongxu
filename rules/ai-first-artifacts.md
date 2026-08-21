# AI-first 任务产物与上下文恢复

本规则定义大需求、子 Spec 和 P/G/E 流水线的唯一磁盘状态。目标是让新
会话快速恢复决策，而不是保存对话转录或重复事实源。

## 1. 核心原则

- `state.md` 是单个子 Spec 的权威工作状态，不是缩短版 design 或 plan。
- `index.md` 是 initiative 的低分辨率地图；高迷雾时也承载 Wayfinder，始终不
  保存子 Spec 设计细节。
- PRD、视觉来源、代码、配置和 diff 继续作为事实源；状态只保存结论和带读取
  条件的指针。
- 一个含义只保存在一个权威位置。可直接从环境查到的事实不缓存到文档。
- `summary.md`、`verification.md`、默认 `design.md` 和默认 `plan.md` 不生成。
- `state.md`、`manual-e2e.md` 和证据是执行脚手架。交付后原地压缩并归档，退出活跃
  上下文；不自动移动目录或删除原始证据。

## 2. 目录契约

```text
docs/gongxu/initiatives/YYYY-MM-DD-<initiative>/
├── index.md
└── sub-specs/
    └── S01-<sub-spec>/
        ├── state.md
        ├── manual-e2e.md
        ├── evidence/
        └── exports/
```

- 大需求拆分或进入 Wayfinder 时只创建 `index.md`；子 Spec 开始时再惰性创建
  自己的目录。
- `manual-e2e.md` 是唯一默认面向人的过程文档。
- `evidence/` 只保存无法低成本重建的原始证据，例如截图；命令、退出码和
  简短输出直接索引到 `state.md`。
- `exports/technical-design.md` 和 `exports/implementation-plan.md` 仅在用户
  明确要求或项目硬规则要求正式人类评审文档时生成。

## 3. 写入所有权

主 agent 是 `index.md`、`state.md` 和 `manual-e2e.md` 的唯一合并者。
planner、executor、evaluator 返回结构化结果，不直接修改这些文件，也不创建
其他过程文档。主 agent 合并前必须核对结果基于的 `state_revision`；版本落后时
先与当前状态对账。

Wayfinder 的研究或探索 agent 同样不能直接写 `index.md`。主 agent 推进 Decision
前先标记 `ACTIVE` 并递增 index revision；合并结构化结论时再次核对 revision。

这是一致性边界，不限制多个 agent 修改各自获授权的代码范围。

## 4. `index.md` 最小结构

```markdown
# <大需求名称>

> revision: <递增整数> | phase: <wayfinding / sizing / split> | status: <状态>

## 1. Destination

<最终业务结果，一至两句>

## 2. Sources

- <PRD/视觉来源 指针> — <何时必须重新读取>

## 3. Decision Frontier

<!-- 仅 Wayfinder 期间需要；路线清晰且从未进入 Wayfinder 时可以省略 -->

| ID | Question | Type | Blocked by | Status | Context / Resolution |
|---|---|---|---|---|---|

## 4. Sub Specs

| ID | Outcome | Depends on | Status | State |
|---|---|---|---|---|

## 5. Shared Contracts

- <只写跨子 Spec 必须共享的稳定结论或 ADR 指针>

## 6. Fog

- <尚不能准确拆成子 Spec 的在范围未知区域>

## 7. Out of Scope

- <明确排除项>
```

Decision 使用 `WD-001` 起的稳定 ID，状态只允许 `OPEN / ACTIVE / RESOLVED /
DROPPED`。它回答阻碍路线的决策问题，不是实现任务、Execution Unit 或子 Spec；
`ACTIVE` 必须记录当前会话或 agent 上下文，`RESOLVED` 只保留一行结论或事实源
指针。能够跨子 Spec 稳定复用的结论进入 Shared Contracts，长期难逆转结论在此
只保留 ADR 指针。

`index.md` 是 Destination、Decision、Fog、Shared Contracts、Sub Specs 和 Out of
Scope 的唯一父级权威位置；不得并存 Issue Tracker Map、Decision 文件或第二份
路线状态。子 Spec 的完整决定只存在于自己的 `state.md`。

## 5. `state.md` 最小结构

```markdown
# <子 Spec 名称>

> revision: <递增整数> | phase: <阶段> | status: <状态>

## 1. Destination
## 2. Source Pointers
## 3. Frozen Contract
## 4. Decisions
## 5. Scope
## 6. Open Questions
## 7. Execution Units
## 8. Acceptance
## 9. Evidence Index
## 10. Resume
```

各节约束：

- `Source Pointers`：每条同时写“材料是什么”和“什么分支触发读取”。裸路径
  不算有效指针。
- `Frozen Contract`：保存实现和验收不可重新推导的业务行为、顺序、负向要求、
  API/数据/权限/异常/UI 状态；使用稳定 ID。
- `Decisions`：一句话结论；仅在原因无法从事实源重新推导时保留简短 `Why`。
- `Scope`：明确 `IN / RESERVED / OUT`；视觉来源 细则见
  `rules/requirements-anchor.md`。
- `Open Questions`：只保留会改变契约、数据、权限、验收或发布的未知项。
- `Execution Units`：单个子 Spec 内的执行单元，不是新的 Spec。每项包含
  `Outcome / Blocked by / Status / Owned Scope / Mutable Runtime Scope / Contract IDs /
  Acceptance IDs`，大小以一个新 agent 上下文能够完成为限。`Owned Scope` 覆盖测试、
  生成文件、lockfile 和共享配置；范围无法界定或与其他单元相交时只能顺序执行。
- `Acceptance`：可观察结果、判定方式和证据形式；人工步骤只引用
  `manual-e2e.md` 的 Case ID，不复制步骤。
- `Evidence Index`：一行结论加证据路径或可重现命令，不粘贴长输出。
- `Resume`：当前阶段、下一动作、阻塞项、下次必读指针和建议 skill。

## 6. 信息归属

| 信息 | 权威位置 |
|---|---|
| 父级目标、Wayfinder Decision、Fog、共享契约和子 Spec 索引 | `index.md` |
| 子 Spec 已冻结契约和可逆局部决定 | `state.md` |
| 跨需求长期有效的规范术语 | `docs/agent/domain-language.md` |
| 难逆转、非显然且存在真实取舍的决定 | `docs/agent/adr/` |
| PRD、视觉来源、代码、配置和当前运行事实 | 原始来源，`state.md` 仅放触发指针 |
| 人工验收步骤与最终期望 | `manual-e2e.md` |
| 截图等原始证明 | `evidence/` |
| 代码改动事实 | 当前 diff，不在状态中复制逐行清单 |

工作文件路径可在 `Resume` 中作为临时定位信息，但下个阶段必须从当前代码重新
核实，不能把路径当长期契约。

## 7. 阶段边界与压缩门禁

访谈、规划、执行或验收进行中不得主动压缩上下文。只在一个阶段明确结束后判断：

1. 下一阶段需要本阶段的原始推理，且上下文仍充足：继续当前会话。
2. 上下文与下一阶段无关：清空或开启独立会话。
3. 需要跨工具、跨目录或交给他人：用 `state.md` 加指针移交，不创建 handoff。
4. 其余情况才压缩，并明确下一阶段目标。

压缩前必须同时满足：

- 已确认契约、精确数值、顺序和负向要求均已进入 `Frozen Contract`；
- 非显然决定及不可重新推导的理由已进入 `Decisions` 或 ADR；
- blocker 已关闭，或留在 `Open Questions` 并阻止实现；
- 执行依赖和验收 ID 已连通；
- `Resume` 指明下一动作和必读来源；
- `revision` 已递增。

任一不满足就继续当前阶段，不得用压缩摘要代替检查点。

## 8. 生命周期

父级路由先处理迷雾和规模：

```text
intake ──路线清晰──→ sizing ──→ child brainstorming
   └──高迷雾──→ wayfinding ──收敛后重新 sizing──┘
```

Wayfinder 收敛只代表可以可靠判定单 Spec 或大需求。每个确认后的子 Spec 仍从头
运行完整 brainstorming；父级不得冻结 视觉来源 Coverage，也不得把 Decision 直接
转换为 Execution Unit。

单个子 Spec 的 P/G/E 生命周期保持不变：

```text
brainstorming → planning → approved → implementing → evaluating
                              ↑              ↓          │
                              └─ contract change ───────┘
                                             ↑          │
                                             └─ NEEDS_WORK
```

- 实现前只有一个显式用户批准门槛：`state.md` 的冻结契约、执行单元和
  `manual-e2e.md` 已就绪。
- 只有范围变化、blocker、新的高风险决定或验收契约变化才重新请求批准。
- evaluator `NEEDS_WORK` 时，主 agent 把 findings 合并进当前执行单元后立即
  回到 executor；循环不设轮次上限，直到 evaluator `PASS`，或出现需重新批准的
  变化或无法继续的 blocker。
- evaluator `PASS` 后，主 agent 先把 phase/status 更新为 `complete`，保留最终契约、
  关键决定、验收结论、证据指针和代码基线；此时尚未归档。

### 8.1 完成与归档

归档发生在分支收尾之后，并同时满足以下条件：

1. 用户选择的 merge、PR、保留或丢弃动作已完成，或明确记录为未执行；
2. `purpose: business-understanding` 的人工关键路径已经通过；无法执行时，用户已明确
    豁免并记录原因与剩余风险；确实不适用时有具体 `NOT_APPLICABLE` 理由；
3. 最终代码基线、集成结果和仍需保留的证据指针已经写入 state；
4. blocker 为零，`Resume` 不再包含待执行开发动作。

归档时不移动 Sub Spec 目录。主 agent 删除 state 中的过程性噪声，把 phase/status 改为
`archived`，并将 `Resume` 设为“无需继续执行”；归档内容不再作为活跃任务自动恢复。
原始 evidence 是否清理由项目的审计、合规和保留策略决定，Gongxu 不自动删除。

一个 initiative 的全部 Sub Specs 均归档后，`index.md` 同样压缩为最终业务结果、共享
契约和归档指针，并标记 `archived`。
