---
author: Posase
pubDatetime: 2022-02-08T02:23:31Z
title: "GitHub SSH 密钥配置"
draft: false
tags:
  - Git
  - SSH
  - 开发工具
  - 教程
description: "生成 SSH 密钥、配置 Git 用户信息并上传公钥到 GitHub 的简明步骤"
---


## 生成 `SSH` 密钥

```bash
ssh-keygen -t rsa -C 'YourEmail'
# 其实直接 ssh-keygen 也可以
# -t 是指定 密钥类型 -C 是注释
```

> 生成的密钥在用户目录的 `.ssh` 文件夹下

## 配置 `Git`

```bash
git config --global user.name = 'YourName'
git config --global user.email = 'YourEmail'
```

## 上传密钥

在用户目录下找到 `.ssh/id_rsa.pub` 复制文件内容
在 `GitHub` 中，`Setting` - `SSH and GPG Keys` - `New SSH key` 中添加即可

## 参考
- [GitHub 官方文档 - 使用 SSH 连接](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)
