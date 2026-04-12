---
author: Posase
pubDatetime: 2022-01-18T09:46:00Z
modDatetime: 2022-10-01T03:20:01Z
title: "「工具」Scoop - Windows 包管理器工具"
draft: false
tags:
  - Windows
  - Scoop
  - 开发工具
description: "Windows 下使用 Scoop 管理开发工具，包含 aria2 加速下载、第三方 Bucket 和常见问题处理"
---


## 准备

> **注意：文中部分第三方 Bucket 源（如 fastgit）可能已失效，建议使用官方源或自行搜索可用镜像。**

因为 `GitHub` 的服务器在国外，所以经常会连不上的情况。
你能看到这里，说明能连进来，或者你拥有魔法工具，可以跳过这里。
如果你不知道上面说的什么，或者不知道怎么来加速访问 `GitHub`，
可以使用一些小工具来达到对应的目的，这里推荐几个（点击工具跳转下载页面）

- [`steamcommunity 302`](https://www.dogfight360.com/blog/686/)
- [`UsbEam Hosts Editor`](https://www.dogfight360.com/blog/475/)
- [`Steam++`](https://steampp.net/)

> `Steam++` 功能比较多，占用稍微大一点，如果没有特殊需求，使用 `steamcommunity 302` 即可

## 安装

```powershell
# 如果不想安装在 C 盘用户文件夹下，可以先设置环境变量，就会安装到设置的位置了
$env:SCOOP='D:\Scoop'
[Environment]::SetEnvironmentVariable('SCOOP',$env:SCOOP,'User')
$env:SCOOP_GLOBAL='D:\ScoopGlobalApps'
[Environment]::SetEnvironmentVariable('SCOOP_GLOBAL',$env:SCOOP_GLOBAL,'User')
# 请使用 PowerShell 运行以下命令
iwr -useb get.scoop.sh | iex
# 如果出现错误，需要修改运行策略，先运行以下命令
Set-ExecutionPolicy RemoteSigned -scope CurrentUser
```

> 请保证连接 `GitHub` 的流畅性，遇到连接失败等问题，请看上一步
> 官网提示：确保已安装 `PowerShell 5` 及以上版本 (包括 `PowerShell Core`) 和 `.NET Framework 4.5`

## 使用

### 常用命令
**格式** `scoop <cmd> (<param>)`
```powershell
scoop checkup             # 检测当前环境的问题

scoop help                # 查看帮助
scoop help <cmd>          # 查看某个命令的帮助

scoop list                # 查看已经安装的 App
scoop search <app>        # 查找一个应用
scoop status              # 查看哪些需要更新
scoop install <app>       # 安装 App
scoop uninstall <app>     # 卸载 App

scoop update              # 更新 scoop
scoop update <app>        # 更新某个 App
scoop update *            # 更新所有 App
scoop hold <app>          # 禁止更新
scoop unhold <app>        # 允许更新

scoop bucket known        # 查看已知所有 bucket
scoop bucket add <bucket> # 添加 bucket

scoop cache show          # 查看所有缓存
scoop cache rm <app>      # 移除某个 App 缓存
scoop cache rm *          # 移除所有缓存

scoop cleanup <app>        # 清理旧版本
scoop cleanup <app> -g     # 清理旧版本(全局安装的)
scoop cleanup <app> -k     # 清理下载缓存

scoop alias list -v        # 查看已添加别名
scoop alias add <name> <cmd> <desc> # 添加别名
# 示例
# scoop alias add rm 'scoop uninstall $args[0]' '卸载 App'
# scoop rm git

scoop info <app>            # 查看 App 信息
scoop home <app>            # 打开 App 官网
scoop reset <app>@<version> # 切换 App 版本

```

### 使用 `aria2` 加速下载
```bash
# 安装 aria2 并启用 16 线程
scoop install aria2
scoop config aria2-max-connection-per-server 16
scoop config aria2-split 16
scoop config aria2-min-split-size 1M

# 断点续传
scoop update <app>
# 找到 --input-file='xxx'
aria2c.exe --input-file='xxx' # 断点续传
scoop update <app>        # 下载完后重新更新
```

### 添加第三方 `Bucket` 
```bash
scoop bucket add <bucket> <bucketurl> # 添加 Bucket
scoop install <bucket>/<app>          # 安装指定 Bucket 中的 App

# 请保证安装了 Git
scoop install git
# 推荐使用国内源
scoop bucket rm main
# gitee 源
scoop bucket add main 'https://gitee.com/scoop-bucket/main'
scoop bucket add extras 'https://gitee.com/scoop-bucket/extras'

# fastgit 源
scoop bucket add main 'https://hub.fgit.ml/ScoopInstaller/Main'
scoop bucket add extras 'https://hub.fgit.ml/ScoopInstaller/scoop-extras'
scoop bucket add versions 'https://hub.fgit.ml/ScoopInstaller/Versions'
scoop bucket add jetbrains 'https://hub.fgit.ml/Ash258/Scoop-JetBrains'
scoop bucket add java 'https://hub.fgit.ml/ScoopInstaller/Java'
scoop bucket add dorado 'https://hub.fgit.ml/chawyehsu/dorado'
scoop bucket add scoopet 'https://hub.fgit.ml/ivaquero/scoopet'
``` 

> 更多请参考 [fastgit](http://fgit.ml/)

## 其他问题 

### 安装旧版本 `MySQL`
```powershell
# 建议使用 versions 库
scoop bucket add versions
scoop install mysql56

# 按照提示输入命令添加对应服务
# 然后启动 MySQL
net start mysql
mysql -uroot -p
```

### 安装旧版本 `tortoisesvn`

```powershell
scoop install tortoisesvn@1.9.7.27907
# 报错如下
# Autoupdating tortoisesvn
# Downloading TortoiseSVN-1.9.7.27907-win32-svn-$matchSvn.msi to compute hashes!
# 远程服务器返回错误: (404) 未找到。
# URL https://osdn.mirror.constant.com//storage/g/t/to/tortoisesvn/1.9.7/Application/TortoiseSVN-1.9.7.27907-win32-svn-$matchSvn.msi is not valid
# Could not install tortoisesvn@1.9.7.27907

# 可以看出是匹配的文件名有问题 点开网页查看正确的文件名 TortoiseSVN-1.9.7.27907-x64-svn-1.9.7.msi
# 修改 Scoop\buckets\extras\bucket\tortoisesvn.json
# 搜索 $matchSvn 修改为对应版本号即可，最后下载完改回去
# 再次运行成功 按照提示可以添加右键菜单选项
```