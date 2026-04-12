---
author: Posase
pubDatetime: 2023-06-27T02:39:53Z
title: "「笔记」Elixir 学习笔记"
featured: true
draft: false
tags:
  - Elixir
  - 学习笔记
description: "Elixir 语言入门笔记，涵盖基本类型、模式匹配、控制流和二进制位串等核心概念"
---


## 安装 `Elixir`
> [安装教程](https://elixir-lang.org/install.html)

## Shell

终端中键入 `iex`/`iex.bat` 进入 `Shell`

键入两次 `Ctrl + C` 退出 Shell
> 在 `Shell` 中可以非常方便的练习和测试代码

### 使用 `Elixir` 执行脚本
```elixir
# hello.exs
IO.puts("Hello World.")
```

`elixir hello.exs` 执行脚本文件

### 其他命令
```elixir
h trunc/1 # 查看 trunc/1 的帮助

# 一般情况下应该用该形式查询
# 内核模块是自动导入，所以可以不需要模块名
h Kernel.trunc/1

i "hello" # 查看值信息
```

## 基本类型
```elixir
1       # 整型
0x1F    # 整型
1.0     # 浮点
true    # 布尔
:atom   # 原子 / 符号 （代表本身的常量）
"xxx"   # 字符串（二进制串）
[1,2,3] # 列表
{1,2,3} # 元组

# 进制
0b1010      # 10  2进制
0o777       # 511 8进制
0x1F        # 31  16进制

1.0e-10     # 科学计数法
```

### 基础运算
```elixir
# 数字
1 + 2       # 3
5 * 5       # 15
10 / 2      # 5.0
div(10, 2)  # 5 整除
div 10, 2   # 5 可以不用括号
rem 10, 3   # 1 余数
round 3.5   # 4 四舍五入
trunc 3.5   # 3 截取整数

# 列表
[1] ++ [2]  # [1,2] 连接列表
[1] -- [1]  # []

# 字符串
"foo" <> "bar" # "foobar"
```

### 逻辑运算符
```elixir
# and or not 第一个值必须是布尔值
true and false
true or raise("")
false and raise("")
not true

# || && ! 接受任何值,除了 false 和 nil 都是 true
1 || 2      # 1
nil && 1    # nil
! 1         # false

# == != === !== >= <= < >
1 == 1      # true
1 != 1      # false
1 == 1.0    # true
1 === 1.0   # false
```
> 不同类型也可以进行比较 `number < atom < reference < function < port < pid < tuple < map < list < bitstring`

> 注意在 `map` 中，会按键升序比较值，同时整型 < 浮点

### 字符串
> 这里的字符串是 `utf-8` 编码的二进制位串，注意与列表区分
```elixir
# 字符串插值
var = :world
"hello #{var}"          # hello world
"hello
world"                  # hello\nworld 可以直接使用换行
"hello\nworld"          # 也可以使用转义字符
IO.puts("hello world")  # 打印字符串

s = "hellö"
is_binary(s)            # true
byte_size(s)            # 6 占用字节
String.length(s)        # 5 字符串长度
```

### 列表
```elixir
# 可能也会表现出字符串的形式，实际上是列表
[104, 101, 108, 108, 111]
'hello'         # otp 26 前的写法 单引号
~c"hello"

l = [1,2,3]
hd(l)       # 1     取头元素
tl(l)       # [2,3] 取尾列表
```

### 元组
```elixir
# 下标从0开始
t = {:ok, "hello"}
tuple_size(t)           # 2
elem(t, 1)              # "hello"
put_elem(t, 1, "world") # {:ok, "world"}
```

### 使用列表还是元组
列表是以链表的形式存储，所以当连接两个列表时候，需要遍历左边的列表找到尾节点连接

元组是使用连续的内存，可以很方便的访问元素，但是更新或者添加元素会导致重新创建并生成新的元组

但是新元组中的元素不会每次重新创建，会共享未更改的内容以节省内存，元组和列表中的元素也会共享。也只有不可变的特性才可以实现

在计算结构中元素个数时候，如果是常量时间内就能得到结果的则命名为 `size`，如果是线性时间内得到结果的命名为 `length`。例如：`tuple_size`、`byte_size`；`length`、`String.length`


### 类型判断
```elixir
is_boolean(true)    # true
is_boolean(1)       # 除了 true 都是 false

is_integer(1)
is_float(1.0)
is_number(1)

# true 和 false 也是 atom
# true 就是 :true
# 大写开头的变量名也是 atom 如: Hello
is_atom(:atom)

is_function(add)    # 是否是一个函数
is_function(add, 1) # 是否是只有一个参数的函数
```

### 匿名函数
```elixir
add = fn a, b -> a + b end  # 定义一个匿名函数
add.(1, 2)                  # 调用匿名函数 注意有个.
```

## 模式匹配
```elixir
x = 1       # 赋值
1 = x       # 匹配比较 1 = 1 没问题
2 = x       # 此时会报错 2 = 1 报错
x = 2       # 重新赋值
2 = x       # 匹配 2 = 2 没问题
^x = 1      # 强制匹配 2 = 1 报错

# 可以很方便的取出元组的值，个数必须对应
{a, b, c} = {1, 2, 3}

# 当然列表也是可以的
[a, b, c] = [1, 2, 3]
[h | t] = [1, 2, 3] # h = 1, t = [2, 3]

# 如果不关心其中一些值，可以使用 _
[h | _] = [1, 2, 3] # h = 1
```
> 模式匹配的左侧不允许进行函数调用

### 控制流
#### `case`
```elixir
case {1, 2, 3} do
    {4, 5, 6} -> "1"
    {1, x, 3} -> "2"
    _ -> "3"
end
# 2 会匹配到第二个，同时 x 会被赋值 2

# 当然可以使用强制匹配、额外的条件限制
# 子句中的判断不会发生报错，只会匹配失败
x = 1
case 10 of
    ^x -> "1"
    y when y < 1 -> "2"
    y when hd(y) -> "3"
    _ -> "4"
end
# 4

# 匿名函数也可以使用，注意保持所有参数个数一致
f = fn
    x, y when x > 0 -> x + y
    x, y -> x * Y
end
```

#### `cond`
```elixir
# 类似 if else if，注意这里除了 nil 和 false 都是 true
cond do
    2 + 1 == 3 -> "1"
    3 + 1 == 4 -> "2"
    true -> "2"
end
# 2
```

#### `if` 和 `unless`
```elixir
# if 条件是 nil/false 则不执行同时返回 nil，unless 则相反
if true do
    "1"
end
# 1

unless true do
    "1"
end
nil

# 也都支持 else
if false do
    "1"
else
    "2"
end
# 2
```
> 注意在控制流中无法改变外面的变量，需要返回进行重新赋值

## 二进制型、字符串(位串)和字符列表*

### `Unicode` 和 `UTF-8`
`Unicode` 包含了所有字符，每个字符都有对应的码点

`UTF-8` 是一种使用二进制存储 `Unicode` 码点的编码，是一种可变长编码
```elixir
string = "héllo"
String.length(string)   # 5 有5个字符
byte_size(string)       # 6 占6个字节

# 可以使用 ? 查看字符对应的码点
?a # 97

# 可连接一个 <<0>> 查看对应的二进制位串
"hełło" <> <<0>>    # <<104, 101, 197, 130, 197, 130, 111, 0>>
# 或者使用 IO.inspect/2 查看
IO.inspect("hełło", binaries: :as_binaries) # <<104, 101, 197, 130, 197, 130, 111>>
```

### 二进制型和位串