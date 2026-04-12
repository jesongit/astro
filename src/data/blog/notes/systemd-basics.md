---
author: Posase
pubDatetime: 2022-01-18T09:46:00Z
modDatetime: 2022-04-04T04:31:37Z
title: "Systemd 基础入门"
draft: false
tags:
  - Linux
  - Systemd
  - Linux运维
  - 学习笔记
description: "Systemd 基础命令速查，包含 systemctl 服务管理和常用操作"
---


## 常用命令

### `systemctl`
- 启动服务：`systemctl start service`
- 停止服务：`systemctl stop service`
- 重启服务：`systemctl restart service`
- 重载服务：`systemctl reload service`
- 禁止启动：`systemctl mask service`
- 查看状态：`systemctl status service`
- 开机自启：`systemctl enable service`
- 关闭自启：`systemctl disable service`
- 是否自启：`systemctl is-enabled service`
- 取消禁止：`systemctl unmask service`
- 是否激活：`systemctl is-active service`
- 查看依赖：`systemctl list-dependencies service`
- 查看所有：`systemctl list-units`
- 重载配置：`systemctl daemon-reload`

### `journalctl`
- 查看日志：`journalctl -u service`

### 示例
```bash
# 查看所有 frp 服务
systemctl list-units --all frpc@*
```

## 配置文件位置

- 软件包配置位置：
    - `/lib/systemd/system`
    - `/run/systemd/system`
- 用户配置位置：
    - `/etc/systemd/system`
    - `/usr/lib/systemd/system`

## 配置文件

```bash
[Unit]
Description=HTTP Server     # 描述 下方的模块都可以多行使用
Requires=docker.socket      # 依赖 会先启动依赖，都成功后启动
Wants=remote-fs.target      # 会先启动，但不理会是否启动成功
After=network.target        # 前置服务 只有这些启动完后才会启动
Before=early-docker.tar     # 后置服务 当前应用启动后才可以启动的
BindsTo=xxx                 # 与 Requires 类似，会列出来，并且会因为任意一个终止、重启而重启
PartOf=xx                   # 列出任意模块失败或重启时重启当前服务,但是不会随服务启动
OnFailure=xx                # 当服务启动失败，自动启动以下服务
Conflicts=xx                # 有冲突的模块，其中有运行的则不能启动
Documentation=man:httpd(8)  # 文档URL

[Service]
Type=notify                 # 服务类型 simple(default) | forking(适用于fork创建子进程的情况)
RemainAfterExit=false       # 当配置 true 时，systemd 只会启动服务，即便退出了也认为在运行 false(default) | true
ExecStartPre=/usr/sbin/xxx  # 执行启动命令前的前置命令 可以有多个
ExecStart=/usr/sbin/httpd   # 服务启动命令 只能有一个
ExecStatPost=xxx            # 后置命令，也可以多个
TimeoutStartSec=0           # 启动服务的等待秒数，如果规定时间内未执行完则认为启动失败 # 设置为 0 则关闭检测
ExecStop=/bin/kill -WINCH   # 服务停止命令
ExecStopPost=xx
TimeStopSec=0               # 超时会强杀进程
Restart=no                  # 指定什么时候重启进程
# Reason     no  always  on-failure  on-abnormal  on-abort  on-success
# 正常退出          v                                           v
# 异常退出          v       v
# 超时退出          v       v               v
# 被异常KILL        v       v               v           v
RestartSec=1                # 重启前等待时间
ExecReload=/usr/sbin/httpd  # 重载命令
Environment=X=1             # 添加环境变量
EnvironmentFile=xx          # 添加环境变量文件，每一行都是环境变量的定义
Nice=0                      # 进程优先级 越小越高 [-20, 19] 0(default)
WorkingDirectory=/          # 指定工作目录
RootDirectory=/             # 指定服务进程根目录，指定后无法访问指定以外的目录
User=root                   # 指定运行服务的用户，影响服务的访问权限
Group=root                  # 指定用户组，影响访问权限

[Install]
WantedBy=multi-user.target  # 依赖当前服务的模块 与 Wants 类似
RequiredBy=x                # 依赖当前服务的模块 与 Requries 类似
Also=x                      # 当这个服务被 enable/disable 自动修改以下模块
```

> 修改或添加 `Unit` 后需要重新载入配置 `systemctl daemon-reload`

## Unit 模板
使用 `servicename@.service`来建立一个模板
使用 `systemctl start servicename@param.service` 来启动一个实例
使用占位符来使用参数

| 占位符 | 作用 |
| --- | --- |
| %n | 完整的 Unit 文件名 |
| %m | 实际运行节点的 Machine ID, 适合用来做 Etcd 路径的一部分，如：/machines/%m/units|
| %b | 有点像 Machine ID，但这个值每次节点重启都会改变，称为 Boot ID |
| %H | 运行节点的主机名 |
| %p | 文件名 @ 之前的部分 |
| %p | 文件名 @ 和 . 之间的部分 |