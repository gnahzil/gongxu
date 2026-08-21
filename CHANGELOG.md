# 变更日志

## [Unreleased]

暂无未发布变更。

## [0.1.0] - 2026-08-21

### Added

- Gongxu `0.1.0` 的通用核心、可选 Profiles、安全安装配置、CLI 与验证工作流。
- 可按 Skill 名称启用、禁用和检查的 Extra 机制。
- GitHub Issue/PR 模板、CODEOWNERS 和 GitHub Actions Dependabot 配置。
- npm 发布前验证门禁与真实 tarball 安装冒烟测试。
- README Harness 流程图及可编辑 Mermaid 源文件。

### Changed

- 并行写入改为强制使用逐 Execution Unit 隔离工作区；无原生隔离或可用 worktree 时
  自动改为顺序执行，不再允许共享目录并行写。
- Planner 与 Executor 契约增加 owned/runtime scope、workspace、base SHA 和 diff 定位，
  并明确只有主 Agent 负责分派与顺序集成。
- `using-git-worktrees` 增加基于同一提交创建 detached worktree 的编排模式。
- 默认安装面精简为 11 个核心 Skill；4 个非核心能力改为可选 Extras。
- Evaluator 吸收证据化中文审查原则，Markdown 规则补充自然中文写作要求。
- npm 仓库地址和许可证元数据改为标准可识别格式。
- 第三方声明补充精确的衍生文件范围和 `mattpocock/skills` 归属。
- 完成流程增加人工关键路径验收与原地归档门槛。

### Removed

- 删除废弃、重复、旧式 Plan 执行和贡献者元工具 Skills。
- 删除许可未确认的 Anthropic 指南中文译文。

### Security

- 安装来源隐私、敏感文件忽略、脱敏故障报告和第三方内容范围声明。

[Unreleased]: https://github.com/gnahzil/gongxu/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gnahzil/gongxu/releases/tag/v0.1.0
