---
author: Posase
pubDatetime: 2020-03-22T07:24:47Z
modDatetime: 2022-03-07T09:44:31Z
title: "「教程」使用 Hexo + Github 搭建静态博客"
draft: false
tags:
  - Hexo
  - Git
  - 博客搭建
  - 教程
description: "从安装 Hexo 到部署 Github Pages 的完整教程，包含主题配置、域名绑定和多端编辑"
---


> 提前安装好 GIT 和Node.js，其中 GIT 需要配置好 SSH key

## 配置 hexo

### 安装 hexo

~~~cmd
npm install -g hexo-cli
~~~

### 创建 blog 目录

~~~cmd
hexo init blog
~~~

### 安装相关依赖

~~~cmd
cd blog
npm install
~~~

### 基础配置

~~~yml
# _config.yml
title: ''        # 标题
subtitle: ''     # 副标题
description: ''  # 描述
keywords: ''     # 关键字
author: ''       # 作者
language: zh-CN  # 语言
timezone: ''     # 时区
~~~

其他配置详见[官方文档](https://hexo.io/zh-cn/docs/configuration)

### 本地启动

~~~cmd
hexo s
~~~

在浏览器中输入 <http://localhost:4000> 即可查看欢迎页

## 修改主题（可选）

> Hexo 主题多种多样，只需要 clone 到 `./themes` 中即可，操作步骤大同小异

这里以 [diaspora](https://github.com/Fechin/hexo-theme-diaspora) 主题为例

### 安装主题

~~~cmd
git clone https://github.com/Fechin/hexo-theme-diaspora.git themes/diaspora
# clone 后记得删除主题中的 .git 文件夹，不然可能在其他端无法 clone 到文件
~~~

### 启用主题

~~~yml
# _config.yml
...
theme: diaspora
...
~~~

详细配置可参考不同主题的文档

### 预览主题

~~~cmd
hexo clean
hexo g
hexo s
~~~

## Github 绑定

### 创建仓库

创建一个名为<code>username.github.io</code>的仓库，其中 **username** 为你的用户名

### 配置 GitHub 地址

> 注意使用 `SSH` 需要先添加 `SSH` 密钥，详见[官方说明](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

~~~yml
# _config.yml
deploy:
  type: git
  repo: git@github.com:jesongit/jesongit.github.io.git # 修改为自己的 ssh 链接
  branch: master
~~~

### 部署到 GitHub

~~~cmd
hexo g
hexo d
~~~

此时访问 <code>https://username.github.io</code> 已经可以浏览站点了

> 若出现 git 报错，ERROR Deployer not found: git，将 git 插件卸载再安装就好了
>
> ~~~cmd
> npm uninstall hexo-deployer-git --save
> npm install hexo-deployer-git --save
> ~~~

## 域名绑定（可选）

> 有些同学可能对 <code>https://username.github.io</code> 这个域名并不满意，希望替换到自己域名

### 域名申请

>  推荐去国外的域名注册商注册，不需要备案，非常快

演示已经在 [GoDaddy](https://sg.godaddy.com/zh) 注册好域名 <code>jeosn.club</code>

### 配置 CNAME

在 <code>./source</code> 中创建名为 <code>CNAME</code> 的文件，保存申请的域名

~~~
www.jeson.club
~~~

上传 <code>CNAME</code>

~~~cmd
hexo d
~~~

### 域名解析

> 推荐使用 [DNSPod](https://console.dnspod.cn/)（需要注册），GoDaddy 提供的解析，`CNAME` 无法添加 **@** 记录

在 **DNS 管理**中，修改自定义域名服务器为 <code>f1g1ns1.dnspod.net</code> 和 <code>f1g1ns2.dnspod.net</code>

在 **DNSPod** 中添加 2 条 <code>CNAME</code> 记录即可

在浏览器中输入域名即可访问站点

## 多端编辑 `Hexo`

### 配置 `.gitignore` 文件（可选）

> 出于安全考虑，不上传配置文件
> 如果想上传配置文件，建议另外单独创建一个私有库

~~~
.DS_Store
Thumbs.db
db.json
*.log
node_modules/
public/
.deploy*/
_config.yml
~~~

### 添加版本控制

~~~shell
# 注意替换为自己的仓库
git init                   # 初始化本地仓库
git add -A                 # 添加本地所有文件到仓库        
git commit -m "blog源文件"  # 添加 commit
git branch hexo            # 创建本地仓库分支 hexo
# origin是本地分支,remote add操作会将本地仓库映射到云端
git remote add origin git@github.com:jesongit/jesongit.github.io.git
git push origin hexo       # 将本地仓库的源文件推送到远程仓库 hexo 分支
~~~

### 其他终端

>   默认配置好 `SSH KEY`，安装好 `Node.js` 等环境

~~~shell
git clone -b hexo git@github.com:jesongit/jesongit.github.io.git
cd hexo
npm install
~~~

### 上传源文件

~~~shell
git add *
git commit -m "update"
git push
~~~

### 同步源文件

~~~shell
git pull origin hexo
~~~

## 升级 `Hexo`

```bash
# npm 更换源后更方便
# 进入 Hexo 根目录，更新 package.json 中的插件
npm install -g npm-check           # 检查之前安装的插件，都有哪些是可以升级的 
npm install -g npm-upgrade         # 升级系统中的插件
npm-check
npm-upgrade

# 更新项目中的 hexo 和所有插件
npm update
```

## 其他问题

如果还想创建静态博客，可参考 <https://pages.github.com/> 创建 `Github Page`