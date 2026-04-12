---
author: Posase
pubDatetime: 2024-05-18T09:06:55Z
title: "Cloudflare Pages 部署 Hexo 博客"
draft: false
tags:
  - Hexo
  - Cloudflare
  - 博客搭建
  - 教程
description: "使用 Cloudflare Pages 部署 Hexo 博客，加速国内访问并配置自定义域名"
---


## 准备
准备好hexo仓库，可以参考[另一篇](https://www.posase.im/posts/b385f28/)

## 新建 Page

### 设置仓库
`Workers 和 Pages` - `创建应用程序` - `Pages` - `连接到 git`

### 配置 Page 参数
`开始设置` - `构建命令：npm run build` - `构建输出目录: public`

### 部署
点击保存并部署，查看对应网站是否可以正常访问

### 自定义域
默认生成的域名过长，不方便记忆，可以添加自定义域名来访问博客

需要按照提示添加`CNAME`类型的域名解析即可

## 其他
使用 cloudflare 可以加速博客的页面访问，一定程度改善国内无法访问的问题


