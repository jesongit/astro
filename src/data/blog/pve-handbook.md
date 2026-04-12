---
author: Posase
pubDatetime: 2023-04-08T07:53:10Z
title: "PVE 折腾手册"
draft: false
tags:
  - PVE
  - Linux
  - Linux运维
  - 学习笔记
description: "PVE 虚拟化平台折腾记录，包含 iKuai、Debian 等虚拟机的安装和配置"
---


## 安装 `iKuai`
1. 下载 `ISO` 镜像，[官方网址](https://www.ikuai8.com/component/download)
2. 上传镜像到 `PVE` 中（`pve - local(pve) - ISO镜像 - 上传`）
3. 安装镜像，创建虚拟机，后面基本一路 `next`，按官方要求分配硬件要求即可，比如 `CPU`、内存和硬盘大小
4. 建议把 `PVE` 管理口的桥接口设置为 `LAN` 口，这样既可以连 `iKuai`，也可以管理 `PVE`，多余网口根据需求自行设置

## 安装 `Debian`
1. 下载离线 `lxc` 模板，在线下载容易失败，这里选择离线的方式，[清华大学源](https://mirrors.tuna.tsinghua.edu.cn/proxmox/images/system/)
2. 上传镜像到 `PVE` 中（`pve - local(pve) - CT模板 - 上传`）
3. 安装镜像，创建 `CT`，后面根据需求自行创建
> Tips：可能因为 `IPv6` 无法获取的问题，`Debian` 无法开机，建议首次指定 `IPv4` 静态地址，`IPv6` 改为无状态

## 根目录磁盘过小，导致 Docker 撑爆磁盘导致宕机
> [迁移 `/var/lib/docker`](https://blog.csdn.net/weixin_36873225/article/details/138623750)

### 最后采取方案
使用一个大磁盘，挂载到 /var/lib/docker 目录，迁移对应文件即可

其他系统同理，只是挂载需要自己另外操作
```shell
systemctl stop docker
systemctl stop docker.socket

# 注意需要保证临时目录够大
mkdir /tmp # 迁移文件到临时目录
mv /var/lib/docker/* /tmp

# 这里去 PVE 控制台挂载一个磁盘到 /var/lib/docker
mv /tmp/* /var/lib/docker # 文件移动回去

systemctl start docker
```

## 想重装 `PVE` 时候遇到无法进入 `BIOS` 的情况
按理应该正常出现的 `BIOS` 界面是一直黑屏状态，用的是 `HDMI to Micro HDMI` + 便携屏幕
后面换成 `DP` + 正常的显示器可以正常显示

## `PVE` 设置脚本
`wget -q -O /root/pve_source.tar.gz 'https://bbs.x86pi.cn/file/topic/2023-11-28/file/01ac88d7d2b840cb88c15cb5e19d4305b2.gz' && tar zxvf /root/pve_source.tar.gz && /root/./pve_source`
> [来源](https://bbs.x86pi.cn/thread?topicId=20) 疑似 `lxc` 源有问题