---
name: using-git-worktrees
description: Use when the user explicitly requests an isolated Git worktree, or an orchestration flow explicitly assigns an implementation to one.
---

# 使用 Git 工作树

## 1. 定位

本 Skill 创建与当前工作区隔离的 Git worktree，支持两种模式：

- 交互模式：用户明确要求创建分支或工作树；
- 编排模式：`dispatching-parallel-agents` 为一个写入型 Execution Unit 分配隔离工作区。

它当前是可选 Extra，不是 brainstorming 或普通顺序 P/G/E 的默认步骤；不得仅因任务较大
而自动创建分支或工作树。并行 writer 需要隔离时，平台原生隔离能力可替代本 Skill；两者
都不可用就顺序执行，不能退回共享目录并行写。

开始时读取：

- `../../rules/workspace-paths.md`；
- `../../rules/testing.md`；
- 当前工作根和目标仓库命中的 `AGENTS.md`、`CLAUDE.md`、`WORKSPACE.md`；
- 当前仓库状态和 `git worktree list --porcelain`。

使用本 Skill 不授权 commit、push、merge、cherry-pick、删除分支、删除 worktree 或修改
项目配置。

## 2. 输入模式

### 2.1 交互模式

创建前确认基线分支、目标分支、隔离目的和目录选择。当前未提交改动不会自动搬入新
worktree；如用户希望保留，先让用户选择处理方式。

### 2.2 编排模式

主 agent 必须提供完整、不可猜测的分配：

```yaml
isolation_assignment:
  mode: parallel-execution-unit
  state_revision: <当前 revision>
  execution_unit_id: EU-002
  workspace_id: <本轮唯一 ID>
  repository_root: <目标 Git 仓库根>
  base_sha: <完整提交 SHA>
  workspace_root: <已选择的安全工作树根>
  lifecycle_owner: main-agent
  integration_mode: patch
```

编排模式使用 detached worktree，不为临时 Execution Unit 自动创建分支。所有同仓库的
并行单元必须使用相同 `base_sha`，每个单元拥有不同的 `workspace_id` 和路径。分配缺字段、
SHA 不是提交、实现依赖当前未提交代码，或批准摘要未说明会创建隔离工作区时，不创建并
返回主 agent 改为顺序执行或向用户确认。

## 3. 前置检查

创建前确认：

1. 当前目录属于 Git 仓库，并定位实际仓库根；多仓任务逐仓处理，不把工作根误当成仓库。
2. 使用 `git cat-file -e "$BASE_SHA^{commit}"` 验证编排基线；交互模式验证目标基线引用。
3. 交互模式使用 `git check-ref-format --branch` 校验分支名，并检查目标分支是否已存在、
   是否已经被其他 worktree 使用；存在歧义时询问用户，不使用 `-B` 覆盖。
4. 检查 `git status --short`。worktree 只包含 `base_sha` 中的内容；任何实现所需的未提交
   代码都意味着编排基线不完整。不得自行 commit、stash、reset 或复制这些改动。
5. 检查 `git worktree list --porcelain`，确认目标路径、`workspace_id` 和交互模式目标分支
   未被占用。

状态文档可以由隔离 executor 按权威路径只读，但不能复制到 worktree 形成第二状态源。
本地秘密、环境文件和私有上下文不得复制到工作树。

## 4. 目录选择

按以下顺序选择工作树根目录：

1. 项目 context 明确声明的位置；
2. 编排分配中经过主 agent 安全解析的 `workspace_root`；
3. 已存在且安全的 `.worktrees/`；
4. 已存在且安全的 `worktrees/`；
5. 询问用户选择项目内目录或仓库外目录。

推荐的仓库外位置为：

```text
${XDG_CONFIG_HOME:-$HOME/.config}/gongxu/worktrees/<repository>/<worktree-name>/
```

不要从仓库名、分支名、Execution Unit ID 或 `workspace_id` 直接拼接未校验路径。解析父目录
后确认目标位于选定根目录内、目标不存在、不与已有 worktree 重叠，且不同单元不会得到
同一路径。

### 4.1 项目内目录安全

项目内目录必须先检查忽略状态：

```bash
git check-ignore -q -- .worktrees/
git check-ignore -q -- worktrees/
```

如果选定目录未被忽略，不得自动修改或 commit `.gitignore`。向用户提供两个选择：

1. 改用仓库外目录；
2. 批准把精确目录加入 `.gitignore`。

用户批准修改 `.gitignore` 后仍不得自动 commit；修改属于当前工作区的显式变更。

## 5. 创建与核验

所有变量先解析为明确值并使用安全参数传递，不把未经校验的用户输入拼进 shell 命令。

交互模式创建新分支：

```bash
git worktree add -b "$BRANCH" -- "$WORKTREE_PATH" "$BASE_REF"
```

交互模式挂载现有分支：

```bash
git worktree add -- "$WORKTREE_PATH" "$BRANCH"
```

编排模式创建 detached worktree：

```bash
git worktree add --detach -- "$WORKTREE_PATH" "$BASE_SHA"
```

多个编排 worktree 逐个创建，每次都重新检查目标路径。某个单元创建失败时，报告已创建和
未创建清单并停止本批次；不通过删除目录、强制重置、`-B` 或共享已有 worktree 自动修复。

创建后重新运行 `git worktree list --porcelain`，并在目标 worktree 内核对仓库归属、
`git rev-parse HEAD`、detached 状态和干净基线。编排模式任何 worktree 的 HEAD 不等于
`base_sha` 时整批不得进入实现。

## 6. 项目初始化

不要仅根据 `package.json`、`Cargo.toml`、`requirements.txt` 等文件盲目运行依赖安装。
按以下优先级确定初始化方式：

1. 项目 context 明确声明的 worktree/bootstrap 命令；
2. 仓库贡献文档或构建脚本声明的命令；
3. 无声明时列出检测到的环境，询问用户如何初始化。

命令会下载依赖、运行安装脚本、修改锁文件、写入共享缓存或访问外部服务时，先说明影响
并取得确认。多个 worktree 不能并发运行会写同一依赖目录、缓存、端口、数据库或外部环境
的初始化和验证命令；无法隔离就顺序执行。

## 7. 基线验证

初始化后运行项目规约允许的最窄基线验证，并遵守 `rules/testing.md`：

- 优先使用构建、类型检查或 lint 等项目声明命令；
- targeted tests 可按当前 testing profile 执行；
- full suite、生产、破坏性、付费、外部或敏感测试必须先确认；
- 启用 `human-owned-testing` 时不修改或执行测试。

验证失败时报告命令、exit code 和关键输出，让用户选择排查、保留工作树或按安全流程
清理；不得把失败基线描述为就绪，也不得把其他 worktree 的成功当作本单元基线。

## 8. 编排交接与集成

编排创建成功后，主 agent 把 `workspace_path / workspace_id / base_sha` 作为
`workspace_assignment` 传给一个 executor。executor 是叶子 writer：不再分派实现
subagent，不 commit，不向权威工作区应用改动。

executor 返回后，主 agent 必须在对应 worktree 中独立检查：

```bash
git status --short
git diff --binary --full-index "$BASE_SHA"
git ls-files --others --exclude-standard
```

最后一条命令只提供未跟踪文件清单，主 agent 还要逐项检查内容、敏感性和 `owned_scope`。
不能只依赖 `git diff`，也不能采信 executor 自报的 `changed_files`。通过范围检查后，主
agent 才按 `dispatching-parallel-agents` 顺序预检并应用 change set，在集成结果上重新
验证。冲突、基线漂移、越界或敏感文件出现时停止，不自动覆盖、回退或解决。

## 9. 完成输出与生命周期

交互模式成功后报告：

```text
工作树：<绝对路径>
仓库：<仓库根>
分支：<目标分支或 detached@base_sha>
基线：<命令与 exit code，或明确写未执行>
未执行：commit / push / merge
```

编排模式向主 agent 返回：

```yaml
isolation_result:
  status: READY | BLOCKED
  state_revision: <输入 revision>
  execution_unit_id: EU-002
  workspace_id: <输入 ID>
  workspace_path: <绝对路径>
  base_sha: <完整 SHA>
  baseline_verification: <命令、exit code 和短摘要>
  blockers: []
```

worktree 在 change set 完成范围检查、成功集成并取得验证证据前必须保留。即使已集成，
本 Skill 也不自动删除；后续进入 `finishing-a-development-branch` 时，只清理本流程明确
创建的 worktree，并继续遵守用户选择和破坏性操作确认门禁。

## 10. 红线

- 不因启用了本 Extra 就默认并行；
- 不让两个 writer 共享同一可写 worktree；
- 不用 worktree 代替 `owned_scope`、契约和可变运行时资源门禁；
- 不自动修改并 commit `.gitignore`；
- 不覆盖、重置或删除已有分支和 worktree；
- 不在目标路径、基线或分支存在歧义时继续；
- 不盲目安装依赖或复制本地秘密；
- 不跳过忽略检查、敏感文件检查和创建后的 worktree 核对；
- 不把 worktree 创建视为 commit、集成、清理或发布授权。
