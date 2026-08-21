# 人工负责测试（可选 Profile）

仅当 `.gongxu/config.json` 启用 `human-owned-testing` 时适用，并覆盖
`rules/testing.md`。

Agent 不得新增、修改、删除测试文件，也不得执行任何测试命令；测试是否修改和
执行由用户决定，除非用户在当前任务中明确授权。常见禁改范围包括 `test/`、
`tests/`、`__tests__/`、`*.test.*`、`*.spec.*`、fixture、snapshot 和集成测试文件。
构建脚本如隐式运行测试，也视为测试命令。

Agent 应记录“按 human-owned-testing profile 跳过测试”，改用项目允许的编译、
类型、lint 或静态检查，并且不得把这些检查称为测试证据。
