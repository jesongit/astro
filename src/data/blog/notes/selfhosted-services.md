---
author: Posase
pubDatetime: 2024-06-22T07:33:47Z
title: "自建服务推荐清单"
featured: true
draft: false
tags:
  - NAS
  - Docker
  - Linux
  - 自建服务
  - 学习笔记
description: "自建服务推荐清单，涵盖影音、下载、网盘、监控等常用开源项目汇总"
---


## 自建服务

| 分类 | 名称 | 网址 | 备注 |
| --- | --- | --- | --- |
| 影音 | Jellyfin | https://jellyfin.org/ | 开源家庭影院 |
| 影音 | Emby | https://emby.media/ | 开源付费制家庭影院 |
| 影音 | Plex | https://www.plex.tv/ | 收费家庭影院 |
| 影音 | MoviePilot | https://wiki.movie-pilot.org/ | NAS 媒体库管理工具<br/>[一些教程](https://github.com/DDS-Derek/MoviePilot/tree/docs) |
| 相册 | Immich | https://immich.app/ | 开源家庭相册 |
| 存储 | Nextcloud | https://nextcloud.com/ | 开源云盘 |
| 存储 | **AList** | https://alist.nn.ci/ | 支持多种存储的文件列表程序 |
| 音乐 | Navidrome | https://www.navidrome.org/ | 音乐播放器 |
| 音乐 | Lrcapi | https://docs.lrc.cx/ | 歌词 API |
| 种子 | Transmission | https://transmissionbt.com/ | 开源种子下载器 |
| 种子 | qBittorrent | https://www.qbittorrent.org/ | 开源种子下载器 |
| 游戏 | MCSManager | https://mcsmanager.com/ | 非常方便的 MC 管理面板 |
| 游戏 | MCDReforged | https://mcdreforged.com/zh-CN | 强大的非侵入式 MC 管理工具<br/>[插件仓库](https://mcdreforged.com/zh-CN/plugins) |
| 其他 | **DDNS-Go** | https://github.com/jeessy2/ddns-go | DDNS 服务 |
| 其他 | **Nginx Proxy Manager** | https://github.com/NginxProxyManager/nginx-proxy-manager | 快捷方便的 Nginx 面板 |
| 其他 | Vaultwarden | https://github.com/dani-garcia/vaultwarden | 密码管理器 Bitwarden 开源版 |
| 其他 | 青龙面板 | https://github.com/whyour/qinglong | 开源定时任务管理面板<br/>[Faker库](https://t.me/scriptalking) |
| 其他 | Portainer | https://www.portainer.io/ | 容器管理面板 |
| 其他 | Frp | https://gofrp.org/zh-cn/ | 简单易用的内网穿透工具 |
| 其他 | Syncthing | https://github.com/syncthing/syncthing | 开源跨平台同步方案 |
| 其他 | Next Terminal | https://next-terminal.typesafe.cn/docs/ | 开源交互审计系统 |

## 工具

| 分类 | 名称 | 网址 | 备注 |
| --- | --- | --- | --- |
| 影音 | Kodi | https://kodi.tv/ | 多平台播放工具 |
| 游戏 | MohistMC | https://mohistmc.com/ | 推荐原版开服包 |
| 其他 | MusicBrainz | https://musicbrainz.org/ | 音乐元数据数据库 |
| 音乐 | MusicBrainz Picard | https://picard.musicbrainz.org/ | 音乐标签填充神器 |
| 音乐 | 音乐标签 | https://www.cnblogs.com/vinlxc/p/11347744.html | 音乐繁体转简体+歌词查找 |

## 异星探险者（Astroneer）服务器

- 服务器配置中，公网 IP 填写正常连接的公网 IP（比如提供内网穿透的服务器）
- 默认端口是 7777 并且使用 UDP 连接，搭内网穿透时需要注意，另外记得打开防火墙
- 官方启动器非常难用，没有任何日志和界面，推荐 [AstroLauncher](https://github.com/ricky-davis/AstroLauncher)

