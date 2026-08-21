---
name: verification-before-completion
description: Use before claiming implementation or acceptance success, before integration, and before advancing a P/G/E phase; require fresh permitted evidence and return it structurally without creating reports.
---

# 完成前验证

## 1. 核心原则

没有本轮的新鲜证据，不得声称完成、正确、修复或 PASS。

开始时读取：

- 当前仓库和 touched services 的工程规约；
- `../../rules/testing.md`；
- 当前 Sub Spec 的 `state.md`、适用 Acceptance 和 `manual-e2e.md`；
- 与本结论直接相关的 Context Pointers。

默认可修改相关测试并运行最窄 targeted tests；full suite 与敏感、生产、破坏性或付费测试先确认。启用 `human-owned-testing` 时不修改或执行测试，并且不能把静态检查冒充测试证据。

## 2. 证据循环

声明任何正向状态前执行：

1. 为每个 Acceptance 确定能证明结论的允许方法；
2. 重新运行命令或取得运行时证据；
3. 阅读完整结果、退出码和失败项；
4. 判断证据是否真的支持结论；
5. 返回事实和证据指针，再由主 agent 合并 state。

失败、缺证据或环境不可达时返回实际状态，不使用“应该”“大概”“看起来没问题”。

## 3. 分阶段职责

### 3.1 Executor

Executor 只证明实施事实：

- 指定 Execution Units 在哪个 `workspace_id / base_sha` 上修改了哪些文件；
- 运行了哪些允许的验证命令及其结果；
- Contract、Acceptance 和 Case 的实现入口；
- 新未知项、偏离和 blocker。

Executor 不评价实现正确性，不声称总体 PASS，不写 summary 或 verification。

### 3.2 Evaluator

模式 B 的 Evaluator 在全新上下文独立重跑适用检查；模式 A 在独立证据阶段从磁盘重读
输入。两种模式都不采信 executor 自述。每个 Acceptance 返回：

- `PASS`：独立证据满足契约；
- `FAIL`：证据反驳契约或关键证据缺失；
- `PENDING_USER`：仅限风险、权限、能力或 `business-understanding` 目的要求用户执行的
    Case，且用例本身已完整。

总体 PASS 要求：Agent 可安全执行的 Case 有新鲜证据，用户负责的 Case 仅为 PASS 或 PENDING_USER，验证门禁通过，且无 critical/major finding。

## 4. 视觉门禁

仅在有适用视觉来源时启用。配置 provider 覆盖自动检测；Figma 来源自动使用 Figma adapter，其他来源使用可用 verifier。Evaluator 必须读取稳定 locator、视口和状态，在实际页面取得证据并核对 `IN / RESERVED` 与受影响 `OUT`。缺 verifier、页面或来源时明确记录 evidence gap 并返回 NEEDS_WORK；非 UI 任务不创建视觉门禁。

## 5. 结构化返回

不得创建 summary、verification 或独立完成报告。Executor 的返回至少包含：

```yaml
executor_result:
  status: DONE | BLOCKED
  base_state_revision: <输入 revision，原样回显>
  workspace:
    isolation: current | native | worktree
    workspace_id: <输入 ID>
    base_sha: <输入 SHA 或 NONE>
    diff_ref: <主 agent 可独立检查的工作树定位符>
  verifications:
    - command: <允许的验证命令>
      exit_code: 0
      output: <关键摘要>
  blockers: []
```

Evaluator 的返回至少包含：

```yaml
evaluator_result:
  status: PASS | NEEDS_WORK
  base_state_revision: <输入 revision，原样回显>
  acceptance_results:
    - id: AC-001
      status: PASS | FAIL | PENDING_USER
      method: <实际判定方法>
      evidence: <短结论或 evidence 路径>
  evidence_gaps: []
  findings: []
```

长日志、截图和原始响应放在当前 Sub Spec 的 `evidence/`；state 只保留结论和路径。主 agent 核对 `base_state_revision` 后合并并递增 revision。

## 6. 停止条件

出现以下任一情况不得声称完成：

- 只看到代码 diff 或 subagent 的成功自述；
- 并行 writer 共享可写工作区，或主 agent 未独立核对各隔离工作区的基线、实际 diff 和未跟踪文件；
- 仅运行了部分命令；
- Acceptance 未逐项覆盖；
- blocker 仍未冻结；
- 适用视觉来源缺少 verifier 或运行时对照；
- 用户尚未执行人工 Case，却声称“手测通过”；
- `business-understanding` Case 尚未通过、明确豁免或说明不适用，却声称已经归档；
- 结果基于过期 state revision。

最终汇报必须区分：已执行的验证、静态证明、待用户手测和未执行事项。
