---
author: Posase
pubDatetime: 2024-01-29T10:51:52Z
title: "「教程」Nginx Proxy Manager 的简单使用"
draft: false
tags:
  - Nginx
  - Docker
  - Linux
  - 教程
description: "Docker 部署 Nginx Proxy Manager 反向代理，解决跨网络容器访问和常见问题"
---


## 安装
```bash
mkdir -p ~/npm && cd ~/npm
echo "version: '3.8'
services:
  app:
    container_name: npm # 这里设置容器名，方便后面加入网络
    image: 'jc21/nginx-proxy-manager:latest'
    restart: unless-stopped
    ports:
      - '80:80'
      - '81:81'
      - '443:443'
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt" > docker-compose.yml
docker-compose up -d
```

## 运行
浏览器输入 `http://<ip>:81` 即可访问。

默认用户名密码为 `admin@example.com` 和 `changeme`

第一次进入会要求重新设置管理员用户名、昵称、邮箱、密码

## 配置
配置都比较简单，直接根据描述配置即可

因为是在 `docker` 中运行，可能存在无法访问其他网络中容器的情况

这里简单举例如何配置不同网络的情况
 - 计算机内网 IP：`192.168.1.100`（物理机器内网地址）
 - docker0：`10.1.2.1`（bridge 模式默认网络）
 - npm_default：`172.29.0.1`（Nginx Proxy Manager 默认网络）
 - other_default：`172.29.24.1`（其他自定义网络）

| 网络模式 | 应该填写的 IP |
| --- | --- |
| `host` | `192.168.1.100` |
| `bridge` | `10.1.2.1` |
| `npm_default` | `172.29.0.1` |
| `other_default` | `172.29.24.1` |

其中除了 `host` `nginx_default`，其他网络可能无法直接访问

可以使用 `docker network connect <other_default> npm` 将该服务添加到指定网络中

添加后就可以正常访问了，注意端口都需要填导出端口
如果填服务的内网地址 + 端口，重启会导致 IP 变化，无法正常访问

一般情况下使用 `docker run --name test_name --network npm_default xxxx`

即可屏蔽外部访问 + 接入 npm 网络，然后 npm 中直接配置 `test_name:port` 即可反代服务

```yaml
# 如果是 docker-compose.yml 参考下面这个
version: '3.4'
services:
  new-api:
    image: calciumion/new-api:latest
    container_name: new-api
    networks:  # 接入 npm_default
      - npm_default

# 声明外部网络 npm_default（需确保该网络已存在）
networks:
  npm_default:
    external: true  # 表示该网络是预先创建的外部网络，而非由当前compose创建
```
 
## 其他问题
1. `Bad Gateway` 无法登录的问题
查询 `Issues` 发现，大部分是遇到数据库文件权限问题
    - 修改 `./data/mysql` 为 `./mysql`
    - `chmod 777 database.sqlite`

还有一种就是观察日志是否卡在 `Fetching https://ip-ranges.amazonaws.com/ip-ranges.json`

这种情况可能是国内访问的网络问题，修改 `/etc/docker/daemon.json` 添加对应 `dns` 示例如下
```json
{
  "registry-mirrors": ["https://dockerproxy.net"],
  "dns":[
      "114.114.114.114",
      "8.8.8.8"
  ]
}
```

## 高级设置
配置过的，仅供参考
```nginx
    proxy_pass http://10.0.3.1:3002;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
location /cgi-bin/gettoken {
    proxy_pass https://qyapi.weixin.qq.com;
}
location /cgi-bin/message/send {
    proxy_pass https://qyapi.weixin.qq.com;
}
location  /cgi-bin/menu/create {
    proxy_pass https://qyapi.weixin.qq.com;
}
```

## 参考
 - [Nginx Proxy Manager - GitHub](https://github.com/NginxProxyManager/nginx-proxy-manager)

