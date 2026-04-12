---
author: Posase
pubDatetime: 2022-02-06T13:37:25Z
modDatetime: 2022-10-01T03:20:01Z
title: "JetBrains 全家桶激活教程"
draft: false
tags:
  - Jetbrains
  - IDEA
  - 教程
description: "使用 ja-netfilter 激活 Jetbrains 全家桶的详细步骤，支持自动和手动两种方式"
---


## 一些废话

> **注意：本文内容具有时效性，ja-netfilter 方案可能已失效，请以原作者最新发布为准。**

其实文件里面都写的很清楚，甚至带了 `Jetbrains` 全家桶的配置文件

不同系统略有差异，以最新文件的 `ReadMe` 文档为准，本文仅供参考

原理详见大佬[原文](https://zhile.io/2021/11/29/ja-netfilter-javaagent-lib.html)
更多相关信息[详见这里](https://chip-tail-e93.notion.site/Ja-netfilter-9886afbfe1ed4d5e90a713e63718f647#bb0bbd2772334a7e9e1042118cb6008d)

## 文字教程

### 下载 `IDEA`

[下载页面](https://www.jetbrains.com/idea/download/#section=windows)

> 安装版和解压版都可以，唯一需要注意的就是，你知道自己安装在哪了

### 下载 `ja-netfilter.jar`

[下载页面](https://jetbra.in/s)
> 如果出现一堆链接，点一个能进去的就行
> 点击页面上方的 `ja-netfilter-all.zip` 下载即可，下面的都是对应软件的过期激活码

### 自动：以环境变量的方式
执行 `script` 文件夹中的安装脚本即可，不需要执行手动方式，需要重启一下

### 手动：修改对应 `.vmoptions` 文件

在安装目录的 `Bin` 文件夹中找到该文件，最新版的文件名一般为 `idea64.exe.vmoptions`

最后面添加 `-javaagent:*\ja-netfilter-all\ja-netfilter.jar=jetbrains`

> 注意 `*` 是你的 `ja-netfilter.jar` 解压后的文件目录，同时注意保留其他配置文件

### 使用激活码进入 `IDEA`

正常打开软件，使用前面 `ja-netfilter.jar` 下载页面下面的激活码即可激活软件
> 再次说明，大佬一般都会及时更新插件，一切以 `ReadMe` 中的说明为准，不同版本可能存在差异
