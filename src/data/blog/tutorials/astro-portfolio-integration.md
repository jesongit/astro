---
author: Posase
pubDatetime: 2026-09-09T00:00:00Z
title: "Astro 作品展示接入与增强配置指南"
draft: false
featured: true
tags:
  - GitHub
  - 教程
  - 开发工具
description: "介绍如何将 GitHub 开源仓库接入 Astro 作品展示，区分基础与增强模式，并使用 AI 生成可验证的作品配置、提交同步和排查常见问题。"
---

## 前言

Astro 作品展示支持直接读取 GitHub 仓库资料，也支持通过一份可选配置补充更完整的项目介绍。如果你有一个公开的 GitHub 仓库，希望把它展示在本站，可以按本文完成接入。

本文中的“增强配置”只负责补充作品内容，不负责控制作品是否展示。展示开关、精选状态和排序仍由网站管理页维护。

## 两种接入模式

### 基础模式

基础模式不需要修改目标仓库。管理页将仓库设为展示后，网站会读取以下资料：

- GitHub 仓库名称、Description、Topics、主要语言、License 和 Stars；
- 仓库默认分支中的 README；
- GitHub Releases 中的版本、发布说明和附件。

这种模式适合项目资料已经比较完整，或者暂时不想在仓库中增加额外文件的情况。

### 增强模式

在目标仓库默认分支创建下面的文件：

```text
.portfolio/portfolio.json
```

校验通过后，配置中的标题、摘要、功能、技术栈、链接和图片等字段会覆盖对应的基础内容。还可以按需添加：

```text
.portfolio/overview.md
.portfolio/assets/cover.webp
```

配置无效时不会破坏已有展示，系统会保留上一份有效内容或退回基础模式。

## 最小配置

下面的文件已经是合法的增强配置：

```json
{
  "$schema": "https://posase.im/api/portfolio/schema/v1.json",
  "schemaVersion": 1
}
```

实际使用时，建议只填写能够从代码、README 或可运行界面中验证的内容：

```json
{
  "$schema": "https://posase.im/api/portfolio/schema/v1.json",
  "schemaVersion": 1,
  "title": "项目真实名称",
  "summary": "基于实际代码和 README 描述项目用途。",
  "bodyFile": ".portfolio/overview.md",
  "features": [
    "已经实现并能证实的功能"
  ],
  "techStack": [
    "TypeScript"
  ],
  "links": {
    "docs": "https://example.com/docs"
  },
  "cover": {
    "path": ".portfolio/assets/cover.webp",
    "alt": "真实项目界面的概览"
  }
}
```

示例中的名称、网址和图片必须替换成项目自己的真实资料；没有对应资料时直接删除字段。

## 让 AI 生成增强配置

可以打开 [作品接入指南](/portfolio-guide/)，复制页面中的提示词；也可以直接使用纯文本提示词：

[https://posase.im/api/portfolio/prompt.txt](https://posase.im/api/portfolio/prompt.txt)

在目标仓库目录中，把提示词交给 Cursor、Claude Code、Codex 或其他 AI 编程工具，并补充下面的要求：

```text
请在当前仓库中按照作品展示规范生成增强配置。

先阅读：
https://posase.im/api/portfolio/spec.json
https://posase.im/api/portfolio/schema/v1.json

请分析当前仓库真实代码、README 和可运行界面，创建 .portfolio/portfolio.json；
必要时创建 .portfolio/overview.md 和 .portfolio/assets/ 中的真实截图。

只填写已经实现且可以验证的内容，不要编造功能、链接、版本、下载信息或截图。
不要填写 visible、featured、order、slug、version、release notes 等网站管理字段。
完成后校验 Schema，展示修改内容、资料依据和仍需人工确认的地方。
不要自行 commit、push 或发布。
```

AI 生成后，先检查文件内容和 diff，再由你决定是否提交。提示词不会自动写入 GitHub，也不会自动把仓库设为展示。

## 提交后如何同步

1. 将 `.portfolio/portfolio.json` 提交并推送到目标仓库默认分支。
2. 在本站后台确认仓库的“展示”开关已打开。
3. 点击该仓库的“同步”按钮，立即触发一次针对该仓库的同步。
4. 等待同步和构建发布完成后，打开作品页检查标题、摘要、功能和链接。

也可以等待定时 Action。当前定时同步为每天一次，中国时间 00:00 执行；GitHub Actions 可能因队列产生少量延迟。手动同步适合刚提交增强配置后立即验证。

“增强”筛选只是后台的状态筛选，不需要额外点击启用。只要配置文件存在于默认分支且校验通过，下一次同步会自动识别为增强模式。

## 容量与约束

- `portfolio.json` 最大 32 KiB，增强正文最大 128 KiB；
- 单张图片最大 2 MiB，截图总大小最大 8 MiB；
- 图片放在 `.portfolio/assets/` 下，仅支持 PNG、JPG、JPEG 和 WebP；
- `features` 最多 8 项，`techStack` 最多 20 项，`screenshots` 最多 6 张；
- `links` 只支持 `website`、`demo` 和 `docs`，且必须是 HTTPS 地址；
- 版本、发布日期、Release Notes 和 Release 附件由 GitHub Releases 提供，不要写入增强配置。

## 常见问题

### 配置提交后没有变成增强模式

确认文件路径是 `.portfolio/portfolio.json`，并且已经推送到仓库默认分支。然后在后台手动点击“同步”。如果 JSON 不符合 Schema，后台会保留上一份有效内容，并在同步结果中记录警告。

### 配置影响作品是否展示吗？

不会。仓库是否展示、是否精选以及排序值都由本站后台设置控制，增强配置只影响作品内容。

### 没有截图怎么办？

截图不是必填项。没有真实截图时省略 `cover` 和 `screenshots`，不要让 AI 生成或猜测项目界面。

## 规范和接口

- [作品接入指南](/portfolio-guide/)
- [作品配置规范](/api/portfolio/spec.json)
- [v1 Schema](/api/portfolio/schema/v1.json)
- [纯文本 AI 提示词](/api/portfolio/prompt.txt)
