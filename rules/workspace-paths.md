# 工作区、产物路径与 Git 边界

## 根目录解析

1. 优先读取 Gongxu 配置或用户明确声明的工作区根和 source roots。
2. 未声明时使用适用的 Git 根；不在 Git 仓库时使用当前目录。
3. 记录选定根及依据。单仓库、monorepo 和代码直接位于根目录都受支持，不从 IDE 最外层目录猜测。

默认 `artifactRoot` 为 `<workspace-root>/docs/gongxu`，默认 initiative 位于
`<artifactRoot>/initiatives/`；配置可覆盖 artifact root 与 source roots。所有状态、
Case、证据和报告都使用解析后的路径，不假设代码必须位于子目录。

视觉证据按 provider、稳定 locator、状态和视口保存。无适用视觉来源时不创建视觉
门禁；缺少所需 verifier 时明确记录 evidence gap。

除非用户明确要求，不执行 `git add`、`git commit`、`git push`、发布、标签或远程
配置。
