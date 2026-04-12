---
author: Posase
pubDatetime: 2023-12-24T13:37:02Z
title: "「笔记」WSL 相关笔记"
draft: false
tags:
  - WSL
  - Linux
  - Linux运维
  - 学习笔记
description: "WSL 使用笔记，包含 APT 镜像替换、代理配置和常见问题处理"
---


## 修改 `apt` 镜像
```bash
# 因为默认是最新版本，这里是 Debian 12 的镜像地址
echo "deb http://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
deb-src http://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
deb http://mirrors.aliyun.com/debian-security/ bookworm-security main
deb-src http://mirrors.aliyun.com/debian-security/ bookworm-security main
deb http://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
deb-src http://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
deb http://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib
deb-src http://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib" > /etc/apt/sources.list
```
> 更多地址可查看 [阿里云 Debian 镜像](https://developer.aliyun.com/mirror/debian)

## 修改 `root` 密码
```bash
wsl --user root # 使用 root 进入 wsl
passwd          # 修改 root 密码
```

## 相关设置
> 设置以官方文档为准，可能因为版本存在部分差异

### 局域网访问 WSL, 使用系统代理等
```bash
# 用户目录下 .wslconfig
[wsl2]
networkingMode=mirrored     # 镜像模式，会使用跟 Windows 相同的 IP
dnsTunneling=true
autoProxy=true              # 使用 Windows 系统代理
[experimental]
hostAddressLoopback=true    # 使 Windows 可以通过 IP 正常访问 WSL
```

### 修改系统默认使用 root 登录
```bash
# WSL 系统中 /etc/wsl.conf
[boot]
systemd=true    # 开启 systemd
[user]
default="root"  # 默认启动用户
```
### 有什么进入系统需要执行的命令，可以加到 `~/.bashrc` 中
```bash
# ~/.bashrc 文件
# 例如：如果 MySQL 数据库没启动，启动 MySQL
if [ -n "`service mysql status | grep not`" ]
then
    service mysql start
fi
```