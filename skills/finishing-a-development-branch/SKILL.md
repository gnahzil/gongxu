---
name: finishing-a-development-branch
description: Use after independent acceptance passes to choose integration, record human business-path acceptance, and archive or retain the completed implementation.
---

# 完成开发分支

## 1. 定位

先拿到新鲜的允许证据，再让用户选择集成方式。此 skill 不生成 handoff、merge plan、
summary 或 verification 文档，也不把用户尚未执行的人工 Case 说成已通过。

开始时宣布：`我正在使用 finishing-a-development-branch 收尾当前实现。`

## 2. 前置门禁

开始前读取：

- `../../rules/testing.md`；
- 当前子 Spec 的 `state.md` 和最新 revision（存在时）；
- touched services 的工程规约与验证命令；
- 当前 VCS 状态、分支、工作树和远端信息。

展示集成选项前必须：

1. 确认 evaluator 已 PASS，或临时任务已完成独立 review；
2. 为每个 touched service 重新运行规约允许的非测试构建、类型或 lint；
3. 核对 diff 范围、未提交改动和未跟踪文件；
4. 区分已执行证据、静态证明、`PENDING_USER` 人工 Case 和未执行事项；
5. 跨服务时逐仓记录命令、exit code，并说明是否真的取得端到端运行证据。

任一必需门禁失败就停止，报告实际失败，不展示“可合并”选项。风险、权限、能力或
`business-understanding` 目的可使 Case 处于 `PENDING_USER`；Agent 可安全执行的自动
验证 Case 必须有新鲜证据。人工关键路径尚未执行不阻止展示集成选项，但会阻止最终归档。

## 3. 展示选择

识别基础分支和当前分支后，向用户提供：

```text
实现已完成代码验收。你想怎么处理？

1. 本地合并回 <base-branch>
2. 推送并创建 Pull Request
3. 保持分支和工作树现状
4. 丢弃这项工作
```

多 repo 任务说明选项 1 需要逐仓执行，通常推荐选项 2，但不替用户决定。

## 4. 执行用户选择

### 4.1 本地合并

只有用户选择后才能逐仓执行：

1. 确认工作区没有尚未授权处理的未提交改动；
2. 切换基础分支并拉取；
3. 合并 feature branch；
4. 在合并结果上重跑验证；
5. 验证通过后，询问是否删除 feature branch / worktree。

不得为了完成合并自动创建 commit。

### 4.2 推送并创建 PR

只有用户选择后才能 push 或调用 PR API。前置检查：

- 所有改动已由用户授权形成 commit；有未提交改动就停止并请用户决定；
- CLI 已登录且远端、base/head 分支明确；
- 多 repo 任务的每个仓库、依赖顺序和姊妹 PR 范围已确认。

单仓 PR 描述至少包含：

```markdown
## 1. 摘要

- <变更结果>

## 2. 契约与状态

- State：<state 路径 + revision，若不适用写 N/A>
- Acceptance：<已 PASS 的 ID>

## 3. 验证

- <命令、exit code、关键输出>
- 待用户人工执行：<CASE IDs 或无>
```

多 repo PR 还要在每个 PR 描述中直接写：

- 所有姊妹 PR 链接；
- 当前仓库角色和依赖；
- 推荐合并顺序；
- 跨服务证据与仍未执行的人工 Case。

先创建 PR 获得 URL，再回填姊妹链接。无需生成 `pr-merge-plan.md` 或 handoff。
不自动 merge PR。

### 4.3 保持现状

报告分支、工作树路径、未提交状态和下一步；不清理任何内容。

### 4.4 丢弃

丢弃是破坏性操作。先精确列出将删除的仓库、分支、提交、未提交改动和工作树，
要求用户输入 `discard`。没有精确确认不得删除。多 repo 必须逐仓列出，不使用宽泛
目录、glob 或未解析变量作为删除目标。

## 5. 状态与清理

存在当前子 Spec 时，主 agent 只把用户选择、最终代码基线、PR 链接或保留路径
合并到 `state.md` 的 Evidence Index / Resume，并递增 revision。不要复制 PR 正文或
命令长输出。

工作树清理规则：

- 保持现状或 PR 仍需使用：保留；
- 本地合并后：验证通过并经用户确认才移除；
- 丢弃：仅在精确 `discard` 确认后移除；
- 只清理本流程明确创建或用户明确指定的工作树。

## 6. 人工验收与归档

完成用户选择后，检查 `purpose: business-understanding` 的人工关键路径：

- 用户已执行并确认期望：记录证据结论；
- 用户明确豁免：记录原因和接受的剩余风险；
- 任务确实不适用：记录具体 `NOT_APPLICABLE` 理由；
- 仍待执行：保持 phase/status 为 `complete`，Resume 只指向待执行 Case，不声称归档。

前三种情况满足其一，且集成结果与最终代码基线已记录时，按
`../../rules/ai-first-artifacts.md` 压缩状态并将 phase/status 更新为 `archived`。
归档原地完成，不移动 Sub Spec 目录，不自动删除 evidence。用户选择丢弃工作时，记录
`outcome: discarded` 后可直接归档，因为没有需要交付的业务行为。

## 7. 完成汇报

最终汇报包含：

- 用户选择及实际执行的 VCS / PR 操作；
- 每个仓库的分支或 PR 链接；
- 新鲜验证证据；
- `PENDING_USER` Case 和其他未执行事项；
- 保留或清理的工作树；
- 当前状态是 `complete` 还是 `archived`，以及归档门槛是否满足。

未执行的外部操作必须明确写“未执行”，不得暗示已提交、已推送、已创建 PR 或已合并。
