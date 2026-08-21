---
name: domain-modeling
description: Use when a Sub Spec exposes ambiguous domain language, conflicting bounded contexts, or a long-lived hard-to-reverse architectural decision.
---

# 领域建模

把跨需求仍然有效的业务语言和架构取舍保存为长期知识，不把单次需求内容复制成另一份规格。

## 1. 事实边界

| 事实 | 唯一职责 |
|---|---|
| `docs/agent/domain-language.md` | 规范领域词、定义、禁用同义词和业务归属 |
| `docs/agent/adr/` | 难以逆转且存在真实取舍的长期决定及原因 |
| `AGENTS.md` / `WORKSPACE.md` | 项目结构、技术栈、服务关系和操作入口 |
| 当前子 Spec `state.md` | 本期契约、决定、范围、未知项与来源指针 |
| 代码 | 当前实现现实，不自动推翻已经确认的业务定义 |

任意两类事实冲突时，将冲突标为 blocker 并交给用户裁决，禁止静默覆盖。

## 2. 工作流

1. 如果领域语言或 ADR 已存在，先读取相关内容，再检查代码与当前说法是否一致。
2. 发现含糊词、同词异义或上下文归属不清时，提出一个规范术语和应避免的同义词。
3. 用具体业务场景验证术语边界；本期实现细节留在 `state.md`，不写入领域语言。
4. 访谈期间只收集候选变更，不修改文件。
5. 达成共同理解后，展示领域语言差异和 ADR 候选；只有用户明确批准后才落盘。
6. 按需创建文件。格式必须读取 [DOMAIN-LANGUAGE-FORMAT.md](DOMAIN-LANGUAGE-FORMAT.md) 和 [ADR-FORMAT.md](ADR-FORMAT.md)。

## 3. ADR 门槛

只有同时满足以下条件才提出 ADR：改变代价高、缺少背景会令人意外、确实比较过
可行替代方案。任一条件不满足，就留在当前 `state.md` Decisions 或不记录。

## 4. 红线

- 不把 API 字段、数据库结构、任务清单或临时需求写进领域语言。
- 不为显而易见、容易撤销或尚未决定的事项创建 ADR。
- 不在用户批准前写入领域文档，也不让领域文档绕过当前 state 的冻结契约。
