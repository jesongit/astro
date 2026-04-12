---
author: Posase
pubDatetime: 2023-04-08T07:00:28Z
title: "Debian 折腾手册"
draft: false
tags:
  - Linux
  - Debian
  - Docker
  - Linux运维
  - 学习笔记
description: "Debian 服务器常用配置速查，包含 APT 源替换、SSH 免密登录、Docker 服务部署等"
---


## 常用指令
```bash
# debian 11 替换 apt 源
echo "deb https://mirrors.aliyun.com/debian/ bullseye main non-free contrib
deb-src https://mirrors.aliyun.com/debian/ bullseye main non-free contrib
deb https://mirrors.aliyun.com/debian-security/ bullseye-security main
deb-src https://mirrors.aliyun.com/debian-security/ bullseye-security main
deb https://mirrors.aliyun.com/debian/ bullseye-updates main non-free contrib
deb-src https://mirrors.aliyun.com/debian/ bullseye-updates main non-free contrib
deb https://mirrors.aliyun.com/debian/ bullseye-backports main non-free contrib
deb-src https://mirrors.aliyun.com/debian/ bullseye-backports main non-free contrib" > /etc/apt/sources.list

# debian 12 使用 http 是防止缺少库无法更新，可以安装对应库后改为 https
echo "deb http://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
deb-src http://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
deb http://mirrors.aliyun.com/debian-security/ bookworm-security main
deb-src http://mirrors.aliyun.com/debian-security/ bookworm-security main
deb http://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
deb-src http://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
deb http://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib
deb-src http://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib" > /etc/apt/sources.list


# 一键安装 Docker
curl -sSL https://get.docker.com/ | sh
```

## 配置 `SSH` 免密登录
```bash
vim /etc/ssh/sshd_config
PermitRootLogin without-password # 允许 root 登录（非密码登录） 默认不用改
PubkeyAuthentication # 密钥登录
AuthorizedKeysFile .ssh/authorized_keys # 公钥文件
systemctl restart ssh
```

## 安装 `Transmission` Docker 版本 + `Transmission Web Controller`
```bash
docker run -d \
  --name=transmission \
  -e TZ=Asia/Shanghai \
  -e TRANSMISSION_WEB_HOME="/config/web" \ # 这里是虚拟机内地址，并且需要web
  -e USER="user" \  # 记得改
  -e PASS="pass" \  # 记得改
  -p 39091:9091 \
  -p 51413:51413 \
  -p 51413:51413/udp \
  -v ./transmission/downloads:/downloads \
  -v ./transmission/config:/config \
  -v ./transmission/watch/folder:/watch \
  --restart unless-stopped \
  linuxserver/transmission:latest

# 下载 twc 这里先到指定的安装目录
wget https://github.com/ronggang/transmission-web-control/raw/master/release/install-tr-control-cn.sh
bash install-tr-control-cn.sh
# 先选择 6 设置安装位置：./config，注意该目录下必须存在 web 目录，然后选择 1 安装即可
```

## `SSH` 密钥使用 `Git`
> 上传密钥到 `/root/.ssh/` 目录下，并执行 `chmod 600 ~/.ssh/id_rsa ~/.ssh/id_rsa.pub` 修改权限

## `Docker` 一键安装
```bash
# Alist
docker run -d --restart=always -v ./alist:/opt/alist/data -v /disk:/disk -p 35244:5244 -e PUID=0 -e PGID=0 -e UMASK=022 --name="alist" xhofe/alist:latest

# Portainer 中文版 还有个 -v xxx:/data 没导出
docker run -d --name portainer -p 9000:9000 --restart=always -v /var/run/docker.sock:/var/run/docker.sock 6053537/portainer-ce
```
