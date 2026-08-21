# Gongxu 规则

规则文件是按任务加载的硬约束。引用规则时必须使用可用的文件读取能力实际加载，
不得凭记忆执行。

## 核心规则

核心规则直接位于 `rules/`，默认安装。主要包含测试默认策略、通用 DDL 安全、异常
包装、视觉来源、工作区、第三方调研、Markdown、版本和 AI 状态产物规则。

- 测试默认：`rules/testing.md`，允许相关测试改动和 targeted tests；full suite 先询问。
- DDL 默认：`rules/database-ddl.md`，遵循目标引擎、迁移框架和项目约定。
- Markdown：`rules/markdown-style-guide.md`，所有新增或修改的 Markdown 必须遵守。

## 可选 Profiles

Profile 仅在启用后安装到 `rules/profiles/` 及 Agent 镜像：

- `mysql-strict`：精确 MySQL 字段、索引、字符集与注释约束。
- `human-owned-testing`：覆盖默认测试策略，测试修改和执行由用户负责。

```bash
npx gongxu@latest add --profile mysql-strict
npx gongxu@latest profile enable human-owned-testing
```

启用与禁用会原子更新 `.gongxu/config.json` 并安装或安全移除 profile 文件。本地修改
的待删除受管理文件会产生冲突，不会被静默删除；非持久化来源需同时提供 `--source`。
