---
author: Posase
pubDatetime: 2024-02-24T12:10:09Z
title: "Minecraft Fabric 模组开发入门"
draft: true
tags:
  - Minecraft
  - Fabric
  - Java
  - 学习笔记
description: "使用 IDEA 和 Minecraft Development 插件搭建 Fabric 模组开发环境"
---

<!-- [建议补充] 内容仅有两步，建议补充完整后再发布 -->

## 配置 `Fabric` 开发环境
1. 自行下载安装 `IDEA`，破解可参考[另一篇文章](https://www.posase.im/posts/b627366c/)
2. 安装 `Minecraft Development` 插件，直接在 `IDEA` 插件商店搜索安装即可

## 新建一个 Fabric 项目
创建一个新项目，选择 `Minecraft Development` 模板，根据向导填写相关内容

## 编写第一个 Fabric 模组
参考[Fabric Wiki](https://fabricmc.net/wiki/zh_cn:tutorial:setup)

## 注意事项
1. 修改`Gradle`设置中`运行、测试、构建`为 `IDEA`
2. 根据需求修改`fabric.mod.json`文件中 `depends`
3. 记得在`resources`目录下，添加`assets/modid/icon.png`
3. 根据提示，启动脚本`Minecraft Client` 添加 `-Dfabric-api.networking.force-packet-serialization=false`

## 遇到的问题
### Out of Memory
1. 修改 `IDEA` 使用内存大小
2. 修改 `gradle.properties` 文件中 `org.gradle.jvmargs=-Xmx4G`

### `[Download-2/ERROR] (Minecraft) Failed to fetch user properties`
具体哪步弄好的不知道，应该是缺少一些东西，重新 `build` `build dependencies` `getSources` 后好了
