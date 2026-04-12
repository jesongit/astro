---
author: Posase
pubDatetime: 2022-04-11T02:58:09Z
title: "「工具」Aria2c ---- 多协议、跨平台的下载程序"
draft: true
tags:
  - Aria2c
  - 开发工具
description: "Aria2c 多协议下载工具的安装和基本使用"
---

<!-- [建议删除] 内容仅有安装链接，过于简略 -->

## 安装

[Aria2 --- Github](https://github.com/aria2/aria2/releases/tag/release-1.36.0)

> 如果命令行中输入后没有这个命令，请检查是否添加环境变量  
> 如果你的是 `Windows Pc`， 当然可以选择以前介绍过的 `Scoop` 安装

## 开始

`aria2c "url"` 简单的一行指令，即可开始你的下载

> 当然这里的 `url` 也可以是一个种子文件的路径，亦或是一个 `Metalink`

### 常用选项

或许你不想看太多，这里直接给一些常用的选项
```bash
# 指定下载路径 -d
aria2c -d "下载目录" "url"

# 指定下载文件名 -o
aria2c -o "重命名.txt" "url"

# 断点续传 -c
aria2c -c "url"

# 与一台服务器的最大连接数 -x
# 下载一个文件使用的最大连接数 -s
# 这两个选项一般同时使用 推荐 16
aria2c -x 16 -s 16 "url"
```