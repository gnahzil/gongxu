---
name: harness-orchestration
description: "Use when a non-trivial Sub Spec has completed brainstorming and needs planning, implementation, independent evaluation, or a resumed P/G/E loop."
---

# AI-first P/G/E Harness

本流程以单个子 Spec 的 `state.md` 为唯一磁盘状态。planner、executor、
evaluator 只返回结构化结果；主 agent 负责合并状态。

## 1. 前置规则

开始时必须读取：

- `../../rules/ai-first-artifacts.md`；
- `../../rules/unknowns-pass.md`；
- `../../rules/manual-e2e-case.md`；
- `../../rules/testing.md`；
- `../../rules/workspace-paths.md`。

存在 PRD 或视觉来源时再读取 `../../rules/requirements-anchor.md`。涉及 DDL、
基础设施边界或第三方时按规则索引加载对应规则。

入口必须是以下之一：

- brainstorming 已确认方向，`state.md` phase 为 `planning`；
- 用户要求从可定位的 `state.md` 续跑。

原始需求不得直接交给 planner。`Open Questions` 有 blocker、视觉 Coverage 有
`UNKNOWN` 或 Source Pointer 不可访问时，退回 brainstorming。

## 2. 执行模式与模型能力

执行模式按以下顺序选择：

- `.gongxu-mode` 为 `single-agent`：使用模式 A。主 agent 分阶段承担 Planner、Executor、
  Evaluator；Evaluator 阶段必须从磁盘重读 state、diff 和证据，不采信 Executor 结论。
- `.gongxu-mode` 为 `multi-agent`：使用模式 B。三个角色必须在隔离上下文运行；平台能力
  或任一角色定义缺失时停止，不静默降级。
- 文件不存在：仅当平台支持隔离子 agent 且 Planner、Executor、Evaluator 均可用时
  自动选择模式 B，否则选择模式 A。
- 文件存在但有效值不唯一或不是上述两项：停止并报告。

自动选择模式 B 后，某次子 agent 调用失败也不得静默降级。Planner 需要结构化规划与
依赖推理能力，Executor 需要精确编辑和验证能力，Evaluator 需要独立高强度审查能力。
`.gongxu/config.json` 可覆盖各角色模型；`auto` 由运行时按能力选择，不固定供应商或版本。

## 3. Planner

向 planner 传递：

```yaml
state_path: <当前子 Spec state.md>
state_revision: <递增整数>
workspace_context: <WORKSPACE 与 touched 服务入口>
requested_scope: <本轮子 Spec>
```

planner 必须重新读取状态中的触发指针，返回：

- `status: READY | BLOCKED`；
- `base_state_revision`；
- 按依赖排序的 Execution Units；
- 每个单元的 Outcome、Blocked by、Owned Scope、Mutable Runtime Scope、Contract IDs、
  Acceptance IDs 和判定方式；
- contract gaps、风险、需主 agent 补取的证据。

跨服务子 Spec 的第一个执行单元必须冻结代码契约骨架；在签名、类型和共享契约
落地前，其他业务单元均被它阻塞。

planner 不写文件、不生成 design/plan。主 agent 确认 revision 未过期后，把结果
合并到 `state.md` 并递增 revision；`BLOCKED` 时退回 brainstorming。

## 4. Manual E2E 与唯一批准门槛

Planner `READY` 后，主 agent：

1. 按 `../../rules/manual-e2e-case.md` 创建或更新当前子 Spec 的
   `manual-e2e.md`；文档只写自包含 Case。
2. 把每个 Case ID 映射到 `state.md` 的 Acceptance 和 Execution Units，并标记
    `executor` 与 `purpose`。
3. 除极小档外，至少提供一个由用户执行的 `business-understanding` 关键业务路径；确实
    不适用时，在 state 中记录具体理由。
4. 检查 Contract、Scope、Execution Units、Acceptance 和 Resume 已闭环；每个单元的
   `owned_scope` 与 `mutable_runtime_scope` 已明确。
5. 预判执行策略。需要并行 writer 时说明将使用逐单元隔离工作区；缺少已提交代码基线
   或隔离能力时明确改为顺序执行。
6. 向用户展示简短变更摘要和 `manual-e2e.md` 路径，请求一次明确实现批准。

批准后 phase 变为 `approved`，随后立即进入 Executor。只有以下变化才重新批准：

- 子 Spec 范围变化；
- 新 blocker 或高风险决定；
- 公共契约、DDL、权限或人工验收契约变化。

普通实现调整和 evaluator findings 不重新请求批准。

## 5. Executor

### 5.1 调度职责与隔离

主 agent 是唯一调度者；executor 是叶子实施角色，不得继续分派实现 subagent。模式 A
由主 agent 按 Executor 规则顺序实施，不启用并行 writer；模式 B 默认按依赖顺序调用
executor。模式 B 的当前 frontier 至少有两个独立单元时，主 agent 才加载
`dispatching-parallel-agents`，并按其门禁决定是否并行。

并行 writer 必须各自在基于同一已提交 `base_sha` 的隔离工作区中执行。优先使用平台
原生隔离能力；平台没有该能力时，仅在已安装 `using-git-worktrees` 且其编排前置条件满足
时并行。两者都不可用、代码基线包含未提交改动或任一范围可能相交时，顺序执行；不得
静默让多个 writer 共享当前目录。worktree 不隔离端口、数据库、缓存、队列或外部环境，
这些资源无法独立分配时同样顺序执行。

`state.md`、manual E2E 和其他过程产物只在权威工作区由主 agent 写。隔离 executor
只能按输入路径读取，不创建副本或修改它们。

### 5.2 Executor 输入与返回

向每个 executor 传递：

```yaml
state_path: <权威 state.md，只读>
state_revision: <当前 revision>
execution_unit_ids: [EU-001]
owned_scope: [<允许修改的文件、目录或模块>]
mutable_runtime_scope: []
manual_e2e_path: <manual-e2e.md>
evidence_paths: <适用的实现前证据；无则 NONE>
repair_packet: <返工时填写；首轮为空>
workspace_assignment:
  isolation: current | native | worktree
  workspace_id: CURRENT | <本轮唯一 ID>
  repository_root: <目标仓库根>
  workspace_path: <实际执行目录>
  base_sha: <并行时为完整提交 SHA；顺序执行无法提供时为 NONE>
  integration_mode: direct | patch
```

executor 开始编辑前核对工作区分配，只修改 `owned_scope` 并运行允许的验证，返回：

- `status: DONE | BLOCKED`、`base_state_revision` 和原样回显的 workspace 元数据；
- 每个执行单元的完成事实；
- changed files、可独立检查的 diff 定位、命令、exit code 和关键输出；
- Contract/Case 承接关系；
- 新未知项、偏离、阻塞和 evaluator 所需运行上下文。

executor 不写 `state.md`、manual-e2e、summary 或其他过程文档，不自评正确性，不
commit、push、merge、cherry-pick 或删除 worktree。测试遵守默认 targeted/full-suite
边界与可选 profile。实际出现越界改动、共享运行时写入或未冻结共享视觉影响时，必须在
修改共享面前返回 `BLOCKED`。

顺序结果由主 agent 独立核对当前 diff。并行结果先按 `dispatching-parallel-agents` 在每个
隔离工作区检查 tracked diff 与未跟踪文件，再顺序应用到权威代码工作区并运行集成验证；
单个 worktree 的测试结果不能替代集成验证。所有同一 frontier 的结果只合并一次 state，
revision 只递增一次。若出现需重新批准的变化，phase 回到 `planning`，否则进入
`evaluating`。

## 6. 视觉证据准备

仅在存在视觉来源时启用。provider 由配置覆盖或自动检测；Figma 来源自动使用 Figma adapter，其他来源使用可用能力。主 agent 保存稳定 locator、状态、视口、`IN / RESERVED` 参考与运行时证据，以及受影响 `OUT` 的 before/after。缺少 verifier 是显式 evidence gap，不得静态降级；非 UI 任务不受影响。

## 7. Evaluator

向 evaluator 传递：

```yaml
state_path: <state.md>
state_revision: <当前 revision>
executor_results: <本轮一个或多个结构化返回>
diff_scope: <集成后的精确文件或 commit 范围>
manual_e2e_path: <manual-e2e.md>
evidence_paths: <适用证据；无则 NONE>
loop_iteration: <从 1 开始递增的整数>
```

模式 B 的 evaluator 在全新上下文只读验收；模式 A 则进入独立证据阶段，从磁盘重读
state、diff 和证据，不依赖 Executor 的结论。两种模式都返回：

- `status: PASS | NEEDS_WORK` 和 `base_state_revision`；
- 每个 Acceptance ID 的 `PASS/FAIL/PENDING_USER`、判定方式和证据；
- 构建与测试策略门禁；
- 适用视觉范围逐项结论；
- 分级 findings 和结构化 evidence gaps；
- NEEDS_WORK 时可直接交给 executor 的修复清单。

evaluator 不写 verification、不修代码；按 testing 配置独立验证。无法取得关键运行时证据时
必须 `NEEDS_WORK`。

## 8. 决策循环

`NEEDS_WORK`：

1. 主 agent 把 findings 合并到对应 Execution Unit 和 Acceptance，递增 revision。
2. 未触发重新批准条件时，立即把结构化 `repair_packet` 传回 executor。返工默认在已集成
   的权威代码工作区顺序执行；只有重新满足并行隔离门禁并取得包含当前实现的已提交
   `base_sha` 时才可再次并行。
3. executor 完成后重新调用 evaluator，并递增 `loop_iteration`。
4. 重复以上步骤，不设轮次上限，直到 evaluator `PASS`，或出现需重新批准的变化或
   无法继续的 blocker。

`PASS`：

1. 主 agent 把每个 Acceptance 的结论和证据指针合并到 state。
2. phase/status 更新为 `complete`，记录代码基线和所有人工 Case。Agent 可安全执行的
    Case 必须有新鲜证据；`business-understanding` Case 保持 `PENDING_USER`，直到用户
    亲自验证、明确豁免或说明不适用。
3. 告知用户代码验收结果以及 `state.md`、`manual-e2e.md` 路径，再进入分支收尾。

## 9. 人工验收与归档

分支收尾完成后，主 agent 按 `../../rules/ai-first-artifacts.md` 检查归档门槛：

- 人工关键路径已通过；或用户明确豁免并接受剩余风险；或有具体的不适用理由；
- 用户选择的集成动作、最终代码基线和外部链接已记录；
- blocker 为零，Resume 不再包含开发动作。

门槛未满足时保持 `complete`，Resume 只指向待执行的人工 Case，不得声称需求已归档。
门槛满足后压缩过程噪声，把 phase/status 更新为 `archived`，并使该 Sub Spec 退出活跃
恢复范围。归档不移动目录，也不自动删除 evidence。父 initiative 的全部 Sub Specs
归档后，再压缩并归档 `index.md`。

## 10. 禁止的影子状态

- 不创建 `summary.md`、`verification.md`、默认 design 或默认 plan。
- 不把 planner/executor/evaluator 的完整返回粘进 state。
- 不把 PRD、视觉原始来源、代码或长命令输出复制进 state。
- 不用 handoff 文档替代 state；跨会话只加载 initiative index、目标 state，再按
  指针触发读取。
