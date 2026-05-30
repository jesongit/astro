---
author: Posase
pubDatetime: 2026-05-30T00:00:00Z
title: "Pi Agent 快捷键速查"
draft: false
tags:
  - 开发工具
  - 学习笔记
description: "Pi Agent 终端快捷键速查表，涵盖导航、编辑和其他常用快捷键，提升命令行交互效率"
---

Pi Agent 是一个终端 AI 编程助手，支持丰富的键盘快捷键。本文整理了三类常用快捷键：光标导航、文本编辑和其他功能操作。

## 导航

| 快捷键 | 动作 |
|---|---|
| `↑` / `↓` / `←` / `Ctrl+B` / `→` / `Ctrl+F` | 移动光标 / 浏览历史（空行时按 `↑` 可浏览历史） |
| `Alt+←` / `Ctrl+←` / `Alt+B` / `Alt+→` / `Ctrl+→` / `Alt+F` | 按单词移动 |
| `Home` / `Ctrl+A` | 移动到行首 |
| `End` / `Ctrl+E` | 移动到行尾 |
| `Ctrl+]` | 向前跳转到指定字符 |
| `Ctrl+Alt+]` | 向后跳转到指定字符 |
| `PageUp` / `PageDown` | 按页滚动 |

## 编辑

| 快捷键 | 动作 |
|---|---|
| `Enter` | 发送消息 |
| `Shift+Enter` | 换行（Windows Terminal 下用 `Ctrl+Enter`） |
| `Ctrl+W` / `Alt+Backspace` | 向后删除一个单词 |
| `Alt+D` / `Alt+Delete` | 向前删除一个单词 |
| `Ctrl+U` | 删除到行首 |
| `Ctrl+K` | 删除到行尾 |
| `Ctrl+Y` | 粘贴最近删除的文本 |
| `Alt+Y` | 粘贴后循环切换已删除的文本 |
| `Ctrl+-` | 撤销 |

## 其他

| 快捷键 | 动作 |
|---|---|
| `Tab` | 路径补全 / 接受自动补全 |
| `Escape` | 取消自动补全 / 中止流式输出 |
| `Ctrl+C` | 清空编辑器（首次）/ 退出（再次） |
| `Ctrl+D` | 退出（当编辑器为空时） |
| `Shift+Tab` | 循环切换思考级别 |
| `Ctrl+P` / `Shift+Ctrl+P` | 循环切换模型 |
| `Ctrl+L` | 打开模型选择器 |
| `Ctrl+O` | 切换工具输出展开状态 |
| `Ctrl+T` | 切换思考块可见性 |
| `Ctrl+G` | 在外部编辑器中编辑消息 |
| `Alt+Enter` | 将后续消息加入队列 |
| `Alt+Up` | 恢复已排队的消息 |
| `Alt+V` | 从剪贴板粘贴图片 |
| `/` | 斜杠命令 |
| `!` | 运行 bash 命令 |
| `!!` | 运行 bash 命令（不携带上下文） |

## 参考

- [Pi Coding Agent 文档](https://github.com/jesongit/pi-coding-agent)
