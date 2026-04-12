---
author: Posase
pubDatetime: 2024-06-22T02:56:54Z
title: "「教程」自建 Docker 镜像加速服务"
featured: true
draft: false
tags:
  - Docker
  - Nginx
  - Cloudflare
  - 自建服务
  - 教程
description: "国内 Docker 镜像加速的四种方案对比：直接代理、CF Worker 反代、镜像转存和自建镜像服务"
---


## 前言

> **注意：本文内容具有时效性，各镜像加速方案的可用性可能随时变化，请以各项目最新状态为准。**

因不可抗力，国内访问 Docker 极其艰难，只能自立更生。
Docker 一键安装脚本：`bash <(curl -sSL https://linuxmirrors.cn/docker.sh)`

## 方案一：直接使用代理
[如何优雅的给 Docker 配置网络代理](https://zhuanlan.zhihu.com/p/678307663)

## 方案二：使用 Cloudflare Worker 反代
[cloudflare-docker-proxy](https://github.com/ciiiii/cloudflare-docker-proxy)
[基于 Cloudflare Workers 和 cloudflare-docker-proxy 搭建镜像加速服务](https://www.lixueduan.com/posts/docker/12-docker-mirror/)

## 方案三：镜像转存方案
[tech-shrimp/docker_image_pusher](https://github.com/tech-shrimp/docker_image_pusher)
[togettoyou/hub-mirror](https://github.com/togettoyou/hub-mirror)

## 方案四：自建 Docker 镜像
[dqzboy/Docker-Proxy](https://github.com/dqzboy/Docker-Proxy)
[bboysoulcn/registry-mirror](https://github.com/bboysoulcn/registry-mirror)

## Nginx 反代实现对应访问
```nginx
location / {
	proxy_pass https://registry-1.docker.io;  
	proxy_set_header Host registry-1.docker.io;
	proxy_set_header X-Real-IP $remote_addr;
	proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	proxy_set_header X-Forwarded-Proto $scheme;               
	proxy_buffering off;
	proxy_set_header Authorization $http_authorization;
	proxy_pass_header  Authorization;
	proxy_intercept_errors on;
	recursive_error_pages on;
	error_page 301 302 307 = @handle_redirect;
}
location @handle_redirect {
	resolver 1.1.1.1;
	set $saved_redirect_location '$upstream_http_location';
	proxy_pass $saved_redirect_location;
}
```

## 主观上的对比

| 方案 | 操作难度 | 下载速度 | 备注 |
| ---- | --- | --- | --- |
| 直接代理 | 简单 | 较快 | 缺点是每个机器要单独配置，另外部分机器无法配置代理 |
| CF Worker | 简单 | 较慢 | 部分地区无法正常连接 CF，白嫖要什么自行车 |
| 转存镜像 | 一般 | 一般 | 自建方案略复杂，每次需要转存一次也略麻烦 |
| 自建镜像 | 一般 | 未知 | 速度取决于机器带宽/线路，机器也就意味着要钱 |