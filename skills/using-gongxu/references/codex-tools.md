# Codex 工具映射

Skills 使用 Claude Code 的工具名称。在 Codex 中遇到这些名称时，请使用对应的平台等价工具：

| Skill 中的引用 | Codex 等价工具 |
|---------------|---------------|
| `Task` 工具（派遣子 agent） | `spawn_agent` |
| 多个 `Task` 调用（并行） | 多个 `spawn_agent` 调用 |
| Task 返回结果 | `wait_agent` |
| Task 自动完成 | `close_agent` 释放槽位 |
| `TodoWrite`（任务跟踪） | `update_plan` |
| `Skill` 工具（调用 skill） | Skills 原生加载——直接按说明操作 |
| `Read`、`Write`、`Edit`（文件） | 使用原生文件工具 |
| `Bash`（执行命令） | 使用原生 shell 工具 |

## 子 Agent 派遣需要多 Agent 支持

在 Codex 配置文件（`~/.codex/config.toml`）中添加：

```toml
[features]
multi_agent = true
```

启用后可使用 `spawn_agent`、`wait_agent` 和 `close_agent`，支持
`dispatching-parallel-agents` 和 `harness-orchestration` 的模式 B。只有三个角色定义均可用时
才自动选择模式 B；显式选择后调用失败不得静默降级。

Gongxu 将 Codex 自定义 agent 安装到项目 `.codex/agents/`，文件名为：

- `planner.toml`
- `executor.toml`
- `evaluator.toml`

如果当前会话已经暴露 `spawn_agent` / `wait_agent` / `close_agent`，即使配置文件里没有显式 `multi_agent = true`，也按当前可用工具为准。
