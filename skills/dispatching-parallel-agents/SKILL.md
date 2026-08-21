---
name: dispatching-parallel-agents
description: Use when the current state contains at least two independent Execution Units with no dependency, shared write scope, or shared mutable runtime state, and each writer can receive an isolated workspace.
---

# 并行分派智能体

## 1. 核心原则

只并行真正独立的 Execution Units。由主 agent 为每个单元分派一个 executor；executor
不得继续分派实现 subagent。每个并行 writer 必须获得基于同一代码基线的独立可写工作区、
精确上下文和代码所有权，不能在共享可写工作区中并行修改代码。

开始时宣布：`我正在使用 dispatching-parallel-agents 并行执行独立单元。`

## 2. 触发门禁

同时满足才并行：

- 当前子 Spec 的 `state.md` 至少有两个 ready Execution Units；
- 单元之间没有 `blocked_by` 关系；
- 每个单元都有明确的 `owned_scope`，且文件、目录或模块范围不重叠；
- formatter、代码生成输出、lockfile、迁移清单和共享配置已计入 `owned_scope`；
- 不写同一数据库对象、缓存键、消息顺序、端口、外部环境或其他可变运行时资源；
- 公共代码契约骨架已经冻结并落入代码；
- 每个单元可在一个新 executor 上下文中独立完成；
- 每个代码仓库都有可验证的已提交 `base_sha`，实现所需的代码改动均已包含在该基线；
- 平台能为每个 writer 提供原生隔离工作区，或已安装 `using-git-worktrees` 并能按编排模式
  创建独立 worktree。

任一不满足就顺序执行。没有隔离能力时不得静默改为共享目录并行写。当前工作区的未提交
改动不会自动进入 worktree；若它们是实现基线的一部分，不得自行 commit、stash 或复制，
应请求用户处理，或改为顺序执行。

探索性调试、根因可能相同、共享 UI 容器、契约仍会变化或可变运行时无法隔离时，即使有
worktree 也不得强行并行。只读分析可以共享工作区，但不能在同一批次中升级为未隔离 writer。

## 3. 隔离能力选择

主 agent 按以下顺序选择：

1. 平台原生的逐 subagent 隔离工作区；
2. 已安装的 `using-git-worktrees` 编排模式；
3. 都不可用时，按依赖和风险顺序逐个调用 executor。

每个仓库的所有并行隔离工作区必须来自同一个 `base_sha`。多仓任务逐仓记录基线，不能用
工作区最外层目录或某个仓库的 SHA 代替其他仓库。工作区隔离只处理文件系统写入；端口、
数据库、缓存、队列、共享依赖目录和外部环境仍须独立分配，否则顺序执行。

`state.md`、manual E2E 和其他过程产物始终只由主 agent 在权威工作区更新。executor 可以
按明确路径只读这些输入，但不得把它们复制为另一份状态源。

## 4. 分派输入

每个 executor 只获得完成一个单元必需的信息：

```yaml
executor_assignment:
  state_path: <当前权威 state.md，只读>
  state_revision: <当前 revision>
  execution_unit_ids: [EU-002]
  outcome: <可验证结果>
  owned_scope: [<允许修改的文件、目录或模块>]
  mutable_runtime_scope: []
  contract_ids: []
  acceptance_ids: []
  manual_e2e_path: <manual-e2e.md>
  workspace_context: <WORKSPACE.md 或 NONE>
  service_context: <服务 AGENTS.md>
  frozen_code_contracts: []
  evidence_paths: []
  verification: []
  workspace_assignment:
    isolation: native | worktree
    workspace_id: <本轮唯一 ID>
    repository_root: <目标仓库根>
    workspace_path: <该 executor 的绝对工作树路径>
    base_sha: <完整提交 SHA>
    integration_mode: patch
```

提示中必须声明：

- 你不是代码库中的唯一 agent，但当前可写工作区只归本单元使用；
- 不得继续分派实现 subagent；
- 开始编辑前核对实际仓库、工作树和 `HEAD == base_sha`，不匹配就返回 `BLOCKED`；
- 只编辑 `owned_scope`，发现需要越界或触碰共享资源立即返回 `BLOCKED`；
- 不修改 `state.md`、manual E2E 或其他过程文档；
- 不重新协商冻结的入口、类型、字段或顺序；
- 按默认策略可修改相关测试并运行 targeted tests；启用 `human-owned-testing` 时不得修改或执行测试；
- 不自动 commit、push、merge、cherry-pick，也不向权威工作区应用改动。

## 5. 结构化返回

每个 executor 遵循统一的 `executor_result` 契约，至少返回：

```yaml
executor_result:
  status: DONE | BLOCKED
  base_state_revision: <输入 revision，原样回显>
  workspace:
    isolation: native | worktree
    workspace_id: <输入 ID，原样回显>
    base_sha: <输入 SHA，原样回显>
    diff_ref: <主 agent 可独立检查的工作树定位符>
  unit_results:
    - id: EU-002
      status: DONE | BLOCKED
      facts: []
  changed_files: []
  verifications:
    - command: <允许的验证命令>
      exit_code: 0
      output: <关键摘要>
  contract_coverage: []
  case_coverage: []
  new_unknowns: []
  deviations: []
  blockers: []
```

executor 不写 summary、handoff 或 verification。长日志不进入返回；无法低成本重建的
原始证据按主 agent 指定路径写入，但同一 evidence 路径不能分配给多个并行 writer。
`diff_ref` 只是定位符，不能代替主 agent 对实际隔离工作区的独立检查。

## 6. 主 Agent 集成

所有结果返回后按顺序执行：

1. 核对每份 `base_state_revision`、`workspace_id` 和 `base_sha`；任何值过期或不匹配都先停止；
2. 在每个隔离工作区独立读取 VCS status、相对 `base_sha` 的 tracked diff 和未跟踪文件，
   不采信 executor 的 `changed_files` 或成功自述；
3. 检查真实改动是否完全位于该单元的 `owned_scope`，并检查不同单元的实际路径、契约和
   共享资源是否相交；
4. 检查权威代码工作区自分派后是否漂移；漂移会影响补丁时停止集成，不自动覆盖或回退；
5. 按确定顺序对每份 change set 做预检，再逐份应用到权威代码工作区；冲突或越界时保留
   所有隔离工作区，停止并重新安排，不自动解决；
6. 检查冻结代码契约是否被静默改变，并在集成后的代码上运行适用的非测试检查和允许的
   targeted tests；单个 worktree 的通过结果不能代替集成验证；
7. 把完成事实、证据指针、偏离和 blocker 合并进 `state.md`，revision 只递增一次。

未跟踪文件必须纳入 change set 和范围检查，不能只看 `git diff`。集成成功也不自动授权
commit、push、merge 或删除 worktree；清理遵守 `using-git-worktrees` 与
`finishing-a-development-branch` 的规则。

## 7. 跨服务补充

跨服务时，`owned_scope` 必须限制到不同 service 子目录或不同仓库；`service_context` 与
`WORKSPACE.md` 服务清单一致。提供方和消费方都只实现已经落地的代码契约。需要改变公共
契约时，停止所有依赖单元，回到主 agent 重新冻结并按批准门禁处理。
