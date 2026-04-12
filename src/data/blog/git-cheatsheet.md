---
author: Posase
pubDatetime: 2023-03-18T02:40:12Z
title: "Git 常用命令速查"
draft: false
tags:
  - Git
  - 开发工具
  - 学习笔记
description: "Git 常用命令速查表，涵盖基础操作、分支管理、远程仓库和常见问题处理"
---


## 基础常用指令

| 指令                                   | 说明                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `git init`                             | 初始化一个 `git` 仓库                                                                                                    |
| `git clone [-o <remote>] <url> [<name>]`             | 克隆一个远程仓库，可指定项目文件夹名字<br> 会自动设置好对应远程仓库的默认分支                                                                                   |
| `git add [-i/--interactive] [-p/--patch] <file>/<dir>/* `               | 添加文件/文件夹/全部记录到到暂存区<br>`-i` 交互式暂存<br>`-p` 选择部分文件暂存                                                                                       |
| `git status [-s/--short]`              | 查看哪些文件处于哪些状态，`-s` 输出紧凑格式文件<br>前面的两个标志分别是暂存区和工作区状态                                |
| `git diff [HEAD/--cached]`             | 无参数表示比较工作区和暂存区的区别<br>`HEAD` 表示比较本地仓库和工作区的区别<br>`--cached` 表示比较本地仓库和暂存区的区别 |
| `git rm [-f] [--cached] <file>/<dir> ` | 移除文件<br>`-f` 强制删除<br>`--cached` 仅删除暂存区的文件                                                               |
| `git commit [-a] [-m "msg"]`           | 提交暂存区到本地仓库<br>`-a` 会自动添加所有已修改文件<br>`-m "msg"` 可以将提交消息写在一行                               |
| `git mv <file_from> <file_to>`         | 对文件进行改名<br> 相当于 `rename` -> `rm` -> `add`                                                                      |
| `git log [more]`                       | 查看提交日志，选项较多，下面介绍                                                                                         |
| `git commit --amend` | 撤销操作，替换上一次提交 |
| `git reset <file>` | 取消暂存文件 |
| `git checkout -- <file>` | 还原文件(Tips: 修改会丢失) |

### `git log` 常用选项

`git log [...] [<path>]`

| 选项              | 说明                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `-p`              | 按补丁格式显示每个提交引入的差异。                                                                                    |
| `--stat`          | 显示每次提交的文件修改统计信息。                                                                                      |
| `--shortstat`     | 只显示 `--stat` 中最后的行数修改添加移除统计。                                                                        |
| `--name-only`     | 仅在提交信息后显示已修改的文件清单。                                                                                  |
| `--name-status`   | 显示新增、修改、删除的文件清单。                                                                                      |
| `--abbrev-commit` | 仅显示 SHA-1 校验和所有 40 个字符中的前几个字符。                                                                     |
| `--relative-date` | 使用较短的相对时间而不是完整格式显示日期（比如“2 weeks ago”）。                                                       |
| `--graph`         | 在日志旁以 ASCII 图形显示分支与合并历史。                                                                             |
| `--pretty=<mode>` | 使用其他格式显示历史提交信息。可用的选项包括 `oneline`、`short`、`full`、`fuller` 和 `format`（用来定义自己的格式）。 |
| `--oneline`       | `--pretty=oneline` `--abbrev-commit` 合用的简写。                                                                     |

#### `format` 常用选项

| 选项  | 说明                                          |
| ----- | --------------------------------------------- |
| `%H`  | 提交的完整哈希值                              |
| `%h`  | 提交的简写哈希值                              |
| `%T`  | 树的完整哈希值                                |
| `%t`  | 树的简写哈希值                                |
| `%P`  | 父提交的完整哈希值                            |
| `%p`  | 父提交的简写哈希值                            |
| `%an` | 作者名字                                      |
| `%ae` | 作者的电子邮件地址                            |
| `%ad` | 作者修订日期（可以用 --date=选项 来定制格式） |
| `%ar` | 作者修订日期，按多久以前的方式显示            |
| `%cn` | 提交者的名字                                  |
| `%ce` | 提交者的电子邮件地址                          |
| `%cd` | 提交日期                                      |
| `%cr` | 提交日期（距今多长时间）                      |
| `%s`  | 提交说明                                      |

#### 限制输出的常用选项

| 选项                 | 说明                                       |
| -------------------- | ------------------------------------------ |
| `-<n>`               | 仅显示最近的 n 条提交。                    |
| `--since`/`--after`  | 仅显示指定时间之后的提交。                 |
| `--until`/`--before` | 仅显示指定时间之前的提交。                 |
| `--author`           | 仅显示作者匹配指定字符串的提交。           |
| `--committer`        | 仅显示提交者匹配指定字符串的提交。         |
| `--grep`             | 仅显示提交说明中包含指定字符串的提交。     |
| `-S`                 | 仅显示添加或删除内容匹配指定字符串的提交。 |
| `--no-merges` | 隐藏合并提交 |

## 远程仓库

| 指令 | 说明 |
| --- | --- |
| `git remote [-v]` | 查看远程仓库<br>`-v` 显示对应`url`|
| `git remote add <remote> <url>` | 添加远程仓库 |
| `git remote rm/remove <remote>` | 删除远程仓库 |
| `git remote show <remote>` | 查看远程仓库信息 |
| `git remote rename <remote> <name>`> | 重命名远程仓库名 |
| `git fetch <remote>` | 拉取指定远程仓库的信息(不会合并)|
| `git pull <remote>` | 拉取并合并指定远程仓库 |
| `git push <remote> <branch>` | 推送到远程指定分支 |

## 标签

| 指令 | 说明 |
| --- | --- |
| `git tag [-l/--lig] <grep>` | 查看所有标签，指定显示必须带`-l`<br>指定显示如：`git tag -l "v1.8.*"`|
| `git tag -a <tag> -m "msg"` | 添加附注标签 |
| `git tag <tag>` | 添加轻量标签 |
| `git show <tag>` | 显示标签信息 |
| `git push origin <tag>` | 推送指定标签 |
| `git push origin --tags` | 推送不在远程仓库的所有标签 |
| `git tag -d <tag>` | 删除标签 |
| `git push <remote> :refs/tags/<tag>` | 删除远程标签1 |
| `git push <remote> --delete <tag>` | 删除远程标签2 |
| `git checkout <tag>` | 检出标签 |

### 给过去的提交打标签
```bash
$ git log --pretty=oneline
15027957951b64cf874c3557a0f3547bd83b3ff6 Merge branch 'experiment'
a6b4c97498bd301d84096da251c98a07c7723e65 beginning write support
0d52aaab4479697da7686c15f77a3d64d9165190 one more thing
6d52a271eda8725415634dd79daabbc4d9b6008e Merge branch 'experiment'
0b7434d86859cc7b8c3d5e1dddfed66ff742fcbc added a commit function
4682c3261057305bdd616e23b64b0857d832627b added a todo file
166ae0c4d3f420721acbb115cc33848dfcc2121a started write support
9fceb02d0ae598e95dc970b74767f19372d61af8 updated rakefile
964f16d36dfccde844893cac5b347e7b3d44abbc commit the todo
8a5cbc430f1a9c3d00faaeffd07798508422908a updated readme

# 给 9fceb02d0ae598e95dc970b74767f19372d61af8 打标签
$ git tag -a v1.2 9fceb02
```

## 分支常用指令

| 指令 | 说明 |
| --- | --- |
| `git branch [-v] [-vv] [--merged] [--no-merged]` | `-v`查看所有分支，`*`表示当前分支<br>`-vv`包含更多信息<br>附带最后一次提交<br> 查看已经合并/未合并分支|
| `git branch [-d/D] <branch>` | 新建分支<br>`-d` 删除分支<br>`-D` 强制删除未合并分支 |
| `git checkout [-b] <branch>` | 切换分支<br>`-b`会先新建再切换|
| `git log [more] --decorate` | 查看分支所指的对象 |
| `git log --oneline --decorate --graph --all` | 查看分叉历史 |
| `git merge <branch>` | 合并指定分支到当前分支 |
| `git branch -u/--set-upstream-to <remote>/<branch>` | 跟踪远程分支 |

`HEAD` 指向当前所在的分支，切换分支后，所有的提交会在新分支上移动

所有的切换操作的都是本地分支，远程分支只是一个指向某快照的指针 可以选择合并到主分支开发
如果想开发非主分支，可以新建一个分支并跟踪分支 `git checkout -b test origin/test`
由于比较常用，`git checkout --track origin/test` `git checkout test` 可以实现一样的效果

使用 `git status` 查看合并冲突，解决合并冲突后，使用 `git add` 标记冲突已解决

### 其他说明
```bash
# 分支信息中 `ahead` 表示没提交到远程分支，`behind` 表示没拉取下来
`git fetch --all; git branch -vv` # 查看分支信息

# 如果存在跟踪的上游分支，可以使用 `@{upstream}`/`@{u}` 来表示上游分支
如：`git merge origin/master` -> `git merge @{u}`

# 推送到指定分支并删除分支
git push origin --delete del_branch

# 贮藏
# 分支只能在已经提交的版本上切换，当本地存在未提交的文件时无法切换
git stash push # 记录当前未提交版本 只能记录跟踪文件
git stash list # 查看记录
git stash apply [stash@{n}] # 还原记录版本 默认最新的
git stash --index # 如果其中存在之前暂存的，添加到暂存区
git stash drop/pop # drop 移除指定记录 pop 丢掉最新的
git stash --keep-index # 记录并保存下来
# 可以记录未跟踪文件 如果包含忽略的文件 需要 -a/--all -p/--patch 交互式记录部分变更
git stash -u/--include-untracked 
git stash branch <branch> # 使用记录新建一个分支

git clean [-f] [-d] [-n/--dry-run] [-x] # 清理未跟踪且未忽略的文件
# -f 强制
# -d 空文件夹
# -x 忽略文件也移除
# -n 显示移除哪些，并不移除

git update-index --assume-unchanged <file> # 忽略跟踪文件
git update-index --no-assume-unchanged <file> # 恢复跟踪

git merge <branch> # 合并某分支内容，包含提交信息并增加一条合并的提交信息
# --no-commit 不包含增加的合并信息
# --squash 只合分支内容，不包含任何提交信息
```

## 变基
只对尚未推送或分享给别人的本地修改执行变基操作清理历史， 从不对已推送至别处的提交执行
变基操作
```bash
git rebase master # 相当于把当前分支合并到 master
git rebase --onto master server client # 相当于 client 合并去除 server 合并到 master
git rebase master server # 相当于把 server 合并到 master

# 变基后不会合并内容，所以还需要切换+合并
git checkout master
git merge <branch>
```

## 常用设置

```bash
# 设置默认编辑器
git config --global core.editor vim

# 设置别名
git config --global alias.ci commit
```

## 忽略文件

新建 `.gitignore` 文件，可以将非项目文件进行忽略，子目录也可以有该文件，只作用于子目录

```.gitignore
# 忽略所有 .o/.a 结尾的文件
*.[oa]

# 忽略 bin 文件夹下的所有文件，如果存在 bin 文件，不会被忽略
bin/

# 忽略根目录下的 bin 文件
/bin

# 忽略类似 /test a/test a/b/test 文件
**/test

# 不忽略 test 文件
!test
```
> [Github 语言分类示例](https://github.com/github/gitignore)
