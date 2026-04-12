---
author: Posase
pubDatetime: 2024-05-17T18:59:06Z
title: "「教程」使用 Docker 搭建 Hysteria2"
draft: false
tags:
  - Docker
  - Hysteria2
  - 网络与代理
  - 教程
description: "Docker 部署 Hysteria2 代理服务的最简配置，包含 ACME 证书和 Clash 客户端配置"
---


## 安装 Docker
```shell
# 使用官方一键安装命令
curl -sSL https://get.docker.com/ | sh
```

## 配置
详细参考[Hysteria2 官方文档](https://hysteria.network/zh/docs/getting-started/Installation/)
```yaml
# docker-compose.yaml
version: "3.9"
services:
  hysteria:
    image: tobyxdd/hysteria
    container_name: hysteria
    restart: always
    network_mode: "host"
    volumes:
      - acme:/acme
      - ./hysteria.yaml:/etc/hysteria.yaml
    command: ["server", "-c", "/etc/hysteria.yaml"]
volumes:
  acme:
```

```yaml
# hysteria.yaml
listen: :50443                  # 自定义监听端口，不填默认443

acme:
  domains:
    - test.example.com          # 指向服务器的域名
  email: test@qq.com

auth:
  type: password
  password: 123456              # 注意改复杂密码

masquerade:                     # 下面的可以不需要
  type: proxy
  proxy:
    url: https://www.baidu.com  # 伪装网站
    rewriteHost: true
```
> 只演示最简配置，详情请查看官方文档

## 运行
```shell
docker-compose up -d
docker logs hysteria # 查看日志是否运行成功
```

## Clash 配置
```yaml
# clash.yaml
proxies:
  - name: hysteria
    type: hysteria
    server: test.example.com
    port: 50443
    password: 123456
    up: 100         # 这两项建议用 speedtest.cn 测速的值来填
    down: 1000
```

## 一键安装脚本
```shell
# 根据上述操作写的一个脚本，可能有错，自行修改
curl -O https://raw.githubusercontent.com/jesongit/script/main/linux/hy2.sh && bash hy2.sh
```

## 参考
- [Hysteria2 官方文档](https://hysteria.network/zh/docs/getting-started/Installation/)