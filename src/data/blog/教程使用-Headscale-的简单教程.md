---
author: Posase
pubDatetime: 2022-04-14T02:57:28Z
title: "「教程」使用 Headscale 的简单教程"
featured: true
draft: false
tags:
  - Headscale
  - Tailscale
  - 网络与代理
  - 教程
description: "从零搭建 Headscale 服务端，配置 Tailscale 客户端组网，包含 DERP 中继、子网路由和 Docker 部署"
---


> **注意：内容具有时效性，命令格式在新版本中可能有变化，一切以[官方文档](https://github.com/juanfont/headscale/blob/main/docs)为准。**

## 讲在前面

`Headscale` 是 `Tailscale` 的开源版本，前者的免费使用有一定的限制，当然也能满足一般的需求。
如果你不想折腾，也没有太多的需求，`Tailscale` 或许是更好的选择。
另外这也是一篇基础教程，更多的使用请阅读官方文档。

## 服务端

首先肯定需要把服务跑起来，只有一个要求，就是**有公网 IP**
另外推荐使用 `Linux` 部署服务，`Windows` 的话可以试试 [`Docker` 部署](https://github.com/juanfont/headscale/blob/main/docs/running-headscale-container.md)
文章服务端环境：`Debian 11` 腾讯云轻量应用服务器

### 一些准备工作

准备好一个域名，`SSL` 证书（可选）

```bash
# 1. 下载二进制文件
# 注意替换版本号和硬件架构
wget --output-document=/usr/local/bin/headscale \
   https://github.com/juanfont/headscale/releases/download/v0/headscale_0_linux_amd64
# 这里其实就是下载文件到 /usr/local/bin/headscale 目录
# 所以你也可以自己下载好文件，自己上传上去，比如你的服务器连接 GitHub 困难的话

# 2. 添加执行权限
chmod +x /usr/local/bin/headscale

# 3. 准备一个目录放配置文件
mkdir -p /etc/headscale

# 4. 准备一个目录放数据库和其他文件
mkdir -p /var/lib/headscale

# 5. 创建数据库文件
touch /var/lib/headscale/db.sqlite

# 6. 创建配置文件
touch /etc/headscale/config.yaml
# 因为强烈建议使用示例文件进行修改，我们也可以直接下载该文件到 /etc/headscale
wget --output-document=/etc/headscale/config.yaml \
    https://github.com/juanfont/headscale/raw/main/config-example.yaml
# 当然也可以复制我下面的配置修改后上传
```

### 修改配置文件

```yaml
# From: www.posase.im
# Author: Posase
# headscale 会查看 /etc/headscale/ 或者 ~/.headscale/ 下的 config.yaml 或 config.json
# 建议/必须修改的地方加* 端口都可以自行修改 部分内容来自机翻
# 移动了官方配置的部分位置，带问号的可能存疑，仅供参考，善用搜索

# Headscale Config
server_url: http://test.domain.com:8080 # *客户端连接地址 替换为自己域名
listen_addr: 0.0.0.0:8080               # 监听地址
metrics_listen_addr: 127.0.0.1:9090     # 监听 /metrics 的地址，希望将此端点保密到内部网络
grpc_listen_addr: 0.0.0.0:50443         # 监听 gRPC 地址 gRPC 用于 远程控制 headscale
grpc_allow_insecure: false              # 允许在 INSECURE 模式下使用 gRPC 后台 不建议开启
private_key_path: /var/lib/headscale/private.key # 加密流量的私钥文件，会自动生成
ip_prefixes:                            # 用来分配 IP 地址的前缀
  - fd7a:115c:a1e0::/48
  - 100.64.0.0/10

# 其他设置
disable_check_updates: false            # 开启时自动检查更新
ephemeral_node_inactivity_timeout: 30m  # 离线节点过多久删除
log_level: info                         # 日志等级
acl_policy_path: ""                     # ACL 策略路径 https://tailscale.com/kb/1018/acls/

unix_socket: /var/run/headscale.sock    # 用于 CLI 连接， 无需验证的 socket
unix_socket_permission: "0770"

# DERP Config
# DERP 中继服务器配置，当无法直接进行打洞，可以通过 中继服务器 转发流量连接
# https://tailscale.com/blog/how-tailscale-works/#encrypted-tcp-relays-derp
derp:
  # 本地 DERP 配置
  server:
    enabled: true   # *本机 DERP 开关，server_url 必须是 https 且 有 ssl 证书
    region_id: 999  # 本机 DERP 服务的 地区id， 这个对于每一个 DERP 服务器来说是唯一的
    region_code: "headscale"                # 区域代码 这两个参数可以自定义
    region_name: "Headscale Embedded DERP"  # 区域名字
    stun_listen_addr: "0.0.0.0:3478"        # 监听需要转发的 UDP

  # 外部 DERP 服务器配置 yaml 的列表形式
  # key
  #   - xxxxx
  # key: [xxx, xxx] 这样应该也可以吧？
  urls: []
  #  - https://controlplane.tailscale.com/derpmap/default # *不建议使用，国外节点很卡
  paths: []
  #  - /etc/headscale/derp-example.yaml

  # DERP 其他配置
  auto_update_enabled: true # 定时更新中继服务器
  update_frequency: 24h     # 更新间隔

# 数据库配置
# SQLite config
db_type: sqlite3
db_path: /var/lib/headscale/db.sqlite

# # Postgres config
# db_type: postgres
# db_host: localhost
# db_port: 5432
# db_name: headscale
# db_user: foo
# db_pass: bar

# TLS configuration
# 会自动使用 Let's Encrypt 申请证书
acme_url: https://acme-v02.api.letsencrypt.org/directory    # 申请脚本目录
acme_email: "xxx@mail.com"                                  # 注册邮箱
tls_letsencrypt_hostname: "test.domain.com"                 # 申请的域名
# 客户端认证模式 disabled：不需要认证，relaxed：需要证书但不验证，enforced：需要证书且认证
tls_client_auth_mode: disabled                              
tls_letsencrypt_cache_dir: /var/lib/headscale/cache         # 证书存放目录
# ACME 类型 More: https://github.com/juanfont/headscale/blob/main/docs/tls.md
tls_letsencrypt_challenge_type: HTTP-01                     
# 如果选择 HTTP-01 需要一个验证端口 :http=port 80
tls_letsencrypt_listen: ":http"                             

# 已经有证书了 添加自定义证书路径
tls_key_path: "/var/lib/headscale/cache/key.pem"
tls_cert_path: "/var/lib/headscale/cache/cert.pem"

## DNS Config
# 查看知识库以更好的理解这个功能
# - https://tailscale.com/kb/1054/dns/
# - https://tailscale.com/kb/1081/magicdns/
# - https://tailscale.com/blog/2021-09-private-dns-with-magicdns/
dns_config:
  nameservers:  # 向客户端公开的 DNS 列表 https://tailscale.com/kb/1054/dns/
    - 1.1.1.1

  # 每个域名使用不同的 DNS
  # restricted_nameservers:
  #   foo.bar.com:
  #     - 1.1.1.1
  #   darp.headscale.net:
  #     - 1.1.1.1
  #     - 8.8.8.8

  domains: []               # 需要使用 DNS 的域名?
  magic_dns: false          # *使用 MagicDns https://tailscale.com/kb/1081/magicdns/
  base_domain: example.com  # 定义基础域名以创建 MagicDns 主机名
```

### 启动

```bash

# 启动 服务
headscale serve

# 本地检测 需要另一个窗口
curl http://127.0.0.1:9090/metrics

# 成功的话 创建一个命名空间
headscale namespaces create myfirstnamespace
```

> **注意需要将服务器端口加入防火墙规则**

## 连接服务器

需要先下载 `Tailscale` [下载地址](https://tailscale.com/download/)  

```bash
# Windows 需要添加环境变量 或者到安装目录下使用
# 有两种注册连接方式

# 1. 正常注册
# 客户端：替换为服务器的 server_url 
# 这里推荐关闭 dns，有需求可以自己研究
tailscale up --login-server YOUR_HEADSCALE_URL --accept-dns=false

# 服务器：将返回的 key 在服务器中注册
headscale --namespace myfirstnamespace nodes register --key <YOU_+MACHINE_KEY>

# 2. 预注册
# 服务器：生成一个指定命名空间下可重复使用 24H 过期的 key
headscale --namespace myfirstnamespace \
    preauthkeys create --reusable --expiration 24h

# 客户端： 使用生成的 key 可以直接注册连接
tailscale up --login-server <YOUR_HEADSCALE_URL> \
    --authkey <YOUR_AUTH_KEY> --accept-dns=false
```

## 将 `Headscale` 注册为服务

### 创建 `headscale` 用户

```bash
useradd headscale -d /home/headscale -m         # 创建 headscale 用户
chown headscale:headscale /var/lib/headscale    # 修改 /var/lib/headscale 拥有者
```

### 修改 `config.yaml`

```yaml
unix_socket: /var/run/headscale/headscale.sock
```

### 添加 `service`

```bash
# /etc/systemd/system/headscale.service
[Unit]
Description=headscale controller
After=syslog.target
After=network.target

[Service]
Type=simple
User=headscale
Group=headscale
ExecStart=/usr/local/bin/headscale serve
Restart=always
RestartSec=5

# Optional security enhancements
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/headscale /var/run/headscale
AmbientCapabilities=CAP_NET_BIND_SERVICE
RuntimeDirectory=headscale

[Install]
WantedBy=multi-user.target
```

### 启动服务

```bash
systemctl daemon-reload             # 重新加载 service
systemctl enable --now headscale    # 设置开机自启并启动 headscale
systemctl status headscale          # 查看状态
```

## 其他

### 一些简单的命令

```bash
headscale namespaces list   # 查看命名空间
headscale nodes list        # 查看节点信息
headscale routes list -i 6  # 查看指定节点的路由

tailscale status            # 查看节点状态
tailscale ping xx.xx.xx.xx  # ping 指定内网地址 可以看是 p2p 还是 中转
```

### 子网路由

可能存在将整个局域网连接进去，需要添加子网路由

```bash
# 服务器设置 IPv4/Ipv6 路由转发
echo 'net.ipv4.ip_forward = 1' | tee /etc/sysctl.d/ipforwarding.conf
echo 'net.ipv6.conf.all.forwarding = 1' | tee -a /etc/sysctl.d/ipforwarding.conf
sysctl -p /etc/sysctl.d/ipforwarding.conf

# 注册时候加入子网路由 注意改成自己的子网前缀
tailscale up --login-server YOUR_HEADSCALE_URL \
    --accept-dns=false --advertise-routes=192.168.100.0/24

headscale nodes list        # 查看节点 id
headscale routes list -i x  # 查看指定节点的路由
headscale routes enable -i x -r "192.168.100.0/24" # 开启路由
headscale routes list -i x  # 再次查看是 true
```

之后就可以 ping 到另一个子网的所有主机了

## `Docker` 方式

```bash
docker run \
  --name headscale \
  --detach \
  --rm \
  --volume $(pwd):/etc/headscale/ \
  --publish 0.0.0.0:8080:8080 \
  --publish 127.0.0.1:9090:9090 \
  headscale/headscale:0.15.0 \
  headscale serve
```

## 参考

- [headscale ---- GitHub](https://github.com/juanfont/headscale/)
- [Headscale Notes](https://leffler.tech/2021/10/22/headscale-notes/)
- [芜湖，Tailscale 开源版本让你的 WireGuard 直接起飞~](https://blog.csdn.net/alex_yangchuansheng/article/details/123675454)

