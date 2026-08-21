---
name: writing-design-doc
description: Use when the user or an applicable project rule explicitly requires a human-facing technical design document after a Sub Spec state is frozen.
---

# 编写可选技术设计导出

## 1. 定位

本 skill 只生成给人评审的技术设计文档。它不是 brainstorming 或 P/G/E 的默认步骤，也不是 AI 恢复上下文的状态源。

开始时宣布：`我正在使用 writing-design-doc 生成可选的人类评审文档。`

仅在以下任一条件成立时使用：

- 用户明确要求 design / 技术方案；
- 当前项目或团队规约明确要求技术设计文档。

否则保持 `state.md`，不要调用本 skill。

## 2. 输入与事实优先级

开始前读取：

1. 当前 Sub Spec 的 `state.md`；
2. `state.md` 中与设计内容相关的 Context Pointers；
3. 当前工作根、目标服务和团队规约中命中的技术设计规则；
4. 适用的领域语言文档与 ADR。

事实冲突时，当前 PRD、视觉来源、外部契约、代码与配置优先于旧导出物。发现冲突先更新 `state.md` 的决策或未知项，再生成文档；不得让导出物反向成为权威源。

## 3. 输出

输出到当前 Sub Spec：

```text
<sub-spec>/exports/technical-design.md
```

文档必须注明：

```markdown
> 派生自：`../state.md` revision `<revision>`
> 用途：人类评审导出；实现与验收以 `state.md` 为准
```

不得创建：

- 解析后的 `<artifact-root>/specs/*-design.md`；
- requirements anchor、plan、summary 或 verification；
- 与 `state.md` 平行维护的决策表。

## 4. 内容规则

章节和内容粒度服从当前团队技术设计规约。若规约没有固定结构，只保留评审真正需要的内容：

1. 目标与范围；
2. 现状和约束；
3. 方案与关键流程；
4. 接口、数据或权限变更；
5. 风险、回滚与待确认项；
6. 验收边界和来源链接。

要求：

- 结论先行，用业务语言说明影响；
- 引用 Context Pointer，不复制原始证据；
- 不展开实现步骤清单；
- 不记录执行进度、验证结果或会话流水账；
- 不写 `TODO` 掩盖 blocker，blocker 必须回到 `state.md`。

## 5. 完成门禁

交付前确认：

- 触发来源确实是用户要求或规约要求；
- 文件位于当前 Sub Spec 的 `exports/`；
- revision 与当前 `state.md` 一致；
- 所有关键结论都能回指 `state.md` 或其 Context Pointer；
- 文档没有成为 P/G/E 的输入依赖；
- 未执行 git commit 或 push。

完成后只返回导出路径和对应 state revision。
