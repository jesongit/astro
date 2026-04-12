---
author: Posase
pubDatetime: 2022-02-16T02:14:41Z
modDatetime: 2022-03-07T09:17:29Z
title: "Nuitka 打包 Python 为可执行文件"
draft: false
tags:
  - Nuitka
  - Python
  - Windows
  - 教程
description: "使用 Nuitka 将 Python 脚本打包为独立可执行文件，支持引入外部文件和自定义图标"
---


## 说点什么
众所周知，当要做点小东西的时候，`Python` 总是一个不错的选择

这里介绍一下如何使用 `Nuitka` 来打包成一个可**脱离本机环境**的**可执行文件**

## 直接告诉我怎么做

```cmd
pip install nuitka
pip install zstandard
nuitka --onefile --include-package-data=openpyxl .\merge_file.py
rem zstandard 是 --one_file 模式下必要的压缩模块
rem 会提示需要下载 一些东西, 一路 Yes 即可
rem 觉得太慢了可以自己点下载地址，丢到展示的文件夹中
```

## 打包一些文件进来

```python
# 这里直接给使用到的例子
# 调用 ariac2 进行多线程下载
import os
import time

def get_file_from_cmd(link):
    set_dir = os.path.dirname(__file__)
    exe_path = set_dir + r'\aria2c.exe'
    order = exe_path + ' -s16 -x10 ' + link
    os.system(order)

if __name__ == '__main__':
    link = 'https://www.jeson.im:3008/d/%E5%85%B6%E4%BB%96/Dandfighter.zip'
    start = time.time()
    get_file_from_cmd(link)
    end = time.time()
    print(f"耗时：{end-start:.2f}")
```

这里需要引入 ariac.exe 文件

```cmd
nuitka --onefile --include-data-file=./aria2c.exe=./aria2c.exe --windows-icon-from-ico=favicon.ico .\test.py
rem --include-data-file=<source>=<target>  包含指定文件
rem --include-data-dir=<source>=<target>   包含文件夹
rem --windows-icon-from-ico=<file>.ico     添加文件图标
```
> 遇到了系统找不到提示路径的问题，这里我卸载了自己的 mingw 好了
> 估计应该事 gcc 版本的问题，可以尝试先卸载运行，或者重装 gcc