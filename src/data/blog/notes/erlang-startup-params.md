---
author: Posase
pubDatetime: 2023-12-23T05:49:04Z
title: "Erlang 启动参数详解"
draft: false
tags:
  - Erlang
  - 学习笔记
description: "Erlang 常用初始化标志和模拟器标志速查，包含分布式节点、线程池和进程限制等参数"
---


## 初始化标志
```bash
-args_file FileName             # 从 FileName 中读取命令行参数 可以是下述参数
-boot File                      # 指定启动文件启动系统
-config ConfigFile              # 指定配置文件 一般为 config/sys.config
-detached                       # 意味着 -noinput
-noinput                        # 不会读取任何输入 意味着 -noshell
-noshell                        # 启动一个没用shell的系统
-env Key Val                    # 设置环境变量
-hidden                         # 如果是分布式节点，作为隐藏节点启动，会连接，但是nodes无法查询
-name Name@Host                 # 是系统成为一个分布式节点，如果是 Name = undefined，会优化为另一个节点的临时客户端
-sname Name@Host                # 短名称，区别是Host不要求是完全限定名，而且可以不指定
-pa Dir1 Dir2                   # 添加指定目录到代码路径开头 也可以用环境变量 ERL_LIBS
-pz Dir1 Dir2                   # 添加指定目录到代码路径末尾
-proto_dist Proto               # 指定 Erlang 分发的协议 inet_tcp/inet_tls/inet6_tcp
-remsh Node                     # 连接到远程节点启动 Erlang
-run Mod [Fun, Args]            # 调用指定函数（参数是字符串）
-s Mod [Fun, Args]              # 调用指定函数（参数是原子）
-eval Str                       # 启动是运行指定表达式
-setcookie Cookie               # 指定节点 Cookie, 相同 Cookie 节点才可以连接
-make                           # 运行 make:all() 后终止
--                              # 后面的都视为普通参数，可以使用 init:get_plain_arguments/0 检索
-extra                          # 同 --
-kernel Shell                   # 指定 Shell 而不是使用默认 Shell
-root                           # 指定根目录
```
> 上述初始化标志都可以使用`init:get_argument/0`检索

## 模拟器标志
```bash
+a Size                         # 指定异步线程池建议堆栈大小，单位（KB)，注意只是建议参数 默认16KB
+A Size                         # 指定异步线程池中的线程数 默认1
+c true | false                 # 是否启用时间校正 默认true
+hms Size                       # 默认堆大小
+hmbs Size                      # 默认二进制虚拟堆大小
+hmax Size                      # 默认进程最大堆大小 默认0
+hpds Size                      # 默认进程字典大小
+L                              # 不加载源文件文件名和行号信息，可以节省内存，但是异常不会包含这些信息
+pc                             # 可打印字符范围 latin1 / unicode
+P Num                          # 进程最大数量 默认 262144，可以使用 erlang:system_info(process_limit).查看
+Q Num                          # 最大端口数量，1024-134217727，默认linux 65535 windows 8196
+t Size                         # 最大原子数量 默认 1048576
```

> 更多启动参数详见[官方文档](https://www.erlang.org/doc/man/erl.html)