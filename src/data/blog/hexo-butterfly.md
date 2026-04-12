---
author: Posase
pubDatetime: 2023-03-10T16:33:03Z
title: "Hexo Butterfly 主题配置"
draft: true
tags:
  - Hexo
  - 博客搭建
  - 学习笔记
description: "Hexo Butterfly 主题的配置笔记，包含 Page/Post 格式、Gallery 相册和标签切换等功能"
---

<!-- [建议删除] 包含大量 Hexo Butterfly 特殊语法（{% tabs %}、{% gallery %}、{% flink %} 等），在 AstroPaper/Astro 中无法正常渲染 -->

> [官方文档](https://butterfly.js.org/)

### Page 格式
```markdown
---
title:	            【必需】页面标题
date:	            【必需】页面创建日期
type:	            【必需】标签、分类和友情链接三个页面需要配置
updated:	        【可选】页面更新日期
description:        【可选】页面描述
keywords:	        【可选】页面关键字
comments:	        【可选】显示页面评论模块(默认 true)
top_img:	        【可选】页面顶部图片
mathjax:	        【可选】显示mathjax(当设置mathjax的per_page: false时，才需要配置，默认 false)
katex:	            【可选】显示katex(当设置katex的per_page: false时，才需要配置，默认 false)
aside:	            【可选】显示侧边栏 (默认 true)
aplayer:	        【可选】在需要的页面加载aplayer的js和css,请参考文章下面的音乐 配置
highlight_shrink:	【可选】配置代码框是否展开(true/false)(默认为设置中highlight_shrink的配置)
---
```

### Post 格式
```markdown
title:	                【必需】文章标题
date:	                【必需】文章创建日期
updated:	            【可选】文章更新日期
tags:	                【可选】文章标签
categories:	            【可选】文章分类
keywords:	            【可选】文章关键字
description:	        【可选】文章描述
top_img:	            【可选】文章顶部图片
cover:	                【可选】文章缩略图(如果没有设置top_img,文章页顶部将显示缩略图，可设为false/图片地址/留空)
comments:	            【可选】显示文章评论模块(默认 true)
toc:	                【可选】显示文章TOC(默认为设置中toc的enable配置)
toc_number:	            【可选】显示toc_number(默认为设置中toc的number配置)
toc_style_simple:	    【可选】显示 toc 简洁模式
copyright:	            【可选】显示文章版权模块(默认为设置中post_copyright的enable配置)
copyright_author:	    【可选】文章版权模块的文章作者
copyright_author_href:	【可选】文章版权模块的文章作者链接
copyright_url:	        【可选】文章版权模块的文章连结链接
copyright_info:	        【可选】文章版权模块的版权声明文字
mathjax:	            【可选】显示mathjax(当设置mathjax的per_page: false时，才需要配置，默认 false)
katex:	                【可选】显示katex(当设置katex的per_page: false时，才需要配置，默认 false)
aplayer:	            【可选】在需要的页面加载aplayer的js和css,请参考文章下面的音乐 配置
highlight_shrink:	    【可选】配置代码框是否展开(true/false)(默认为设置中highlight_shrink的配置)
aside:	                【可选】显示侧边栏 (默认 true)
sticky: 1               【可选】置顶，数字越大优先级越高
```

### Gallery相册

#### 加载本地图片
```markdown
{% gallery [lazyload],[rowHeight],[limit] %}
markdown 图片格式
{% endgallery %}

lazyload	【可选】点击按钮加载更多图片，填写 true/false。默认为 false。
rowHeight	【可选】图片显示的高度，如果需要一行显示更多的图片，可设置更小的数字。默认为 220。
limit	【可选】每次加载多少张照片。默认为 10。
```

#### 加载网络图片
```markdown
{% gallery url,[link],[lazyload],[rowHeight],[limit] %}
{% endgallery %}

url	【必须】 识别词
link	【必须】远程的 json 链接
lazyload	【可选】点击按钮加载更多图片，填写 true/false。默认为 false。
rowHeight	【可选】图片显示的高度，如果需要一行显示更多的图片，可设置更小的数字。默认为 220。
limit	【可选】每次加载多少张照片。默认为 10。
```
#### 网络图片json格式
```json
[
  {
    "url": "https://cdn.jsdelivr.net/gh/jerryc127/CDN/img/IMG_0556.jpg",
    "alt": "IMG_0556.jpg",
     "title": "这是title"
  },
  {
    "url": "https://cdn.jsdelivr.net/gh/jerryc127/CDN/img/IMG_0472.jpg",
    "alt": "IMG_0472.jpg"
  },
  {
    "url": "https://cdn.jsdelivr.net/gh/jerryc127/CDN/img/IMG_0453.jpg",
    "alt": ""
  },
  {
    "url": "https://cdn.jsdelivr.net/gh/jerryc127/CDN/img/IMG_0931.jpg",
    "alt": ""
  }
]
```

### 标签切换
```markdown
{% tabs test1 %}
<!-- tab -->
**This is Tab 1.**
<!-- endtab -->

<!-- tab -->
**This is Tab 2.**
<!-- endtab -->

<!-- tab -->
**This is Tab 3.**
<!-- endtab -->
{% endtabs %}
```
{% tabs test1 %}
<!-- tab -->
**This is Tab 1.**
<!-- endtab -->

<!-- tab -->
**This is Tab 2.**
<!-- endtab -->

<!-- tab -->
**This is Tab 3.**
<!-- endtab -->
{% endtabs %}

### 按钮
```markdown
{% btn 'https://butterfly.js.org/',Butterfly %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right %}
{% btn 'https://butterfly.js.org/',Butterfly,,outline %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,larger %}

{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,block %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,block center larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,block right outline larger %}

{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,blue larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,pink larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,red larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,purple larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,orange larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,green larger %}

居中
<div class="btn-center">
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline blue larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline pink larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline red larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline purple larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline orange larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline green larger %}
</div>
```
{% btn 'https://butterfly.js.org/',Butterfly %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right %}
{% btn 'https://butterfly.js.org/',Butterfly,,outline %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,larger %}

{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,block %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,block center larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,block right outline larger %}

{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,blue larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,pink larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,red larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,purple larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,orange larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,green larger %}

<div class="btn-center">
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline blue larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline pink larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline red larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline purple larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline orange larger %}
{% btn 'https://butterfly.js.org/',Butterfly,far fa-hand-point-right,outline green larger %}
</div>

### 内联图片
```markdown
{% inlineImg [src] [height] %}

[src]      :    图片链接
[height]   ：   图片高度限制【可选】
```
你看我长得漂亮不

![](https://i.loli.net/2021/03/19/2P6ivUGsdaEXSFI.png)

我觉得很漂亮 {% inlineImg https://i.loli.net/2021/03/19/5M4jUB3ynq7ePgw.png 150px %}

### 高亮
```markdown
{% label text color %}
color: default(留空) / blue / pink / red / purple / orange / green
```

### 时间线
```markdown
{% timeline title,color %}
<!-- timeline title -->
xxxxx
<!-- endtimeline -->
<!-- timeline title -->
xxxxx
<!-- endtimeline -->
{% endtimeline %}
```

### 友链列表
```markdown
{% flink %}
- class_name: 友情链接
  class_desc: 那些人，那些事
  link_list:
    - name: JerryC
      link: https://jerryc.me/
      avatar: https://jerryc.me/img/avatar.png
      descr: 今日事,今日毕
    - name: Hexo
      link: https://hexo.io/zh-tw/
      avatar: https://d33wubrfki0l68.cloudfront.net/6657ba50e702d84afb32fe846bed54fba1a77add/827ae/logo.svg
      descr: 快速、简单且强大的网志框架

- class_name: 网站
  class_desc: 值得推荐的网站
  link_list:
    - name: Youtube
      link: https://www.youtube.com/
      avatar: https://i.loli.net/2020/05/14/9ZkGg8v3azHJfM1.png
      descr: 视频网站
    - name: Weibo
      link: https://www.weibo.com/
      avatar: https://i.loli.net/2020/05/14/TLJBum386vcnI1P.png
      descr: 中国最大社交分享平台
    - name: Twitter
      link: https://twitter.com/
      avatar: https://i.loli.net/2020/05/14/5VyHPQqR6LWF39a.png
      descr: 社交分享平台
{% endflink %}
```
{% flink %}
- class_name: 友情链接
  class_desc: 那些人，那些事
  link_list:
    - name: JerryC
      link: https://jerryc.me/
      avatar: https://jerryc.me/img/avatar.png
      descr: 今日事,今日毕
    - name: Hexo
      link: https://hexo.io/zh-tw/
      avatar: https://d33wubrfki0l68.cloudfront.net/6657ba50e702d84afb32fe846bed54fba1a77add/827ae/logo.svg
      descr: 快速、简单且强大的网志框架

- class_name: 网站
  class_desc: 值得推荐的网站
  link_list:
    - name: Youtube
      link: https://www.youtube.com/
      avatar: https://i.loli.net/2020/05/14/9ZkGg8v3azHJfM1.png
      descr: 视频网站
    - name: Weibo
      link: https://www.weibo.com/
      avatar: https://i.loli.net/2020/05/14/TLJBum386vcnI1P.png
      descr: 中国最大社交分享平台
    - name: Twitter
      link: https://twitter.com/
      avatar: https://i.loli.net/2020/05/14/5VyHPQqR6LWF39a.png
      descr: 社交分享平台
{% endflink %}

