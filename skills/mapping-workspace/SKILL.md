---
name: mapping-workspace
description: 进入含 ≥2 个微服务子项目的工作根目录时使用——扫描子项目、生成 / 校准 WORKSPACE.md（service map），为后续 brainstorming 跨服务影响面盘点提供基础
---

# 工作区服务地图（service map）

## 1. 概述

把"工作根目录下并列多个微服务/前端子项目"的事实，落成一份可读、可校准的 `WORKSPACE.md`。所有跨服务任务都从这份文件开始。

**开始时宣布：** "我正在使用 mapping-workspace 技能生成 / 校准 WORKSPACE.md。"

## 2. 触发条件

满足任一即触发：
- 当前工作根目录直接子目录含 ≥2 个微服务/前端项目（启发式标志见下文），且 `WORKSPACE.md` 不存在
- `WORKSPACE.md` 存在，但本次 brainstorming 的「跨服务影响面盘点」结果与之矛盾（新增 edge / 新增服务 / 启动命令已变）
- 用户显式要求「重新生成 service map」

## 3. HARD-GATE

在用户审改并批准 `WORKSPACE.md` 草案之前，**不得**进入 brainstorming 的方案
选择，不得执行子 Spec 的首个「代码契约骨架」Execution Unit，也不得写代码。

## 4. 流程（5 步）

### 4.1 步骤 1：识别子项目

扫描工作根目录的**直接子目录**（不递归）。优先使用根目录 `AGENTS.md` / `WORKSPACE.md` 中声明的服务清单、子项目标志文件和排除目录。

根目录尚未声明时，按以下兜底规则列出"候选子项目"，但不要推断具体技术栈：
- 子目录内存在 service 级 context 文件：`AGENTS.md` / `CLAUDE.md`
- 子目录内存在项目 manifest、构建文件、锁文件、容器文件或启动脚本
- 工作根存在联调编排文件时，记录路径，但不把编排文件本身计入服务

### 4.2 步骤 2：读取每个子项目的 service 级 context 文件

按优先级查找第一份存在的：`AGENTS.md > CLAUDE.md`。从中提取：
- 技术栈 / 关键库版本
- 启动命令 / 端口
- 强约束（如"禁止改动 X 模块"）
- 项目约定的调用关系识别规则、语义检索工具和验证命令

都不存在时记录"建议创建"提示，但不阻塞流程。

### 4.3 步骤 3：启发式识别调用关系（疑似 edges）

仅作"疑似"列示，**严禁标"已确认"**。

**结构化扫描优先使用项目声明的工具和模式。**

如果根目录或服务级 `AGENTS.md` 给出了 ast-grep / LSP / framework-specific scanner，用其中的命令和模式。skill 本身不内置具体框架注解、SDK 类名或消息中间件 API。

**其他识别手段**（ast-grep 覆盖不到时）：
- grep 各服务源码里彼此的 service name、host name、URL path、topic / queue / event name 等字面量
- 读联调编排文件里的依赖关系、网络别名、环境变量
- 读项目配置文件里的下游服务地址、消息主题、外部资源 key
- 使用项目 `AGENTS.md` 声明的语义引用工具追踪"某个 client / producer / gateway 在本服务内被谁调用"

每条 edge 必须输出形态如：
```
order-service → payment-service：通过 `<协议/通道/资源名>`（疑似，待人工确认）
```

### 4.4 步骤 4：生成 `WORKSPACE.md` 草案

使用模板 `templates/WORKSPACE.md`，落到工作根目录 `WORKSPACE.md`。表格里：
- 已存在 service 级 context 文件 → 直接填路径
- 未识别端口 / 启动命令 → 写"待补充（无 service context 文件可参考）"
- 调用关系全部带「（疑似，待确认）」字样
- 「启动命令」「运行 profile」「端口」三列**必填**——跨服务联调时端口冲突由此处提前暴露；任一未填即视为草案不完整
- 端口来源：优先读 service context 文件声明；其次按项目 AGENTS.md 声明的配置文件位置扫描；未找到的标"待用户补充"，不要乱猜
- 端口冲突检测：所有候选服务两两端口不同；冲突时在该行末标注与哪个服务冲突

### 4.5 步骤 5：用户审改

输出草案路径与 diff 摘要，请用户：
- 修正错误的 edges
- 补全启动命令 / 端口
- 把"疑似"改成"已确认"或删除

用户回复"OK"前不进入下一个 skill。

## 5. 后续

`mapping-workspace` 完成后：
- 回到 brainstorming 的单个子 Spec 流程，从“探索领土”重新核对跨服务影响面
- 后续若 brainstorming 发现新 edge 或服务，由调用方决定是否再次触发本 skill

## 6. 自检清单

写完 `WORKSPACE.md` 草案后逐条核对：
- [ ] 服务清单覆盖工作根所有候选子项目
- [ ] 每个服务行至少有 service context 文件路径或"建议创建"提示
- [ ] 调用关系全部标「（疑似，待确认）」或「（已确认）」，无空白判断
- [ ] 无未填字段（用"待补充"显式标注，不留空）
- [ ] 文件落在工作根 `WORKSPACE.md`，不在任何子项目内
- [ ] 未发生任何 git 写操作
- [ ] 「启动命令」「dev profile」「端口」三列每个服务都填齐，无空白
- [ ] 端口两两不同，无冲突标注遗留

不全部勾上不算完成。
