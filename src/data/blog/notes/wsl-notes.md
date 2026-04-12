---
author: Posase
pubDatetime: 2023-12-24T13:37:02Z
modDatetime: 2026-04-12T00:00:00Z
title: "WSL 使用笔记"
draft: false
tags:
  - WSL
  - Linux
  - Linux运维
  - 学习笔记
description: "WSL 使用笔记，涵盖安装配置、APT 镜像替换、代理设置、tmux 配置和常见问题处理"
---


## 安装 WSL

```bash
scoop install win32yank # 安装后可以同步剪切板
wsl --install           # 安装 WSL 功能
wsl --install -d Debian # 安装 Debian，会提示设置用户名密码
```

## 修改 `apt` 镜像
```bash
# 因为默认是最新版本，这里是 Debian 12 的镜像地址
echo "deb http://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
deb-src http://mirrors.aliyun.com/debian/ bookworm main non-free non-free-firmware contrib
deb http://mirrors.aliyun.com/debian-security/ bookworm-security main
deb-src http://mirrors.aliyun.com/debian-security/ bookworm-security main
deb http://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
deb-src http://mirrors.aliyun.com/debian/ bookworm-updates main non-free non-free-firmware contrib
deb http://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib
deb-src http://mirrors.aliyun.com/debian/ bookworm-backports main non-free non-free-firmware contrib" > /etc/apt/sources.list
```
> 更多地址可查看 [阿里云 Debian 镜像](https://developer.aliyun.com/mirror/debian)

## 修改 `root` 密码
```bash
wsl --user root # 使用 root 进入 wsl
passwd          # 修改 root 密码
```

## 相关设置
> 设置以官方文档为准，可能因为版本存在部分差异

### 局域网访问 WSL, 使用系统代理等
```bash
# 用户目录下 .wslconfig
[wsl2]
networkingMode=mirrored     # 镜像模式，会使用跟 Windows 相同的 IP
dnsTunneling=true
autoProxy=true              # 使用 Windows 系统代理
[experimental]
hostAddressLoopback=true    # 使 Windows 可以通过 IP 正常访问 WSL
```

### 修改系统默认使用 root 登录
```bash
# WSL 系统中 /etc/wsl.conf
[boot]
systemd=true    # 开启 systemd
[user]
default="root"  # 默认启动用户
```
### 有什么进入系统需要执行的命令，可以加到 `~/.bashrc` 中
```bash
# ~/.bashrc 文件
# 例如：如果 MySQL 数据库没启动，启动 MySQL
if [ -n "`service mysql status | grep not`" ]
then
    service mysql start
fi
```

## 解决中文乱码

```bash
sudo apt update && sudo apt install -y locales locales-all
sudo dpkg-reconfigure locales # 选择 zh_CN.UTF-8
```

## Tmux 配置

```bash
# ===========================
# 基础设置
# ===========================

# 设置真彩色支持
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-256color:RGB"

# 启用剪贴板同步（WSL 需要 win32yank）
set -g set-clipboard on

# 启用鼠标支持
set -g mouse on

# 减少 ESC 延迟（Vim 用户必备）
set -sg escape-time 10

# 窗口和窗格编号从 1 开始
set -g base-index 1
setw -g pane-base-index 1

# 窗口关闭后自动重新编号
set -g renumber-windows on

# 增加历史记录
set -g history-limit 10000

# ===========================
# 前缀键
# ===========================

# 使用 Ctrl-a 作为前缀键（替代默认的 Ctrl-b）
unbind C-b
set -g prefix C-a
bind C-a send-prefix

# ===========================
# 窗格导航（Vim 风格）
# ===========================

# 使用 hjkl 在窗格间移动
bind h select-pane -L
bind j select-pane -D
bind k select-pane -U
bind l select-pane -R

# 使用 HJKL 调整窗格大小
bind -r H resize-pane -L 5
bind -r J resize-pane -D 5
bind -r K resize-pane -U 5
bind -r L resize-pane -R 5

# ===========================
# 窗格分割
# ===========================

# 使用更直观的按键分割窗格
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"
unbind '"'
unbind %

# 新建窗口时保持当前路径
bind c new-window -c "#{pane_current_path}"

# ===========================
# 复制模式（Vim 风格）
# ===========================

# 使用 vi 模式
setw -g mode-keys vi

# 进入复制模式
bind Escape copy-mode

# vi 风格复制
bind -T copy-mode-vi v send-keys -X begin-selection
bind -T copy-mode-vi y send-keys -X copy-selection-and-cancel

# ===========================
# 窗口管理
# ===========================

# 快速切换窗口
bind -r p previous-window
bind -r n next-window

# 快速切换到上一个窗口
bind Space last-window

# ===========================
# 会话管理
# ===========================

# 重新加载配置文件
bind r source-file ~/.tmux.conf \; display-message "Config reloaded!"

# ===========================
# 外观设置
# ===========================

# 状态栏位置
set -g status-position bottom

# 状态栏样式
set -g status-style "bg=#1e1e2e,fg=#cdd6f4"

# 左侧状态栏
set -g status-left "#[bg=#89b4fa,fg=#1e1e2e,bold] #S #[default] "
set -g status-left-length 30

# 右侧状态栏
set -g status-right "#[fg=#a6adc8] %Y-%m-%d %H:%M "
set -g status-right-length 50

# 窗口标签样式
setw -g window-status-format " #I:#W "
setw -g window-status-current-format "#[bg=#cba6f7,fg=#1e1e2e,bold] #I:#W "

# 窗格边框
set -g pane-border-style "fg=#313244"
set -g pane-active-border-style "fg=#89b4fa"

# 消息样式
set -g message-style "bg=#89b4fa,fg=#1e1e2e"
```

## Tmux 快捷键速查

> 以下快捷键基于上述配置，前缀键为 `Ctrl-a`

### 基础操作

| 快捷键 | 功能 |
|--------|------|
| `Ctrl-a` | 前缀键（替代默认的 `Ctrl-b`） |
| `前缀 + r` | 重新加载配置文件 |
| `前缀 + d` | 分离当前会话 |
| `前缀 + ?` | 显示所有快捷键 |

### 窗格管理

| 快捷键 | 功能 |
|--------|------|
| `前缀 + \|` | 水平分割窗格 |
| `前缀 + -` | 垂直分割窗格 |
| `前缀 + h/j/k/l` | 在窗格间移动（左/下/上/右） |
| `前缀 + H/J/K/L` | 调整窗格大小 |
| `前缀 + x` | 关闭当前窗格 |
| `前缀 + z` | 最大化/还原当前窗格 |

### 复制粘贴

| 快捷键 | 功能 |
|--------|------|
| `前缀 + Escape` | 进入复制模式 |
| `v`（复制模式中） | 开始选择 |
| `y`（复制模式中） | 复制选中内容 |
| `q`（复制模式中） | 退出复制模式 |

### 窗口管理

| 快捷键 | 功能 |
|--------|------|
| `前缀 + c` | 新建窗口 |
| `前缀 + p` | 切换到上一个窗口 |
| `前缀 + n` | 切换到下一个窗口 |
| `前缀 + Space` | 切换到最近使用的窗口 |
| `前缀 + 数字` | 切换到指定编号窗口 |
| `前缀 + &` | 关闭当前窗口 |

### 鼠标操作

| 操作 | 功能 |
|------|------|
| 点击窗格 | 切换到该窗格 |
| 拖拽窗格边框 | 调整窗格大小 |
| 滚轮 | 滚动历史记录 |
| 选中文本 | 自动复制到剪贴板 |