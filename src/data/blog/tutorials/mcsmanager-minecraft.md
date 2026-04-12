---
author: Posase
pubDatetime: 2024-06-22T02:56:18Z
modDatetime: 2024-08-11T06:31:00Z
title: "MCSManager + MCDReforged 搭建 Minecraft 服务器"
featured: true
draft: false
tags:
  - Minecraft
  - MCSManager
  - Docker
  - 自建服务
  - 教程
description: "Docker 部署 MCSManager 面板搭建 Minecraft 服务器，集成 MCDReforged 增强管理和推荐插件"
---


## 前言
1. 准备好 `Docker` 环境，本文是基于 `Docker` 搭建

> 关联文章：[「教程」自建 Docker 镜像加速服务](https://www.posase.im/posts/8b44856f/)

## 安装

> 官网可能变更方式，最新安装方式详见[官网](https://docs.mcsmanager.com/zh_cn/)

```bash
# 拉取镜像，在中国的服务器需要自己配置加速镜像源
docker pull githubyumao/mcsmanager-daemon:latest
docker pull githubyumao/mcsmanager-web:latest

# 注意：下列命令中，所有的 `${CHANGE_ME_TO_INSTALL_PATH}`
# 需要替换为你实际数据存储的位置，该位置需要被持久化

# 启动 MCSManager 守护进程端
docker run -v /etc/localtime:/etc/localtime:ro  \
-v ${CHANGE_ME_TO_INSTALL_PATH}/daemon/data:/opt/mcsmanager/daemon/data \
-v ${CHANGE_ME_TO_INSTALL_PATH}/daemon/logs:/opt/mcsmanager/daemon/logs \
-v /var/run/docker.sock:/var/run/docker.sock \
-e MCSM_DOCKER_WORKSPACE_PATH=${CHANGE_ME_TO_INSTALL_PATH}/daemon/data/InstanceData \
-p 24444:24444 \
--name mcsmanager-daemon \
-d githubyumao/mcsmanager-daemon:latest


# 启动 MCSManager Web 端
docker run \
-v /etc/localtime:/etc/localtime:ro \
-v ${CHANGE_ME_TO_INSTALL_PATH}/web/data:/opt/mcsmanager/web/data \
-v ${CHANGE_ME_TO_INSTALL_PATH}/web/logs:/opt/mcsmanager/web/logs \
-p 23333:23333 \
--name mcsmanager-web \
-d githubyumao/mcsmanager-web:latest
```

### Nginx 反代
这里只写了 `Nginx Proxy Manager` 需要填的高级配置
如果使用 `Nginx`，直接抄官方文档即可
> 注意修改配置里面的 `IP` 和端口

```nginx
# web 反代高级设置
client_max_body_size 0;
```

```nginx
# daemon 高级设置
client_max_body_size 0;
```

> 关联文章：[「教程」Nginx Proxy Manager 的简单使用](https://www.posase.im/posts/346b1fc8/)


## 相关配置
> 使用你的 `http(s)://ip:23333` 或 `http(s)://域名:23333` 访问面板，第一次进入会提示设置管理员账号密码
> 后面所有 `ip` 都可以是域名，`http` 可能是 `https` 取决于你的配置，不再赘述

### 配置节点信息

#### 查看守护进程密钥
可以先访问 `http://ip:24444`，如果显示 `[MCSManager Daemon] Status: OK | reference: https://mcsmanager.com/`

说明 `daemon` 运行正常，可以通过 `docker logs mcsmanager-daemon` 获取守护进程的密钥

#### 确认节点正常连接
节点地址是使用 `websocket` 连接，所以是 `ws://ip` 或 `wss://ip`，取决于你是否使用了 `https`
如果节点信息显示正常则说明没问题了，否则请检查填写配置和密钥是否正确

## Minecraft 开服
首先需要准备好开服包，可能是一个 `jar` 文件或者一个整合包的服务端

### 使用压缩包 + Docker 开服
1. 构建镜像，一般开服包都会有建议的 `openjdk` 版本，去节点镜像列表里面添加好对应版本的镜像
2. 新建实例，选择压缩包开服即可，遇到的所有编码都选择 `utf-8`
3. 设置启动命令，可以使用命令助手
4. 使用容器化，选择合适的 `jdk` 镜像
5. 设置开放端口
6. 进入文件管理，解压服务端压缩包，注意 jar 文件需要在根目录，开服

## 联机
- 云服务器，只需要使用 `ip:port` 即可连接
- 个人物理机开服，有公网可以直接连接，否则需要内网穿透（比如 FRP 等）

## 使用 MCDReforged 增强管理

### 准备工作
1. 根据游戏版本拉取合适的[镜像](https://github.com/MCDReforged/docker)
2. 准备好服务器文件，这里推荐一个服务端
	- [Mohist - Forge + Bukkit/Spigot 服务器](https://mohistmc.com/downloadSoftware?project=mohist)
3. 同样建议先初始化（运行一次）好服务端文件，因为会遇到下载等代理问题

### 开服
> 与上面开服步骤类似，但是多了几步
1. 直接选择容器镜像开服，先别上传任何文件
2. 应用实例设置 - 基础设置 - 启动命令 设置为 `mcdreforged init`
3. 设置容器化，选择准备好的 `MCDR` 镜像，设置开服端口，打开**更改容器默认工作目录**
4. **先运行一次**，会马上退出，此时进入文件管理，会发现多了一些文件夹。
6. 将服务端文件移动到 `/server` 中，修改 `/config.yaml`
  - `language`: zh_cn
  - `start_command`: 视情况设置，如：`java -Xmx xG server.jar nogui` 或 `bash start.sh`
  - 通用指令：`java -Duser.language=zh -Duser.country=CN -Dfile.encoding=UTF-8 -Xms2G -Xmx8G -jar server.jar nogui`
7. 修改启动命令为 `mcdreforged`，再次开服即可
8. 终端设置 - 关闭实例指令修改为 `!!MCDR server stop_exit`
9. 应用实例设置 - 容器化
    - 需要开放端口 `25565 25565 tcp`
    - 如果需要日志显示时间正常，需要修改时区，添加环境变量 `TZ Asia/Shanghai`

注意因为服务器文件在 `/server` 目录下，导致面板自带的 `服务器配置文件` 功能无法使用
更多关于 `MCDR` 及其插件的使用请参考[官方网站](https://mcdreforged.com/zh-CN/plugins)，下面是一些推荐插件

> 绝大多数报错可能是中文、代理、`jdk` 版本导致的，一般本地运行没问题后续都可能是这些原因导致的

## 推荐插件和 `MOD`

- 强大的备份插件：[`Prime Backup`](https://mcdreforged.com/zh-CN/plugin/prime_backup)
    - 备份报错遇到文件不存在的情况，可以尝试打开 `creation_skip_missing_file` 配置
- 高级版灵魂出窍：[`Gamemode`](https://mcdreforged.com/zh-CN/plugin/gamemode)
    - 前置插件 [`Minecraft Data API`](https://mcdreforged.com/zh-CN/plugin/minecraft_data_api)
- 权限管理 [`LuckPerms`](https://www.mcmod.cn/class/5192.html)


## 相关链接
- [MCSManager](https://mcsmanager.com/)
- [原版服推荐：MohistMC](https://mohistmc.com/)
- [MCDReforged](https://mcdreforged.com/zh-CN)
