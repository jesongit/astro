---
author: Posase
pubDatetime: 2022-05-12T09:09:48Z
title: "「笔记」C# 笔记"
draft: false
tags:
  - C#
  - 学习笔记
description: "C# 入门笔记，涵盖字符串操作、数值类型、分支循环和泛型列表等基础语法"
---


## Hello World
> [来源](https://docs.microsoft.com/zh-cn/dotnet/csharp/tour-of-csharp/tutorials/hello-world)
```c#
Console.WriteLine("Hello World!");

// 打印变量
string name = "Name";
Console.WriteLine("Hello " + name);
Console.WriteLine($"Hello {name}.");

name.Length // 字符串长度

// 去掉前面空格
string trimmedGreeting = greeting.TrimStart();
Console.WriteLine($"[{trimmedGreeting}]");
// 去掉尾部空格
trimmedGreeting = greeting.TrimEnd();
Console.WriteLine($"[{trimmedGreeting}]");
// 都去掉
trimmedGreeting = greeting.Trim();
Console.WriteLine($"[{trimmedGreeting}]");


// 字符串替换
// Hello World => Greetings World
string sayHello = "Hello World!";
Console.WriteLine(sayHello);
sayHello = sayHello.Replace("Hello", "Greetings");
Console.WriteLine(sayHello);

// 是否包含某字符串
string songLyrics = "You say goodbye, and I say hello";
Console.WriteLine(songLyrics.Contains("goodbye"));      // True
Console.WriteLine(songLyrics.Contains("greetings"));    // False
// 是否以什么开头、结尾 StartsWith 和 EndsWith
```

## 整数和浮点数
```c#
// int 上下限 其他类型同理
int max = int.MaxValue;
int min = int.MinValue;

// decimal 类型
// decimal 类型的范围较小，但精度高于 double
decimal c = 1.0M;
decimal d = 3.0M;
// M 是指定为 decimal 类型，否则编译器会认为是 double
```


## 分支与循环
```c#
// || 或； && 与
if (bool) {
    // todo
}

while (bool) {
    // todo
}

do {
    // todo
} while(bool);

for (int i = 0; i < 100; ++i) {
    // todo
}

for (char column = 'a'; column < 'k'; column++) {
  Console.WriteLine($"The column is {column}");
}
```

## 泛型列表
```c#

// 一个字符串列表
var names = new List<string> {"<name>", "Ana", "Felipe"};

// 遍历集合
foreach (var name in names) {
  Console.WriteLine($"Hello {name.ToUpper()}!");
}

name.Count                  // 列表长度
name.Add("A");              // 增加元素
name.Remove("A");           // 删除元素
Console.WriteLine(name[0]); // 取元素

names.IndexOf("A");         // 搜索元素，没有返回 -1
names.Sort();               // 排序

// 其他类型
var nums = new List<int> {1, 2, 3};
```