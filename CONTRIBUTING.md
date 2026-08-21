# 贡献指南

1. 先在 Issue 或变更说明中明确范围，保持单一、可审查的改动。
2. 不提交秘密、私有上下文、内部 URL、真实生产数据或 `.gongxu/triage-private/`。
3. 新增或修改 Markdown 遵守 `rules/markdown-style-guide.md`，仓库内部链接使用相对路径。
4. 默认 Skill 放入 `skills/` 并登记到核心清单；可选 Skill 放入 `extras/` 并登记到 Extra 清单。未登记目录不会自动安装。
5. 运行 `npm test`、`npm run check` 和 `npm pack --dry-run --json`，记录失败或跳过项。
6. 除非另有明确书面说明，向本仓库提交贡献即表示你同意按本项目 MIT License 提供
    该贡献，并确认你有权作出该授权。第三方材料仍须保留原始版权和许可声明，不得把
    许可未确认内容标为 MIT。
7. PR 不得自动发布、改远程或包含发布凭据。发布、标签和 npm publish 由维护者另行批准执行。
