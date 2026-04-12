# Blog Style Guide / 博客写作规范

> 本文档定义了博客文章的写作规范和 Frontmatter 标准，适用于 `src/data/blog/` 下的所有 `.md` 文件。

---

## 一、Frontmatter 规范

### 必填字段

```yaml
---
author: Posase
pubDatetime: 2024-01-01T00:00:00Z   # ISO 8601 格式，UTC 时间
title: "文章标题"
draft: false                          # true 为草稿，不会发布
tags:
  - Tag1
  - Tag2
description: "50-160 字符的文章摘要"
---
```

### 可选字段

```yaml
modDatetime: 2024-06-01T00:00:00Z    # 内容有实质性更新时填写（修错别字不算）
featured: true                        # 推荐文章，会在首页突出展示
ogImage: "og-image.jpg"              # 社交分享图片
canonicalURL: "https://..."           # 规范 URL
hideEditPost: true                    # 隐藏编辑按钮
timezone: "Asia/Shanghai"            # 时区
```

### 字段规则

| 字段 | 规则 |
|---|---|
| `title` | 30-60 字符，简洁明确，包含核心关键词 |
| `description` | 50-160 字符，不要和标题重复，要能回答"这篇文章讲什么" |
| `pubDatetime` | 首次发布后永远不改 |
| `modDatetime` | 仅在内容有实质性更新时添加/修改 |
| `tags` | 每篇文章 2-5 个标签 |
| `featured` | 仅用于高质量长文，全站控制在 5-8 篇 |

---

## 二、标签（Tags）体系

### 命名规则
- 技术名词保持英文，首字母大写：`Docker`, `Nginx`, `Git`, `SSH`
- 分类标签使用中文：`教程`, `学习笔记`, `自建服务`
- 不使用空格分隔的中文标签：`Linux运维` (不是 `Linux 运维`)
- 避免同义标签并存

### 标签列表

**技术标签**（按需使用）：
`Docker`, `Nginx`, `Linux`, `Git`, `Erlang`, `Elixir`, `Golang`, `C#`, `Python`,
`Electron`, `JavaScript`, `Java`, `Minecraft`, `PVE`, `WSL`, `Hexo`, `Scoop`,
`Neovim`, `LazyVim`, `SSH`, `Headscale`, `Tailscale`, `Hysteria2`, `Immich`,
`Systemd`, `Markdown`, `Typora`, `MySQL`, `Cloudflare`, `MCSManager`, `Nuitka`,
`Jetbrains`, `IDEA`, `Debian`, `NAS`, `FRP`, `Fabric`, `Aria2c`, `LeetCode`

**分类标签**（每篇文章至少选一个）：
`教程`, `学习笔记`, `开发工具`, `自建服务`, `博客搭建`, `网络与代理`, `算法`,
`Linux运维`, `游戏`

---

## 三、标题规范

### 原则
标题应让读者一眼知道"这篇文章能帮我解决什么问题"，不使用分类前缀（分类功能由标签承担）。

### 规则
- **不使用书名号前缀**：不用 `「教程」`、`「笔记」` 等前缀，直接表达内容
- 标题中技术名词保持原始大小写：`Docker`, `GitHub`, `SSH`, `JetBrains`
- 标题不超过 60 字符
- 避免模糊表述：不用"简单使用"、"相关笔记"，用"入门"、"速查"、"详解"等
- 避免与标签重复：标题中不需要再写"教程"、"笔记"（除非是"学习笔记"类文章）

### 标题风格参考

| 文章类型 | 标题风格 | 示例 |
|---------|---------|------|
| 部署教程 | `工具名 + 动作 + 目标` | Docker 部署 Hysteria2 代理服务 |
| 入门指南 | `工具名 + 入门/上手/指南` | Neovim + LazyVim 快速上手 |
| 学习笔记 | `语言名 + 学习笔记` | Golang 学习笔记 |
| 速查手册 | `工具名 + 速查/手册/详解` | Git 常用命令速查 |
| LeetCode | `LeetCode + 题号 + 题名` | LeetCode 273. 整数转换英文表示 |

---

## 四、中英文排版规范

参考 [中文文案排版指北](https://github.com/sparanoid/chinese-copywriting-guidelines)：

### 空格规则
- 中英文之间加空格：`使用 Docker 部署` ✅ / `使用Docker部署` ❌
- 中文与数字之间加空格：`共 10 个` ✅ / `共10个` ❌
- 英文与数字之间不加空格：`Docker 3.0` ✅
- 行内代码前后加空格：`使用 `docker` 命令` ✅
- 全角标点前后不加空格

### 标点符号
- 中文语境使用全角标点：`，。！？：；「」`
- 代码/命令/英文语境使用半角标点
- 不要中英文标点混用

### 示例
```
✅ 使用 Docker 部署 Nginx Proxy Manager，支持 HTTPS 反向代理。
❌ 使用Docker部署Nginx Proxy Manager,支持HTTPS反向代理.
```

---

## 五、Markdown 书写规范

### 标题层级
- 文章正文从 `##`（h2）开始
- `#`（h1）留给页面标题（由 Frontmatter 的 title 生成）
- 不跳级：`## → ### → ####`，不要从 `##` 直接跳到 `####`

### 代码块
- 始终标注语言类型：` ```bash ` ✅ / ` ``` ` ❌
- 常用语言标识：`bash`, `yaml`, `json`, `python`, `go`, `erlang`, `elixir`,
  `javascript`, `typescript`, `c#`, `powershell`, `nginx`, `sql`
- 行内代码用反引号包裹命令、文件名、变量名、端口号
- 不要用反引号包裹普通概念词汇

### 列表
- 有序列表用于有步骤顺序的内容
- 无序列表用于并列项目
- 列表项之间保持一致的格式

### 链接
- 外部链接使用描述性文字：`[官方文档](https://...)` ✅ / `[点我](https://...)` ❌
- 站内文章互相引用时使用相对路径或完整 URL

### 图片
- 提供有意义的 alt 文本
- 大图考虑压缩

---

## 六、内容结构规范

### 教程类文章
```
## 前言/背景          ← 为什么写这篇，读者能得到什么
## 前置条件           ← 需要什么环境/工具/知识
## 安装/配置          ← 分步骤操作，每步有代码和说明
## 验证              ← 如何确认操作成功
## 常见问题          ← 可能踩的坑和解决方案
## 参考              ← 官方文档和引用来源
```

### 笔记类文章
```
## 安装/准备          ← 环境搭建（如有）
## 主题章节 1-N       ← 按主题分章节，不要一锅粥
## 其他/补充          ← 零散但有用的内容
```

### 通用要求
- 每篇文章开头说明目的和适用场景
- 有时效性的内容添加提醒：`> **注意：本文内容具有时效性，xxx 可能已变化。**`
- 代码块添加必要的注释
- 文末附上参考链接

---

## 七、文件命名规范

### 命名规则
使用英文小写 + 连字符（kebab-case），格式：`主题-关键词.md`

### 示例
| 文章内容 | 文件名 |
|---------|--------|
| Docker 部署 Hysteria2 | `docker-hysteria2.md` |
| Golang 学习笔记 | `golang-notes.md` |
| Neovim + LazyVim 安装 | `neovim-lazyvim-setup.md` |
| LeetCode 第 273 题 | `leetcode-273.md` |
| Git 命令速查 | `git-cheatsheet.md` |

### 注意事项
- 文件名会影响生成的 URL slug
- 修改文件名会导致已有 URL 失效，需谨慎操作
- 文件名只用英文小写字母、数字和连字符，不使用中文

---

## 八、草稿管理

- `draft: true` 的文章不会发布到线上
- 内容过少或未完成的文章保持 draft 状态
- 使用 HTML 注释标记草稿状态：
  - `<!-- [建议删除] 原因 -->` ：内容无价值，建议清理
  - `<!-- [建议补充] 原因 -->` ：有价值但内容不足，待补充

---

## 九、SEO 检查清单

发布前确认：
- [ ] title 包含核心关键词，30-60 字符
- [ ] description 独立撰写，50-160 字符，不与标题重复
- [ ] tags 2-5 个，使用标签列表中的标准标签
- [ ] 正文标题层级正确（h2 起步，不跳级）
- [ ] 代码块标注语言类型
- [ ] 中英文之间有空格
- [ ] 无拼写错误
- [ ] 外部链接可访问
- [ ] 有时效性的内容添加了提醒
