---
name: chinese-commit-conventions
description: Use when an enabled project explicitly requests a Chinese Conventional Commit message or asks to review an existing commit message.
---

# 中文 Git 提交规范

## 1. 定位与授权边界

本 Skill 只负责生成或检查 Commit Message，不授予执行 `git commit`、修改 Git Hook、
安装依赖或改动项目配置的权限。未经用户明确要求，不创建 commit。

目标项目已有提交规范时，以项目规范为准；本 Skill 只作为没有明确约定时的默认格式。

## 2. 标题格式

使用 Conventional Commits 兼容格式：

```text
<type>(<scope>): <中文简述>
```

- `type` 使用英文小写关键字：`feat`、`fix`、`docs`、`style`、`refactor`、
    `perf`、`test`、`build`、`ci`、`chore`、`revert`。
- `scope` 可选，使用目标项目认可的模块名；不要为了中文形式改写代码中的规范名称。
- 简述使用准确的动宾短语，不加句号，不写“更新代码”“修复问题”等无信息内容。
- 默认控制在 50 个字符左右；项目工具另有长度限制时服从工具配置。

示例：

```text
feat(权限): 添加基于 RBAC 的细粒度控制
fix(支付): 修复重复回调导致的幂等问题
docs: 补充 Extra 启用说明
```

## 3. 正文

只有标题无法解释动机、方案或影响时才写正文。标题与正文之间空一行，优先说明：

1. 为什么需要这次变更；
2. 采用了什么关键方案；
3. 影响了哪些模块、接口或迁移边界；
4. 实际取得了哪些验证证据。

不要声称未运行的测试已经通过，也不要复制完整日志或过程流水账。

```text
fix(订单): 修复并发请求造成的重复扣减

原实现把幂等检查与扣减分成两个非原子步骤，并发请求可同时通过检查。
本次将两步合并到同一事务边界，并补充冲突路径验证。

影响范围：订单服务、库存调用入口
```

## 4. 不兼容变更

存在真实的不兼容变更时，在 type 后加 `!`，并在 footer 中写
`BREAKING CHANGE:`。内容必须说明受影响的公共契约和迁移方式；是否构成版本级别变化
同时遵守项目版本规则。

```text
feat(接口)!: 调整用户信息返回结构

BREAKING CHANGE: `avatar` 移入 `profile` 对象；调用方需更新字段路径。
```

不要因为普通内部重构、兼容性字段新增或未影响消费者的 DDL 自动标记 Breaking Change。

## 5. 关联信息

Footer 使用目标平台支持的语法。没有平台约定时可使用：

```text
Closes #128
Refs #129
```

不要写入私有 URL、访问凭据、生产数据或仅本地可见的内部标识。

## 6. 检查清单

- [ ] type 与实际变更一致；
- [ ] scope 准确且遵守项目命名；
- [ ] 标题具体、简洁、无句号；
- [ ] 正文只陈述真实动机、影响和验证；
- [ ] 不兼容变更包含迁移说明；
- [ ] Issue 关联语法适配目标平台；
- [ ] 内容不包含秘密、内部地址或未脱敏数据；
- [ ] 没有在未获授权时执行 commit 或修改工具链。
