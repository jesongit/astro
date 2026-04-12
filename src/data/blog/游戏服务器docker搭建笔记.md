---
author: Posase
pubDatetime: 2024-02-24T12:10:09Z
title: "「笔记」游戏服务器 Docker 搭建笔记"
draft: true
tags:
  - Docker
  - 游戏
  - 自建服务
  - 学习笔记
description: "使用 Docker 搭建游戏服务器的笔记，包含基础环境镜像构建"
---

<!-- [建议补充] 内容过少，建议补充完整后再发布 -->

## 安装 docker
[Docker Desktop](https://www.docker.com/products/docker-desktop/)

## 生成基础环境镜像
```shell
mkdir poem
cd poem
echo "FROM debian:12
FROM python:3.12
FROM erlang:27" > dockerfile
docker build -t poem:1.0 .
```

## 打包开发环境镜像
```shell
docker run -it --name poem -e TZ="Asia/Shanghai" -e LD_PRELOAD=/usr/local/lib/faketime/libfaketime.so.1 poem:1.0 bash
rm -rf etc/apt/sources.list.d/debian.sources
echo "deb https://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
# deb-src https://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
deb https://mirrors.aliyun.com/debian-security/ bookworm-security main
# deb-src https://mirrors.aliyun.com/debian-security/ bookworm-security main
deb https://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
# deb-src https://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
deb https://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib
# deb-src https://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib" > /etc/apt/sources.list
# 安装 erlang
apt update && apt install erlang -y

# 安装 rebar3
curl -O https://s3.amazonaws.com/rebar3/rebar3
chmod +x rebar3
./rebar3 local install
echo 'export PATH=/root/.cache/rebar3/bin:$PATH' >> ~/.bashrc # 必须单引号，否则会被解析为变量名

# 安装 faketime
git clone https://github.com/wolfcw/libfaketime.git
cd libfaketime
make && make install

# 生成环境镜像
exit
docker commit poem poem:raw
docker rm poem

# 测试修改系统时间
docker run -it --rm poem:raw bash
date # 查看修改前时间
export FAKETIME="+600" # 增加10分钟
data # 检查是否生效

```

```shell
rm -f /etc/apt/sources.list.d/debian.sources
echo "deb https://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
deb https://mirrors.aliyun.com/debian-security/ bookworm-security main
deb https://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
deb https://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib" > /etc/apt/sources.list
apt update && apt install pipx -y
```

```dockerfile
FROM erlang:27
WORKDIR /root
COPY install.sh ./
RUN bash install.sh
```

```shell
echo 'rm -f /etc/apt/sources.list.d/debian.sources
echo "deb https://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
deb https://mirrors.aliyun.com/debian-security/ bookworm-security main
deb https://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
deb https://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib" > /etc/apt/sources.list
apt update
apt install pip -y
apt install vim -y' > install.sh


echo 'FROM erlang:27
ENV PIP_BREAK_SYSTEM_PACKAGES 1
WORKDIR /root
ADD https://raw.githubusercontent.com/jesongit/script/main/linux/poem.sh ./install.sh
RUN bash install.sh' > dockerfile
docker build -t poem:base .
```