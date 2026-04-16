---
author: Posase
pubDatetime: 2026-04-16T00:00:00Z
title: "Claude Code 使用技巧与常见问题排查"
draft: false
tags:
  - 开发工具
  - 学习笔记
description: "Claude Code 和 Claude Desktop 的使用技巧、CLAUDE.md 配置方法，以及 Bash 路径格式、MCP 加载失败等常见问题的排查与修复"
---

日常使用 Claude Code 和 Claude Desktop 过程中积累的一些技巧和踩坑记录。

> **注意：本文内容具有时效性，Claude Code 更新频繁，部分功能可能已变化。**

## Claude Code 实用技巧

### 初始化项目配置

接手一个比较复杂的项目时，建议先初始化项目配置：

```bash
# 生成 CLAUDE.md 项目指导文件
/init
```

`/init` 会根据项目结构自动生成一份 `CLAUDE.md` 文件，包含构建命令、测试脚本、目录说明等。Claude Code 在每次会话开始时都会读取这个文件，相当于给 AI 一份项目 "说明书"。

生成的文件通常偏冗长，建议精简到关键信息即可——如果一条规则你自己都说不清为什么需要，那 Claude 也大概率不会遵守。

### CLAUDE.md 配置建议

`CLAUDE.md` 支持分层配置：

| 文件位置 | 作用范围 | 典型内容 |
|---------|---------|---------|
| `~/.claude/CLAUDE.md` | 全局所有项目 | 通用编码规范、个人偏好 |
| 项目根目录 `CLAUDE.md` | 当前项目 | 项目架构、构建命令、目录说明 |
| 子目录 `CLAUDE.md` | 子目录范围 | 模块级约束（较少使用） |

**配置要点**：

- **否定式指令比肯定式更有效**：`NEVER 使用 var 声明变量` 比 `尽量使用 let/const` 更容易被遵守
- **保持规则简短**：过长的规则容易被忽略，每条规则控制在 1-2 行
- **包含验证命令**：写上测试、lint 命令，让 Claude 能自我验证

### 跳过权限确认

```bash
# 跳过所有工具调用的权限确认（需谨慎使用）
claude --dangerously-skip-permissions

# 推荐设置为别名
alias cc='claude --dangerously-skip-permissions'
```

参数名故意起得很吓人。只在完全理解 Claude Code 行为后使用，避免误操作导致不可逆的变更。

### 上下文管理

Claude Code 的上下文窗口是核心资源。上下文快满时会触发压缩（compaction），降低后续回复质量。

**管理建议**：

- **一个会话完成一个任务**，完成后 `/clear` 开启新会话
- **不确定方案时用 Plan 模式**（`Shift+Tab` 切换），避免 Claude 花大量时间解决错误的问题
- **修正 2 次仍不对就重开**：上下文已积累太多失败尝试，`/clear` 写个更清晰的 prompt 重新开始
- **复杂调查用 subagent**：`用 subagent 查找支付流程中失败交易的处理逻辑`，子代理在独立上下文中工作，不占用主会话空间

### 让 Claude 自我验证

给 Claude 反馈循环，让它自己发现问题：

```
重构认证中间件，将 session token 替换为 JWT。
完成后运行现有测试套件，修复所有失败用例。
```

Claude 运行测试、发现失败、自行修复，无需人工介入。据 Claude Code 之父 Boris Cherny 透露，仅这一条就能带来 2-3 倍的质量提升。

### 常用快捷操作

| 操作 | 说明 |
|------|------|
| `Esc` | 停止 Claude 当前操作 |
| `Esc+Esc` | 打开历史检查点，回滚到之前的状态 |
| `Ctrl+S` | 暂存当前 prompt，先问个别的 |
| `Ctrl+B` | 将长时间运行的命令发送到后台 |
| `!command` | 直接执行 shell 命令（如 `!git status`） |
| `@file` | 直接引用文件（如 `@src/auth.ts`） |
| `/btw` | 快速旁问，不进入对话历史 |
| `/voice` | 语音输入 prompt |

## Claude Desktop 路径格式问题

在 Claude Desktop 的 Bash 工具中执行 `ls` 等命令时，如果使用 Git Bash 作为 Shell，可能会遇到 `exit code 2` 错误。

### 问题原因

Git Bash 要求使用 Unix 风格路径（正斜杠 `/`），但 Claude 可能传入了 Windows 风格的反斜杠路径（`\`），导致路径解析失败。

```bash
# 失败：Windows 反斜杠路径
ls D:\\code\\astro\\src\\data\\blog\\notes\\
# Git Bash 将 \ 识别为转义字符，路径解析错误 → exit code 2
```

### 解决方案

**方案一：Unix 风格路径（推荐）**

将 Windows 盘符 `D:` 转换为 `/d/`，全程使用正斜杠：

```bash
ls /d/code/astro/src/data/blog/notes/
```

**方案二：引号包裹 Windows 路径**

```bash
ls "D:/code/astro/src/data/blog/notes/"
```

### 路径格式对照

| 场景 | 正确写法 | 错误写法 |
|------|---------|---------|
| Git Bash 路径 | `/d/code/xxx` 或 `"D:/code/xxx"` | `D:\code\xxx` |
| Shell 语法 | 正斜杠 `/`、`/dev/null` | 反斜杠 `\`、`NUL` |
| 文件查找 | 优先用 `Glob` 工具 | 在 Bash 中传 Windows 路径 |

Claude Desktop 的 Bash 工具系统 Prompt 明确要求使用 Unix Shell 语法。遇到路径问题时，优先使用 `Glob` 工具（内部自动处理路径格式转换）。

## Claude Desktop MCP 加载失败

### 问题现象

Claude Desktop 启动时弹出提示：

> Some MCP servers could not be loaded: fetch

### 原因分析

Claude Desktop **免费版不支持 `streamable_http` 类型的远程 MCP 服务器**，仅支持 `stdio` 本地进程式服务器。`streamable_http` 仅对 Pro/Max/企业版开放，免费版会直接判定为无效配置并跳过加载。

### 解决方案

**方案一：升级到 Pro/Max 计划**

支持远程 MCP 服务器，包括 `streamable_http` 和 `sse` 类型。

**方案二：改用 stdio 本地启动（免费版可用）**

将远程 MCP 服务器改为本地进程方式启动。以 `fetch` 服务器为例，修改 Claude Desktop 配置文件：

```json
{
  "mcpServers": {
    "fetch": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-fetch"]
    }
  }
}
```

这样改为 `stdio` 模式，免费版也可以正常加载。

## 参考

- [Claude Code 官方最佳实践](https://code.claude.com/docs/zh-TW/best-practices)
- [50 Claude Code Tips and Best Practices — Builder.io](https://www.builder.io/blog/claude-code-tips-best-practices)
- [Claude Code 最佳实践指南 — 知乎](https://zhuanlan.zhihu.com/p/2009744974980331332)
- [我的 Claude Code 最佳实践 — 腾讯云](https://cloud.tencent.com/developer/article/2645079)
