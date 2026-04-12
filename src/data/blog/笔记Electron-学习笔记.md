---
author: Posase
pubDatetime: 2024-01-03T02:49:44Z
title: "「笔记」Electron 学习笔记"
draft: true
tags:
  - Electron
  - JavaScript
  - 学习笔记
description: "Electron 桌面应用开发入门笔记，从项目创建到基础配置"
---

<!-- [建议补充] 内容过少，建议补充完整后再发布 -->

## 创建第一个应用
> 需要提前准备好 `nodejs` 环境

### 新建项目和安装依赖
```bash
# 新建一个 electron 项目，安装相关依赖
mkdir my-app
cd my-app
npm install electron --save-dev
```

### 修改 `package.json`
```json
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "",
  "main": "main.js",        // 修改入口文件
  "scripts": {
    "start": "electron .",  // 设置启动命令
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}
```

### 添加一个展示网页
```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <!-- https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP -->
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; script-src 'self'"
    />
    <meta
      http-equiv="X-Content-Security-Policy"
      content="default-src 'self'; script-src 'self'"
    />
    <title>Hello from Electron renderer!</title>
  </head>
  <body>
    <h1>Hello from Electron renderer!</h1>
    <p>👋</p>
  </body>
</html>
```

###  编写 `main.js`
```javascript
// app 模块，它控制应用程序的事件生命周期。 
// BrowserWindow 模块，它创建和管理应用程序 窗口。
const { app, BrowserWindow } = require('electron')

const createWindow = () => {
    // 创建一个窗口
    const win = new BrowserWindow({
        width: 800,
        height: 600
    })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
})
```

### 添加 `VsCode` 调试文件
添加该内容到`.vscode/launch.json` 就可以使用**运行与调试**功能
```json
{
  "version": "0.2.0",
  "compounds": [
    {
      "name": "Main + renderer",
      "configurations": [
        "Main",
        "Renderer"
      ],
      "stopAll": true
    }
  ],
  "configurations": [
    {
      // 由于调试器绑定主进程需要时间，前面代码可能会被跳过，可添加 setTimeout 来避免
      "name": "Renderer",
      "port": 9222,
      "request": "attach", // 绑定到主进程
      "type": "chrome", // 使用 chrome 调试
      "webRoot": "${workspaceFolder}"
    },
    {
      "name": "Main", // 用来运行主程序
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": [
        ".",
        "--remote-debugging-port=9222"
      ], // 暴露一个调试端口
      "outputCapture": "std",
      "console": "integratedTerminal"
    }
  ]
}
```

### 使用预加载脚本
渲染器默认权限比较少，可以通过预加载脚本添加权限
```javascript
// preload.js
const { contextBridge } = require('electron')

// 如果你想为渲染器添加需要特殊权限的功能，可以通过 contextBridge 接口定义 全局对象。
contextBridge.exposeInMainWorld('versions', {
    // 通过 versions 这一全局变量，将 Electron 的 process.versions 对象暴露给渲染器。
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron
    // 除函数之外，我们也可以暴露变量
})
```
```javascript
// main.js
const { app, BrowserWindow } = require('electron')
const path = require('node:path')

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            // 将脚本附加到渲染进程
            // __dirname 指当前执行的文件夹，即根目录
            preload: path.join(__dirname, 'preload.js')
        }
    })
    win.loadFile('index.html')
}

app.whenReady().then(() => {
    createWindow()
})
```
> 现在可以用过 `version`/`windows.version` 来访问暴露的变量
```html
<!-- index.html 这里省略了其他部分 -->
<body>
  <h1>来自 Electron 渲染器的问好！</h1>
  <p>👋</p>
  <p id="info"></p>
</body>
<script src="./renderer.js"></script>
```

```javascript
// renderer.js
const information = document.getElementById('info')
information.innerText = `本应用正在使用 Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), 和 Electron (v${versions.electron()})`
```

> 更多内容详见[官方文档](https://www.electronjs.org/zh/docs/latest/)