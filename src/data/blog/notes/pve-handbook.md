---
author: Posase
pubDatetime: 2023-04-08T07:53:10Z
modDatetime: 2026-04-12T00:00:00Z
title: "PVE 虚拟化平台配置笔记"
draft: false
tags:
  - PVE
  - Linux
  - Linux运维
  - 学习笔记
description: "PVE 虚拟化平台使用笔记，涵盖虚拟机安装、磁盘管理、ESXi 配置和常见问题处理"
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

## ESXi 相关

### VMFSL 分区占用问题

安装 ESXi 时会出现倒数 5 秒的界面，按下 `Shift + O` 输入以下内容回车即可限制 VMFSL 分区大小：

```bash
autoPartitionOSDataSize=51200
```

> 单位为 MB，上述示例为 50 GB

### 精简置备和厚置备

- **精简置备**：使用多少分配多少，占用空间根据使用情况决定，最大占用空间略大于设置值。设置的是系统内最大使用空间而非真实占用空间，需要定期回收空间
- **厚置备**：分配多少用多少，一开始就把空间全部占用，最大使用空间等于设置值
  - **延迟置零**：在使用时写入 0
  - **置零**：在创建时就写入 0

### 安装 Debian 11 显示硬件架构问题

在 ESXi 上安装 Debian 11 时，如果选择了 163 镜像源可能会遇到硬件架构问题。解决方法是换用 [中科大源](http://mirrors.ustc.edu.cn/)。

### 安装 OpenWrt

1. `img` 镜像需要转换为 `vmdk` 格式
2. 在添加硬盘的地方选择转换后的镜像文件
3. 修改引导方式：`EFI` → `BIOS`

### SSH 连接问题

#### 允许 root 登录

修改 `/etc/ssh/sshd_config`，设置 `PermitRootLogin yes`，然后重启 SSH 服务。

#### 远程主机标识变更

当重装系统或更换主机后，SSH 连接可能报错 `REMOTE HOST IDENTIFICATION HAS CHANGED`，使用以下命令清除旧的 host key：

```bash
ssh-keygen -R xx.xx.xx.xx
```

清除后重新连接即可。