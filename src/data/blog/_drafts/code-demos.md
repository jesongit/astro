---
author: Posase
pubDatetime: 2022-04-08T04:07:32Z
modDatetime: 2022-04-08T06:58:21Z
title: "代码 Demo 合集"
draft: true
tags:
  - Erlang
  - Docker
  - Shell
  - Cloudflare
  - 学习笔记
description: "常用代码片段合集，包含 Erlang TCP/UDP、Aria2c 下载、Docker 命令、Cloudflare Tunnel 和 GitHub Actions 配置"
---


## `Erlang` 的 `TCP/UDP`

```erlang
loop(Socket) ->
    receive
        {udp, Socket, Port, Data} ->
            io:format("received udp Port: ~p Data: ~p~n", [Port, Data]),
            loop(Socket);
        {tcp, Socket, Data} ->
            io:format("received tcp Data: ~p~n", [Data]),
            gen_tcp:send(Socket, Data),
            loop(Socket);
        Msg ->
            io:format("Unknow Msg ~p~n", [Msg]),
            loop(Socket)
    end.

udp(Port) ->
    {ok,Socket} = gen_udp:open(Port, [binary]),
    io:format("udp open Port: ~p Socket ~p~n", [Port, Socket]),
    loop(Socket).

tcp(Port) ->
    {ok, Listen} = gen_tcp:listen(Port, [binary, {packet, 0}, {active, true}]),
    io:format("get listen success ~p~n", [Listen]),
    {ok, Socket} = gen_tcp:accept(Listen),
    io:format("tcp accept Port: ~p Socket ~p~n", [Port, Socket]),
    loop(Socket).

% server opened socket: #Port<0.491> Port: 9
% server received:{udp,#Port<0.491>,{192,168,20,21},60406,<<"hello\n">>}
```

## 使用 `Aria2c` 下载文件
```bash
# -x 服务器最大连接数
# -s 下载一个文件使用的连接数
# -j 最多可以同时下载几个文件
# -d 下载目录
# -o 下载文件名
# -c 断点续传
aria2c -x16 -s16 -d 'D:\' -o 'rename.zip' 'url/bt_file'
```

## `Erlang` 节点连接 和 远程调用
```bash
# 创建 3 个节点
erl -sname a
erl -sname b
erl -sname c
```
```erlang

% 同 cookie 才可以连接
net_adm:ping(<node>). % pong 成功 pang 失败

% Cookie 设置 
erlang:set_cookie().
erlang:get_cookie().

% 查看本节点名，查看已连接节点
node().
nodes().

% 订阅节点
net_kernel:monitor_nodes(?true, [{node_type, all}, nodedown_reason])

% 远程调用
rpc:call(node,mod,fun,args).
rpc:cast(node,mod,fun,args).
```

## `Shell`
```bash
# -a 包含 tcp和udp
# -n 禁用反域名解析 加快查询速度
# -p 获取进程名，进程号，用户名
# -t 仅展示 tcp
# -u 仅展示 udp
# -l 仅展示正在监听端口
netstat -anp 
netstat -tnlp
netstat -ie # 等于 ifconfig

# 查看硬件架构
arch
```

## `Docker`

```bash
docker ps               # 查看运行中
docker logs x           # 查看日志
docker rm x             # 移除容器
docker rmi x            # 移除镜像

docker exec -it x bash  # 跑一个 bash
```

## `CloudFlared Tunnel`
```bash
cloudflared tunnel login # 授权一个域名

# 直接就可以通过 test.example.com 访问 http://localhost:8080 了
cloudflared tunnel --hostname test.example.com --url http://localhost:8080

cloudflared tunnel create test                      # 创建一个隧道
cloudflare tunnel route dns test test.example.com   # 指定隧道 test 使用 test.example.com
```


## GitHub Actions 使用 `Pyinstaller` 自动打包
```yml
name: Python application

on:
  push:
    branches: [ "main" ]
  pull_request:
    branches: [ "main" ]

jobs:
  build:

    # 使用 windows 最新的系统
    runs-on: windows-latest

    steps:
      - uses: actions/checkout@v3

      # 自动安装 python 环境
      - name: Set up Python 3.10
        uses: actions/setup-python@v3
        with:
          python-version: "3.10"
    
      # 安装依赖文件
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
    
      # 打包文件，这里自己写了个脚本
      - name: Run PyInstaller
        run: |
          .\pack.bat

      # 上传打包文件
      - uses: actions/upload-artifact@v2
        with:
            name: MVtools
            path: test/MVTools.7z
    
      # 创建 release 并发布
      - name: Create Release
        id: create_release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: ${{ github.event.head_commit.message }}
          overwrite: true
          body: |
            Test Release v1.0.0
          draft: false
          prerelease: false

      # 上传 打包文件到 release
      - name: Upload Release Asset
        id: upload-release-asset
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: test/MVTools.7z
          asset_name: MVTools.7z
          asset_content_type: application/7z
```


## Debian 12 APT 源
```bash
deb https://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
deb https://mirrors.aliyun.com/debian-security/ bookworm-security main non-free-firmware contrib
deb https://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
deb https://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib
```