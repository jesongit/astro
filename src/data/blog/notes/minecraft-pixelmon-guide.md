---
author: Posase
pubDatetime: 2025-04-30T02:00:55Z
title: "Minecraft Pixelmon 宝可梦数据参考"
draft: false
tags:
  - Minecraft
  - 游戏
  - 学习笔记
description: "Minecraft Pixelmon 宝可梦模组数据参考，涵盖传说宝可梦生成表、种族值、薄荷效果和服务器配置"
---

本文整理了 Minecraft Pixelmon 模组的常用数据，包括服务器配置、种族值排名、传说宝可梦生成条件、特殊纹理、异兽和薄荷效果等内容，方便游戏中随时查阅。

## 服务器配置

### Java 版本要求

不同版本的 Mohist 服务端对 Java 版本有不同要求：

| Mohist 版本 | Java 版本 |
|---|---|
| Mohist 1.20.1 | Java 17+ |
| Mohist 1.20.2 | Java 17+ |
| Mohist 1.7.10 | Java 8 |
| Mohist 1.12.2 | Java 8/11 |
| Mohist 1.16.5 | Java 8/11/16 |

### 启动命令

使用以下命令启动服务器（设置中文语言环境和 4G 内存）：

```bash
java -Duser.language=zh -Duser.country=CN -Dfile.encoding=UTF-8 -Xmx4G -Xms4G -jar server.jar nogui
```

### 常用指令

```
gamerule keepInventory true
```

开启死亡不掉落。

## 最高种族值

按属性分类的最高种族值宝可梦排名，分为非传说、初始形态和全宝可梦三类。

| 属性 | 非传说最高种族值 | 初始形态最高种族值 | 全宝可梦最高种族值 |
|---|---|---|---|
| 一般 | 银伴战兽 (670) | 肯泰罗 (490) | 阿尔宙斯 (720) |
| 火 | 烈咬陆鲨 (600) | 暴蝾螈 (530) | 凤王 (680) |
| 水 | 暴鲤龙 (540) | 海兔兽 (475) | 盖欧卡 (670) |
| 草 | 蜥蜴王 (530) | 妙蛙种子 (318) | 谢米（天空形态）(600) |
| 电 | 电龙 (510) | 皮卡丘 (320) | 捷克罗姆 (680) |
| 冰 | 几何雪花 (515) | 雪童子 (300) | 酋雷姆 (700) |
| 格斗 | 路卡利欧 (525) | 利欧路 (285) | 代奥奇希斯（攻击形态）(600) |
| 毒 | 毒藻龙 (530) | 尼多兰 (275) | 无极汰那 (690) |
| 地面 | 烈咬陆鲨 (600) | 小山猪 (250) | 固拉多 (670) |
| 飞行 | 暴蝾螈 (600) | 波波 (251) | 裂空座 (680) |
| 超能力 | 沙奈朵 (518) | 拉鲁拉斯 (211) | 超梦 (680) |
| 虫 | 赫拉克罗斯 (500) | 飞天螳螂 (500) | 奈克洛兹玛 (600) |
| 岩石 | 班基拉斯 (600) | 幼基拉斯 (300) | 基格尔德（完全形态）(708) |
| 幽灵 | 花洁夫人 (552) | 鬼斯 (310) | 骑拉帝纳 (680) |
| 龙 | 烈咬陆鲨 (600) | 迷你龙 (300) | 裂空座 (680) |
| 恶 | 班基拉斯 (600) | 索罗亚克 (510) | 伊裴尔塔尔 (680) |
| 钢 | 巨金怪 (600) | 铁哑铃 (300) | 帝牙卢卡 (680) |
| 妖精 | 沙奈朵 (518) | 皮皮 (323) | 哲尔尼亚斯 (680) |

## 传说宝可梦生成表

以下为各世代传说宝可梦在 Pixelmon 模组中的生成条件。

### 第一代

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 急冻鸟 | Ice Spikes | minecraft | 任意 | 地面/水面 | 无 | 100 |
| 闪电鸟 | Savanna Plateau | minecraft | 白天 | 地面 | 雷暴 | 50 |
| 火焰鸟 | Nether Wastes | minecraft | 任意 | 地面 | 无 | 50 |
| 超梦 | Deep Dark | minecraft | 夜晚 | 地下 | 无 | 1 |
| 梦幻 | Jungle | minecraft | 白天 | 空中 | 无 | 1 |

### 第二代

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 雷公 | Savanna | minecraft | 白天 | 地面 | 雷暴 | 50 |
| 炎帝 | Basalt Deltas | minecraft | 任意 | 地面 | 无 | 50 |
| 水君 | Frozen River | minecraft | 任意 | 水面 | 无 | 50 |
| 洛奇亚 | Deep Ocean | minecraft | 夜晚 | 水面 | 无 | 50 |
| 凤王 | Badlands | minecraft | 白天 | 空中 | 晴天 | 50 |
| 时拉比 | Flower Forest | minecraft | 白天 | 地面 | 无 | 1 |

### 第三代

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 雷吉洛克 | Desert | minecraft | 任意 | 地下 | 无 | 50 |
| 雷吉艾斯 | Frozen Peaks | minecraft | 任意 | 地下 | 无 | 50 |
| 雷吉斯奇鲁 | Taiga | minecraft | 任意 | 地下 | 无 | 50 |
| 拉帝亚斯 | Meadow | minecraft | 白天 | 空中 | 无 | 30 |
| 拉帝欧斯 | Plains | minecraft | 白天 | 空中 | 无 | 30 |
| 盖欧卡 | Deep Ocean | minecraft | 任意 | 水面 | 下雨 | 30 |
| 固拉多 | Badlands Plateau | minecraft | 白天 | 地面 | 晴天 | 30 |
| 裂空座 | Stony Peaks | minecraft | 任意 | 空中 | 无 | 10 |
| 基拉祈 | Sunflower Plains | minecraft | 夜晚 | 地面 | 晴天 | 1 |
| 代奥奇希斯 | The End | minecraft | 任意 | 地面 | 无 | 1 |

### 第四代

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 由克希 | Dripstone Caves | minecraft | 任意 | 地下 | 无 | 30 |
| 艾姆利多 | Lush Caves | minecraft | 任意 | 地下 | 无 | 30 |
| 亚克诺姆 | Deep Dark | minecraft | 任意 | 地下 | 无 | 30 |
| 帝牙卢卡 | Dripstone Caves | minecraft | 任意 | 地下 | 无 | 10 |
| 帕路奇亚 | Lush Caves | minecraft | 任意 | 地下 | 无 | 10 |
| 席多蓝恩 | Basalt Deltas | minecraft | 任意 | 地面 | 无 | 30 |
| 雷吉奇卡斯 | Ice Spikes | minecraft | 任意 | 地面 | 无 | 10 |
| 骑拉帝纳 | Soul Sand Valley | minecraft | 任意 | 地面 | 无 | 10 |
| 克雷色利亚 | Sunflower Plains | minecraft | 夜晚 | 空中 | 无 | 30 |
| 菲奥奈 | Warm Ocean | minecraft | 任意 | 水面 | 无 | 30 |
| 玛纳霏 | Deep Lukewarm Ocean | minecraft | 任意 | 水面 | 无 | 1 |
| 达克莱伊 | Deep Dark | minecraft | 夜晚 | 地面 | 无 | 1 |
| 谢米 | Flower Forest | minecraft | 白天 | 地面 | 晴天 | 1 |
| 阿尔宙斯 | 无自然生成 | — | — | — | 特殊方式 | — |

### 第五代

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 比克提尼 | Sunflower Plains | minecraft | 白天 | 地面 | 晴天 | 1 |
| 勾帕路翁 | Old Growth Spruce Taiga | minecraft | 任意 | 地面 | 无 | 30 |
| 代拉基翁 | Stony Peaks | minecraft | 任意 | 地面 | 无 | 30 |
| 毕力吉翁 | Dark Forest | minecraft | 任意 | 地面 | 无 | 30 |
| 龙卷云 | Plains | minecraft | 任意 | 空中 | 雷暴 | 30 |
| 雷电云 | Savanna | minecraft | 任意 | 空中 | 雷暴 | 30 |
| 土地云 | Sparse Jungle | minecraft | 任意 | 空中 | 无 | 30 |
| 莱希拉姆 | Badlands | minecraft | 白天 | 地面 | 晴天 | 10 |
| 捷克罗姆 | Stony Shore | minecraft | 任意 | 地面 | 雷暴 | 10 |
| 酋雷姆 | Frozen Peaks | minecraft | 任意 | 地面 | 无 | 10 |
| 凯路迪欧 | River | minecraft | 任意 | 水面 | 无 | 1 |
| 美洛耶塔 | Flower Forest | minecraft | 白天 | 地面 | 无 | 1 |
| 盖诺赛克特 | Badlands | minecraft | 夜晚 | 地面 | 无 | 1 |

### 第六代

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 哲尔尼亚斯 | Flower Forest | minecraft | 白天 | 地面 | 无 | 10 |
| 伊裴尔塔尔 | Dark Forest | minecraft | 夜晚 | 空中 | 无 | 10 |
| 基格尔德（10% 形态） | Savanna | minecraft | 夜晚 | 地面 | 无 | 30 |
| 基格尔德（50% 形态） | Swamp | minecraft | 夜晚 | 地面 | 无 | 10 |
| 基格尔德核心 | Deep Dark | minecraft | 任意 | 地下 | 无 | 30 |
| 基格尔德细胞 | Lush Caves | minecraft | 任意 | 地下 | 无 | 50 |
| 蒂安希 | Dripstone Caves | minecraft | 任意 | 地下 | 无 | 1 |
| 胡帕 | Desert | minecraft | 夜晚 | 地面 | 无 | 1 |
| 波尔凯尼恩 | Warm Ocean | minecraft | 任意 | 水面 | 无 | 1 |

### 第七代

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 卡璞・鸣鸣 | Jungle | minecraft | 白天 | 地面 | 无 | 30 |
| 卡璞・蝶蝶 | Flower Forest | minecraft | 白天 | 地面 | 无 | 30 |
| 卡璞・哞哞 | Plains | minecraft | 白天 | 地面 | 无 | 30 |
| 卡璞・鳍鳍 | Beach | minecraft | 白天 | 水面 | 无 | 30 |
| 科斯莫古 | The End | minecraft | 任意 | 地面 | 无 | 30 |
| 科斯莫姆 | The End | minecraft | 任意 | 地面 | 无 | 10 |
| 索尔迦雷欧 | Mesa | minecraft | 白天 | 地面 | 晴天 | 10 |
| 露奈雅拉 | Deep Dark | minecraft | 夜晚 | 地面 | 无 | 10 |
| 奈克洛兹玛 | The End | minecraft | 任意 | 地面 | 无 | 1 |
| 玛机雅娜 | 无自然生成 | — | — | — | 特殊方式 | — |
| 玛夏多 | Nether Wastes | minecraft | 任意 | 地面 | 无 | 1 |
| 泽拉奥拉 | Savanna Plateau | minecraft | 任意 | 地面 | 雷暴 | 1 |
| 美录坦 | 无自然生成 | — | — | — | 特殊方式 | — |
| 美录梅塔 | 无自然生成 | — | — | — | 特殊方式 | — |

### 第八代

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 苍响 | Taiga | minecraft | 白天 | 地面 | 无 | 10 |
| 藏玛然特 | Snowy Taiga | minecraft | 任意 | 地面 | 无 | 10 |
| 无极汰那 | The End | minecraft | 任意 | 空中 | 无 | 10 |
| 熊徒弟 | Old Growth Spruce Taiga | minecraft | 白天 | 地面 | 无 | 30 |
| 武道熊师（一击流） | Stony Peaks | minecraft | 任意 | 地面 | 无 | 10 |
| 武道熊师（连击流） | Stony Peaks | minecraft | 任意 | 地面 | 无 | 10 |
| 雷吉艾勒奇 | Warped Forest | minecraft | 任意 | 地面 | 无 | 50 |
| 雷吉铎拉戈 | Crimson Forest | minecraft | 任意 | 地面 | 无 | 50 |
| 蕾冠王 | Frozen Peaks | minecraft | 任意 | 地面 | 无 | 1 |
| 灵幽马 | Soul Sand Valley | minecraft | 夜晚 | 地面 | 无 | 30 |
| 雪暴马 | Ice Spikes | minecraft | 任意 | 地面 | 无 | 30 |
| 蕾冠王（骑白马） | Ice Spikes | minecraft | 任意 | 地面 | 无 | 1 |
| 蕾冠王（骑黑马） | Soul Sand Valley | minecraft | 夜晚 | 地面 | 无 | 1 |
| 爱管侍 | Flower Forest | minecraft | 白天 | 地面 | 晴天 | 1 |

### 第九代

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 故勒顿 | Badlands | minecraft | 白天 | 地面 | 无 | 10 |
| 密勒顿 | Savanna Plateau | minecraft | 任意 | 空中 | 无 | 10 |
| 古简蜗 | Stony Shore | minecraft | 任意 | 地面 | 无 | 30 |
| 古简蜗（头盔形态） | Dripstone Caves | minecraft | 任意 | 地下 | 无 | 10 |
| 冻光蛾 | Frozen Peaks | minecraft | 夜晚 | 地面 | 无 | 30 |
| 冻光蛾（头盔形态） | Ice Spikes | minecraft | 夜晚 | 地面 | 无 | 10 |
| 够赞狗 | Meadow | minecraft | 白天 | 地面 | 无 | 30 |
| 够赞狗（头盔形态） | Plains | minecraft | 白天 | 地面 | 无 | 10 |
| 月月熊 | Old Growth Birch Forest | minecraft | 夜晚 | 地面 | 无 | 30 |
| 月月熊（头盔形态） | Dark Forest | minecraft | 夜晚 | 地面 | 无 | 10 |
| 奥格庞 | Lush Caves | minecraft | 任意 | 地下 | 无 | 1 |
| 太乐巴戈斯 | Desert | minecraft | 白天 | 地面 | 无 | 1 |
| 铁头壳 | The End | minecraft | 任意 | 地面 | 无 | 30 |
| 铁武者 | The End | minecraft | 任意 | 地面 | 无 | 30 |
| 铁毒蛾 | The End | minecraft | 任意 | 地面 | 无 | 30 |
| 铁臂膀 | The End | minecraft | 任意 | 地面 | 无 | 30 |
| 铁脖颈 | The End | minecraft | 任意 | 地面 | 无 | 30 |
| 铁大蛇 | The End | minecraft | 任意 | 空中 | 无 | 30 |
| 铁荆棘 | The End | minecraft | 任意 | 地面 | 无 | 30 |
| 铁巨人 | The End | minecraft | 任意 | 地面 | 无 | 10 |

## 特殊纹理宝可梦

以下传说宝可梦拥有特殊纹理变体，生成条件与普通形态不同。

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 急冻鸟（伽勒尔） | Frozen Peaks | minecraft | 夜晚 | 地面 | 无 | 50 |
| 闪电鸟（伽勒尔） | Badlands | minecraft | 白天 | 空中 | 无 | 50 |
| 火焰鸟（伽勒尔） | Dark Forest | minecraft | 夜晚 | 空中 | 无 | 50 |
| 雷公（洗翠形态） | Taiga | minecraft | 任意 | 地面 | 雷暴 | 50 |
| 炎帝（洗翠形态） | Crimson Forest | minecraft | 任意 | 地面 | 无 | 50 |
| 水君（洗翠形态） | Frozen River | minecraft | 任意 | 水面 | 无 | 50 |
| 龙卷云（灵兽形态） | Plains | minecraft | 任意 | 空中 | 雷暴 | 10 |
| 雷电云（灵兽形态） | Savanna | minecraft | 任意 | 空中 | 雷暴 | 10 |
| 土地云（灵兽形态） | Sparse Jungle | minecraft | 任意 | 空中 | 无 | 10 |
| 眷恋云（灵兽形态） | Flower Forest | minecraft | 白天 | 空中 | 无 | 10 |

## 异兽

异兽（Ultra Beast）的生成条件。

| 宝可梦 | 生物群系 | ModID | 时间 | 位置 | 条件 | 稀有度 |
|---|---|---|---|---|---|---|
| 虚吾伊德 | Deep Dark | minecraft | 任意 | 地下 | 无 | 50 |
| 爆肌蚊 | Jungle | minecraft | 白天 | 地面 | 无 | 50 |
| 费洛美螂 | Flower Forest | minecraft | 白天 | 地面 | 无 | 50 |
| 电束木 | Savanna Plateau | minecraft | 任意 | 地面 | 雷暴 | 50 |
| 铁火辉夜 | The End | minecraft | 任意 | 空中 | 无 | 50 |
| 纸御剑 | Bamboo Jungle | minecraft | 白天 | 地面 | 无 | 50 |
| 恶食大王 | Swamp | minecraft | 夜晚 | 地面 | 无 | 50 |
| 砰头小丑 | Crimson Forest | minecraft | 任意 | 地面 | 无 | 50 |
| 垒磊石 | Stony Peaks | minecraft | 任意 | 地面 | 无 | 50 |
| 奈克洛兹玛（究极形态） | The End | minecraft | 任意 | 地面 | 无 | 1 |

## 薄荷效果表

薄荷（Mint）可以改变宝可梦的性格效果，不改变实际性格。以下为各薄荷的日文名、英文名及效果。

| 薄荷 | 日文名 | 英文名 | 效果（↑提升 / ↓降低） |
|---|---|---|---|
| 寂寞薄荷 | さみしがりミント | Lonely Mint | ↑攻击 / ↓防御 |
| 固执薄荷 | いじっぱりミント | Adamant Mint | ↑攻击 / ↓特攻 |
| 顽皮薄荷 | やんちゃミント | Naughty Mint | ↑攻击 / ↓特防 |
| 勇敢薄荷 | ゆうかんミント | Brave Mint | ↑攻击 / ↓速度 |
| 大胆薄荷 | ずぶといミント | Bold Mint | ↑防御 / ↓攻击 |
| 淘气薄荷 | わんぱくミント | Impish Mint | ↑防御 / ↓特攻 |
| 乐天薄荷 | のうてんきミント | Lax Mint | ↑防御 / ↓特防 |
| 悠闲薄荷 | のんきミント | Relaxed Mint | ↑防御 / ↓速度 |
| 内敛薄荷 | ひかえめミント | Modest Mint | ↑特攻 / ↓攻击 |
| 慢吞薄荷 | おっとりミント | Mild Mint | ↑特攻 / ↓防御 |
| 马虎薄荷 | うっかりやミント | Rash Mint | ↑特攻 / ↓特防 |
| 冷静薄荷 | れいせいミント | Quiet Mint | ↑特攻 / ↓速度 |
| 温和薄荷 | おだやかミント | Calm Mint | ↑特防 / ↓攻击 |
| 温顺薄荷 | おとなしいミント | Gentle Mint | ↑特防 / ↓防御 |
| 慎重薄荷 | しんちょうミント | Careful Mint | ↑特防 / ↓特攻 |
| 浮躁薄荷 | なまいきミント | Sassy Mint | ↑特防 / ↓速度 |
| 胆小薄荷 | おくびょうミント | Timid Mint | ↑速度 / ↓攻击 |
| 急躁薄荷 | せっかちミント | Hasty Mint | ↑速度 / ↓防御 |
| 爽朗薄荷 | ようきミント | Jolly Mint | ↑速度 / ↓特攻 |
| 天真薄荷 | むじゃきミント | Naive Mint | ↑速度 / ↓特防 |
| 认真薄荷 | まじめミント | Serious Mint | 无变化（均衡） |
