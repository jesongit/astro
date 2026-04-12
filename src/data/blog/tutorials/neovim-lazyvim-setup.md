---
author: Posase
pubDatetime: 2024-08-16T09:54:24Z
modDatetime: 2026-04-12T00:00:00Z
title: "Neovim + LazyVim 快速上手"
draft: false
tags:
  - Neovim
  - LazyVim
  - 开发工具
  - 教程
description: "在 Windows 和 Linux 上快速安装 Neovim + LazyVim，包含配置、常用快捷键和一键脚本"
---


## 安装neovim
>
> [官方文档](https://github.com/neovim/neovim/blob/master/INSTALL.md)

```bash
# windows
# 安装相关依赖 字体 和 neovim
scoop bucket add extras
scoop bucket add nerd-fonts
scoop install gcc ripgrep lazygit FiraCode-NF-Mono neovim fd

# linux example: debian
apt install -y git lazygit gcc make build-essential nodejs npm ripgrep fd-find fzf unzip
npm install -g tree-sitter-cli

curl -LO https://github.com/neovim/neovim/releases/latest/download/nvim-linux64.tar.gz
sudo rm -rf /opt/nvim
sudo tar -C /opt -xzf nvim-linux64.tar.gz
echo 'export PATH="$PATH:/opt/nvim-linux64/bin"' >> ~/.bashrc
source ~/.bashrc
```

> 注意将`Nerd Fonts`系列字体设置为终端字体才能正常显示图标
>
> Linux 上可手动安装 Nerd Fonts 字体：下载字体文件到 `~/.local/share/fonts`，然后执行 `fc-cache -fv` 刷新字体缓存

## 安装lazyvim

```bash
# 1. 进入`nvim` 配置目录
cd ~/.config/nvim # linux
cd $env:LOCALAPPDATA # windows

# 2. 拉取 lazyvim 配置
git clone https://github.com/LazyVim/starter ./

# 3. 启动 nvim 将自动安装
nvim
```

## 配置

> 更多配置详见[官方文档](https://www.lazyvim.org/configuration/general)
修改 `nvim/lua/config/options.lua`

```lua
local opt = vim.opt
opt.spelllang = { "en", "cjk" } -- 设置拼写检查，防止中文提示拼写错误
opt.shiftwidth = 4              -- 修改默认缩进
opt.tabstop = 4
opt.softtabstop = 4             -- 软 Tab 宽度
```

## 常用快捷键

> `<leader>` 默认是空格更多快捷键查看[官方文档](https://www.lazyvim.org/keymaps)

| 快捷键 | 说明 |
| --- | --- |
| `<C-h>` | 移动光标到左边窗口 |
| `<C-l>` | 移动光标到右边窗口 |
| `<S-h>` | 移动到左边缓冲区 |
| `<S-l>` | 移动到右边缓冲区 |
| `a` | 添加文件(在目录树中) |
| `A` | 添加文件夹(在目录树中) |
| `s` | 快速查找 |
| `<leader>ss` | 显示导出函数/标题列表 |
| `<leader>cm` | 打开 Mason 界面 |
| `<leader>us` | 关闭拼写检查 |
| `<leader>gg` | 打开 Lazygit 界面 |
| `<leader><space>` | 根目录查找文件 |
| `<leader>fF`| 当前目录查找文件 |
| `<leader>e` | 打开/关闭目录树 |
| `<leader>/` | 全局搜索 |
| `<leader>sr` | 全局替换 |
| `<leader>qq` | 退出全部 |
| `<leader>cR` | 重命名文件 |
| `<leader>cr` | 重命名变量 |
| `<leader>bo` | 关闭其他缓冲 |
| `<leader>bd` | 关闭当前缓冲 |
| `<leader>snh` | 显示历史通知 |

## 安装LSP

进入nvim 后，使用`<leader>cm` 进入 `Mason` 界面 直接搜索对应插件安装即可

## 忽略文件

`.ignore` 文件, 可以设置忽略文件，前面加`!`可以防止忽略文件，默认会忽略`.gitignore` 中的文件

## 一键脚本

```ps1
# 安装前需要提前安装好 Scoop 已经设置好相关代理，包括 Scoop/Git
# 安装相关依赖 字体 和 neovim
scoop bucket add extras
scoop bucket add nerd-fonts
scoop install mingw ripgrep lazygit neovim FiraCode-NF-Mono

# 安装 lazyvim
$folderPath = "$env:LOCALAPPDATA/nvim"
if (-not (Test-Path $folderPath)) {
    New-Item -ItemType Directory -Path $folderPath | Out-Null
}
cd $folderPath
git clone https://github.com/LazyVim/starter ./

# 修改默认缩进
$optinos = "local opt = vim.opt
opt.shiftwidth = 4
opt.tabstop = 4"
Add-Content -Path lua/config/options.lua -Value $optinos -Encoding UTF8

# 启动 neovim 会自动安装 lazyvim
nvim
```

## Erlang LSP 配置

在 Erlang Shell 中执行 `filename:basedir(user_config, "erlang_ls").` 可查看配置文件位置，更多信息参考 [erlang_ls 配置文档](https://erlang-ls.github.io/configuration/)。

创建 `erlang_ls.config`：

```yaml
providers:
  disabled:
    - document-formatting # 关闭自动格式化
```

## 参考
- [Neovim 安装文档](https://github.com/neovim/neovim/blob/master/INSTALL.md)
- [LazyVim 官方文档](https://www.lazyvim.org/)
