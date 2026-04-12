---
author: Posase
pubDatetime: 2023-03-25T17:21:24Z
modDatetime: 2023-12-22T15:47:44Z
title: "Erlang 学习笔记"
draft: false
tags:
  - Erlang
  - 学习笔记
description: "Erlang 语言入门学习笔记，涵盖安装、基础语法、数据类型和常用模块"
---


## 开始

- 安装：[官方下载](https://www.erlang.org/downloads)
    - `scoop install erlang`
    - `apt install erlang`
    - Windows 注意环境变量的配置
- 建议：[编码规范](https://www.erlang.org/eeps)
- 参考书籍：`Erlang` 趣学指南

### 函数式编程
- 不可变的变量：定义了就不能改变
    - 引用透明
    - 没有副作用
    - 多线程不共享状态，不会出现死锁，适合并发
    - 使用递归，没有循环语句(for/while 都需要可变状态进行循环)
- 尾调用和尾递归
- 高阶函数：参数或返回值为函数的函数，复用粒度更低
- 模式匹配

```python
# 不可变类似学过的数学变量
y = 2
x = y + 3
x = 5
x = x + 1 # ???
5 = 6     # ???

# 尾递归 累加 1-n 伪代码，Tips: Python 没有尾递归优化
def add(n):
    if n == 1:
        return 1
    else:
        return n + add(n - 1)

def add(n, sum):
    if n == 1:
        return sum + 1
    else:
        return add(n - 1, sum + n)
```

### 其他特点
- `actor` 模型，独立进程，无共享，邮箱通信
    - 进程之间不会影响，每个进程做自己的事情就好了
- 编译字节码，可以在任何环境运行
- 可以在不中断的情况下升级代码，热更新
- 分布式
- let it crash !
    - 强大的伸缩能力，是因为极其轻量的进程
    - 并非不处理错误，监控再用一定的策略处理
    - 监督机制 link/monitor，crash 会起新进程
    - 外界的输入，可以预知的错误，不可恢复的上下文（TCP 连接）

> Erlang 并不是万能的，请根据需求选择合适的工具
> [Let it crash: 因为误解，所以瞎说](https://zhuanlan.zhihu.com/p/25070432)

### Erlang Shell
安装配置好后，在 cmd/shell 键入 `erl` 进入 Erlang Shell

Windows 还有 `werl.exe`，有一个单独的窗口和一些快捷键

内置 Emacs 功能子集 `Ctrl-A/E`（行首/尾），上下切换命令，Tab 补全
```erlang
help().             % 帮助 .表示语句的结束

** shell 内置指令 **
b()                     -- 显示所有定义的变量
e(N)                    -- 重复第N步操作
f()                     -- 释放所有变量
f(X)                    -- 释放指定变量
h()                     -- 历史操作
h(Mod)                  -- help about module
h(Mod,Func)             -- help about function in module
h(Mod,Func,Arity)       -- help about function with arity in module
ht(Mod)                 -- help about a module's types
ht(Mod,Type)            -- help about type in module
ht(Mod,Type,Arity)      -- help about type with arity in module
hcb(Mod)                -- help about a module's callbacks
hcb(Mod,CB)             -- help about callback in module
hcb(Mod,CB,Arity)       -- help about callback with arity in module
history(N)              -- 设置保存之前操作命令的条数  
results(N)              -- 设置保存之前操作结果的条数  
catch_exception(Bool)   -- 设置的执行过程中的异常处理  
v(N)                    -- 使用某次查询的值 <N>  
rd(R,D)                 -- 定义一个 record  
rf()                    -- 移除所有 record  
rf(R)                   -- 移除某个 record  
rl()                    -- 显示所有 record  
rl(R)                   -- 显示某个 record 信息  
rp(Term)                -- 显示某个元组的所有内容  
rr(File)                -- 从一个文件或模块读取 record 定义

** c 模块命令 **  
bt(Pid)    -- 显示一个进程的栈回溯  
c(File)    -- 编译及重新加载模块  
cd(Dir)    -- 改变工作目录  
flush()    -- 刷新信箱（以便shell接收信息）  
help()     -- 帮助信息  
i()        -- 显示系统信息  
ni()       -- 和 i() 一样显示系统信息，还包括网络节点的系统信息  
i(X,Y,Z)   -- 通过 pid <X,Y,Z> 获取某个进程的信息  
l(Module)  -- 加载或重新加载模块  
lc([File]) -- 编译一个列表的 Erlang 模块  
ls()       -- 显示当前工作目录下的文件列表  
ls(Dir)    -- 显示某个目录下的文件列表  
m()        -- 显示已加载进系统的模块  
m(Mod)     -- 显示某个模块信息  
memory()   -- 显示内存分配信息  
memory(T)  -- 显示某项内存分配信息 <T>  
nc(File)   -- 在所有节点编译及加载模块  
nl(Module) -- 在所有节点重新加载模块  
pid(X,Y,Z) -- 通过 pid <X,Y,Z> 获取某个进程 pid  
pwd()      -- 显示当前工作目录  
q()        -- 关闭 erlang shell  
regs()     -- 显示注册过的进程信息  
nregs()    -- 和 regs() 一样显示注册过的进程信息，还包括网络节点的进程信息  
xm(M)      -- 查找某个模块未定义的函数，未使用的函数，已弃用的函数  
y(File)    -- 编译 Yecc 文件(.yrl)  

** i 模块命令  **  
ih()       -- 显示 i 模块的帮助信息

%% Ctrl + G 可以切换 job，再按 h 显示下面的内容
User switch command
--> h
c [nn]              - 连接到一个 job
i [nn]              - 中断 job 运行
k [nn]              - 终止 job
j                   - 查看所有 job
s [shell]           - 启动一个本地 shell
r [node [shell]]    - 启动一个远程 shell
q                   - 退出 shell
? | h               - 显示帮助
-->
```
> 可以直接 `Ctrl-C` 两次快速退出 `Shell`

> 键入 `io:format("hello world~n").`，回车会打印一个 `hello world`

## 数值类型

```erlang
%% 百分号后面是注释
%% 数值 Erlang 并不关心输入的数字类型，都可以进行运算
2 + 15.     % 17
5 / 2.      % 2.5
5 div 2.    % 2 整除
5 rem 2.    % 1 余数

%% Base#Value  Base进制的数
2#101010.   % 42
8#0677.     % 447
16#AE.      % 174
```

### 不变的变量
`Erlang` 变量名由字母、下划线、数字组成，以大写字母或下划线开头

只能赋值一次（绑定/定义更合适），下划线开头仅用于不关心值的情况

除了第一次绑定变量，其他情况都视为 `模式匹配`

```erlang
One = 1.
Two = One + One.
One = One. % 没问题
One = Two. % 报错
```

### 原子
原子是以小写字母开头，或者用单引号包裹的字面量
所见即所得，一个原子的值就是他本身，一个不可变的常量
使用原子的速度非常快，但是原子表不会被回收，所以不要动态创建原子
同时有一些保留字 `after`、`and`、`andalso`、`band`、`begin`、`bnot`、`bor`、`bsl`、`bsr`、`bxor`、`case`、`catch`、`cond`、`div`、`end`、`fun`、`if`、`let`、`not`、`of`、`or`、`orelse`、`query`、`receive`、`rem`、`try`、`when` 和 `xor`

### 操作符
```erlang
%% 布尔操作符
true and false.     % false 两边都会求值
true andalso false. % false 短路运算，如果左边为 false 直接得到 false
true or false.      % true 两边都会求值
true orelse false.  % true 短路运算
not true.           % false
true xor false      % true 亦或

%% 位操作符
bsl                 % 左移
bsr                 % 右移
band                % 按位和
bor                 % 按位与
bxor                % 按位异或
bnot                % 按位非

%% 其他操作符 建议始终使用 =:= 和 =/=
1.0 =:= 1.          % true 全等，会比较类型和值
1.0 == 1.           % true 相等，仅比较值
1.0 =/= 1.          % false
1.0 == 1.           % true
%% 另外还有 >、<、>=、=<(注意这个)
```
> 数据类型大小顺序：`number` < `atom` < `reference` < `fun` < `port` < `pid` < `tuple` < `list` < `bit string`

### 元组和列表
列表是以链表的形式存储，所以当连接两个列表时候，需要遍历左边的列表找到尾节点连接

元组是使用连续的内存，可以很方便的访问元素，但是更新或者添加元素会导致重新创建并生成新的元组

但是新元组中的元素不会每次重新创建，会共享未更改的内容以节省内存，元组和列表中的元素也会共享。也只有不可变的特性才可以实现

在计算结构中元素个数时候，如果是常量时间内就能得到结果的则命名为`size`，如果是线性时间内得到结果的命名为`length`。例如：`tuple_size`, `byte_size`; `length`, `String.length`

> 参考自 [Elixir 笔记](./%E3%80%8C%E7%AC%94%E8%AE%B0%E3%80%8DElixir-%E5%AD%A6%E4%B9%A0%E7%AC%94%E8%AE%B0.md)

```erlang
%% 其中的值可以是任意类型
{1, 2}. % 元组
[1, 2]. % 列表

Pos = {1, 2}.
{X, Y} = Pos.           % 模式匹配取值
{_, Y} = Pos.           % _ 可以匹配任何值，忽略不关心的值
element(1, Pos).        % 1 获取指定位置值
setelement(1, Pos, 2).  % {2, 2} 改变指定位置值并返回新的元组
```

```erlang
A = [1].
B = [1, 2].
List = [1, 2, 3].
[97, 98, 99].           % "abc" 字符串，只有存在非字符的值才会打印原列表
A ++ B.                 % [1, 1, 2] 注意是右结合，从右往左算
B -- A.                 % [2] 小列表在前，性能更高

%% 取头元素和尾列表
hd(List).               % 1
tl(List).               % [2, 3]

%% 通常使用 | 可以非常简便的取元素或者构造列表
[H | T] = List.         % H = 1, T = [2, 3]
L = [1, 2 | List].      % [1, 2, 1, 2, 3]
L = [1 | [2 | List]].   % [1, 2, 1, 2, 3]


[X * 2 || X <- List].               % [2, 4, 6] 列表推导式
[X * 2 || X <- List, X rem 2 == 0]. % [4] 带条件的推导式，这里过滤后只有留下了偶数
[X + Y || X <- [1, 2], Y - [3, 4]]. % [4, 5, 5, 6] 可以使用多个推导式
[X || {X, 1} <- [{2, 1}, {3, 2}]].  % [2] 可以通过模式匹配来过滤结果
```
> Tips：`hd/1` 这种称为内建函数（`BIF` 函数），通常一些常用操作，为了使操作性能更高使用其他语言实现

> `|` 操作符称为 `cons` 操作符（构造器），左边可以是任意个元素，右边必须是一个列表，构造后形成一个新的列表

### 二进制数据
`Erlang` 中使用 `<<>>` 来表示二进制数据，区段之间用 `,` 隔开

当然需要一点基础前置知识：`1 Byte（字节）= 8 bit（位）`，以及一些进制转换的知识
```erlang
Bin = <<97, 98, 99>>.      % <<"abc">> 这里 abc 的 ASCII 码分别是 97, 98, 99，所以是"abc"
<<200, 210, 220, 0>>.      % 无法识别为正常的字符, 这里就会原样输出了

 %% 上面简单的演示中，每个区段的数字都占用了 8 位的空间，当然也可以手动指定位数
<<1:16, 0:16>>.            % <<0, 1, 0, 0>> 这时候 1 会占 2 字节，不够会补零
<<(16#F09A29):24>>.        % <<240, 154, 41>> 这里 24 位会占 3 个字节 0xf0(240), 0x9a(154), 0x29(41)

%% 同样的，也可以通过模式匹配方便的取到想要的值
<<X, Y:16>> = <<(16#F09A29):24>>.   % X = 240, Y = 39465(0x9a29)
<<X, Rest/binary>> <<1, 2>>.        % 假如只想取第一个字节，可以直接使用这种写法匹配后面所有的值
```
#### 格式
`<<Value:Size/Type, Rest/binary>>`   % 二进制数据可以通过该格式来描述

其中 `Size` 默认是 `8` 位，`Type` 默认是 `integer`

`Type` 可以由多个类型组成，使用 `-` 分割，可能包含下面多个
  - 类型包括 `integer`（默认）、`float`、`binary`（`bytes`）、`bitstring`（`bits`）、`utf8`、`utf16`、`utf32`
  - 符号类型包括 `signed`、`unsigned`（只有类型是 `integer` 才有意义）
  - 字节序包括 `big`（默认）、`little`、`native`（只有当类型是数字时才有意义）
  - 单位：`unit:Integer` 的形式，表示区段大小（1 ~ 256）
    - 对于 `integer`、`float`、`bitstring` 来说默认都是 1
    - 对于 `binary` 来说默认是 8，`utfx` 无需定义
    - `Size * 单位` = 区段所占的位数
```erlang
%% 用不同字节序表示数字 72, native 是根据 CPU 使用的字节序来自动选择
<<72, 0, 0, 0>>.        % 小字节序 
<<0, 0, 0, 72>>.        % 大字节序
```
> 尽管 `Erlang` 可以通过匹配来很方便的处理二进制数据，但是 `Erlang` 历来不擅长处理数值密集型计算操作，但是对于不需要数值计算的应用处理非常快，构建软实时应用会是非常好的选择

#### 二进制字符串
`<<"this is a binary string">>` 这就是二进制字符串

二进制字符串对比前面的列表字符串在空间上更加高效

列表通过链表实现的，而二进制字符串则类似元组是一整块内存

当然缺点是模式匹配的操作方法会比列表麻烦一些
 
通常当所存储的文本无需频繁操作或者空间效率是个实际问题时，才会使用二进制字符串

> 尽管二进制字符串非常轻量，但是不要用来标记数据。`{<<"jack">>, 1}`。在涉及比较操作时候就会在线性时间内比较整个字符串，`{jack, 1}` 使用原子则能在常量时间完成。同样，尽管原子更轻量，但是除了比较，原子无法进行分割、正则等其他任何操作

#### 二进制推导式
```erlang
%% 与列表推导式几乎一模一样，看到这里也知道为什么 =< 才是小于等于了吧
<< <<X>> || <<X>> <= <<1, 2, 3>>, X rem 2 == 0>>.   % <<2>>
[ X || <<X>> <= <<1, 2, 3>>, X rem 2 == 0].         % [2]
<< <<X>> || X <- [1, 2, 3]>>.                       % <<1, 2, 3>>
%% 注意默认情况下，会认为放进来的是 8 位无符号整数
<< <<X/binary>> || X <- [<<1>>, <<2>>, <<3>>] >>.   % 如果不是则要自己指定类型
```

## 模块
模块是具有名字的文件，同时包含一组函数。

通常使用 `Module:Function(Args)` 的方式调用函数

> 前面使用的 `hd/1`、`element/2` 都是 `erlang` 模块下的函数，会自动引入所以无需 `Module`

```erlang
%%% 一般文件头的概况性注释使用三个百分号
%%% 文件名: test.erl
-module(test).                  % 定义一个模块
-import(lists, [sum/1, seq/2]). % 引入一个模块的函数
-author(posase).                % 作者，可忽略
%% 引入后就可以直接调用了，但是当两个模块有重名函数就会有问题，所以不建议使用
%% 另外会降低代码的可读性，无法直接看出函数是内部函数还是外部函数

%% 单独一行的注释使用两个百分号，同时与代码使用相同的缩进
%% 下面的行内注释使用一个百分号
-export([       % 定义一些导出的函数 即本模块的接口
    add/2,      % 函数名为 add，需要两个参数
    test/0
]).

-define(ONE,        1).     % 宏定义 使用格式：?ONE
-define(HORE,       60*60). % 一小时的秒数
-define(sub(A, B),  A - B). % 定义一个函数也是可以的
%% 另外有一些预定义的宏：?MODULE(模块名)、?FILE(文件名)、?LINE(行号)
%% 还可以根据条件来定义宏 例子如下
%% 下面这个就只有存在 TEST 这个宏时候，调用 debug/1 才会打印
-ifdef(TEST).
-define(debug(S), io:format("debug: ~s~n", [S])).
-else.
-define(debug(S), ok).
-endif.

%% 函数例子
add(A, B) ->    % 实现 add 函数
    A + B.      % 函数最后一行的结果会被返回

add(A, B, C) ->
    A + B + C.

test() ->
    %% 这里的 sum/1 和 seq/2 都是 lists 模块的函数
    {add(1, 1, 1), sum(seq(1, 2))}.
```

### 编译代码
- 在 `cmd` 中可以直接使用 `erlc test.erl` 编译模块
- 在 `Shell` 中可以使用 `compile:file(test).`/`c(test)` 编译模块
- 如果不是同级目录，可以在 `Shell` 中使用 `cd("xxx")` 进入模块文件目录
```erlang
%% 编译完成后可以来调用一下我们写的函数，add/3 因为没有导出无法调用
test:add(1, 1).     % 2
test:test().        % {3, 3}
```

### 不使用 Shell 运行程序
```erlang
%% test.erl
main(Args) ->
    %% todo
    io:format("hello world. ~p~n", [Args]),
    erlang:halt(). % 这个调用会关闭 Erlang VM
%% 终端中
erlc test.erl
erl -noshell -run test main 1
```
#### `escript`
```erlang
#!/usr/bin/env escript
%% -*- erlang -*-
%% ! -pa 'ebin/' [<em> 其他参数 </em>]
%% test.erl
main(Args) ->
    %% todo
    ok.
```
> 可以使用 `./test.erl` 或 `escript test.erl` 像脚本一样运行

#### 编译选项
- `debug_info`: 一些工具需要使用这个选项来工作，建议一直开启
- `{outdir, Dir}`：指定 `.beam` 文件存放路径，默认当前目录
- `export_all`：会将模块所有函数导出，可以在开发中使用，产品严禁使用
- `{d, Macro}/{d, Macro, Value}`：定义一些宏，`Value` 不设置默认是 `true`
> 格式参考：`c(test, [debug_info, export_all]).`

> 模块上也可以指定编译选项，比如：`-compile([debug_info]).`

> 另外使用 `hipe:c/2` 或 `c(Mod, [native]).` 会让程序运行更快
> 因为是直接编译成本地码，无法跨平台，通常不建议使用

### 元数据
可以通过 `Mod:module_info/0` 或 `Mod:module_info/1` 来查看一个模块的元数据
```erlang
%% 比如前面举例的文件 test:module_info().
[{module,test},
 {exports,[{add,2},{test,0},{module_info,0},{module_info,1}]},
 {attributes,[{vsn,[248293221308944576795513279798718263657]},
              {author,[posase]}]},
 {compile,[{version,"8.2.4"},
           {options,[]},
           {source,"d:/Project/hexo/test.erl"}]},
 {md5,<<186,203,136,245,38,249,61,45,112,172,137,19,180,
        136,113,105>>}]
```
> `vsn` 通常用在代码热加载时区分不同版本

### 环形依赖
一定要避免环形依赖，如果模块 `A` 调用了模块 `B`，那么模块 `B` 就不应该调用模块 `A`

## 函数
在 `Erlang` 中可以通过模式匹配来实现函数的重载

每一个函数声明称为一个函数子句，必须用 `;` 隔开，最后一个以 `.` 结尾
```erlang
%% io:format/2是打印函数，这里就不过多介绍
print(a, A) -> % 第二个参数会自动绑定到 A
    io:format("a: ~p~n", [A]);  % 中间用分号隔开
print(b, B) -> % 第二个参数会自动绑定到 B
    io:format("b: ~p~n", [B]);
print({c, C}, D) -> % 元组等也是可以匹配的
    io:format("~p: ~p~n", [C, D]).

%% 当然，一个变量仍然只能绑定一次，比如下面函数可以判断两个数是否相等
same(X, X) ->
    true;
same(_, _) ->
    false.

%% 常用来过滤或验证指定结构
print_date({{Y, M, D}, {H, Min, S}}) ->
    io:format("~p-~p-~p ~p:~p:~p~n", [Y, M, D, H, Min, S]);
print_date(_) ->
    ok.

%% 还可以实现尾递归, 列表求和
sum([], Sum) ->
    Sum;
sum([H | T], Sum) ->
    sum(T, Sum + H).
```

### 卫语句
**卫语句** 是附加在函数头的语句，让模式匹配更具表达力
```erlang
%% 假设功能是判断一个整数否处于 0 ~ 3 之间，通过前面学习的可以得到
valid(1) -> true;
valid(2) -> true;
valid(_) -> false.

%% 使用卫语句可以表示为
valid(N) when N > 0, N < 3 -> true;
valid(_) -> false.

```
> 逻辑运算符和算术运算符包括 `BIF` 函数都可以使用，除了用户自定义函数

> 在卫表达式中，`,` 和 `and` 类似；`;` 和 `or` 类似
#### 一些区别
- 前者卫语句中的报错会忽略，例如：`A; B` 中 `A` 报错 `B` 为真仍然可以匹配成功
- 前者无法嵌套使用，后者可以嵌套：`(A and B) or C`

### `if` 表达式
`Erlang` 中的 `if` 语句又称卫模式，从名字不难看出和卫语句其实很类似
```erlang
if 
    A == 1 -> % 类似卫语句的判断条件
        1;
    A == 2 ->
        2;
    true -> 
        3
end.
```
> Erlang 中的表达式一定有返回值，所以需要一个 `true` 保证匹配成功

### `case ... of` 表达式
`case ... of` 更像一个完整的函数，可以进行**模式匹配**和使用**卫语句**
```erlang
%% 假设 {Name, Num} 表示一个人的信息
case Info of
    {jack, 1} ->
        "is_jack";
    {tom, 2} ->
        "is_tom";
    {Atom, N} when is_atom(Atom), is_integer(N) ->
        %% is_atom/1, is_integer/1 请看下一节介绍
        "is_people";
    _ ->
        "is_who"
end.
```
> 函数、`if`、`case ... of` 是使用选择可以基于个人习惯，只要代码保持整洁即可

### 类型
- `Erlang` 是**动态类型语言**，只在运行时候检查类型
    - 得益于基础理念，组件不应该影响整个系统，意料之外的错误也不会导致系统停止
    - **动态类型**也是实现代码热加载最简便的方法
- 同时 `Erlang` 也是**强类型语言**，不会进行隐式的类型转换

> 可以使用 `TypeA_to_TypeB` 类似的函数来进行类型转换

> 可以使用 `is_Type` 类似函数称为类型检测 `BIF`

> 更多 `BIF` 函数，详情可在文档或代码中查看

## 递归
函数式编程中通常没有 `for`/`while` 之类的循环。相反都是使用**递归**实现

 **递归算法**是通过重复将问题分解为同类的子问题而解决问题的方法，在编程中通过函数的自调用实现
 ```erlang
 %% 比如一个斐波那契数列
 fac(0) -> 1;               % 递归需要一个结束的出口
 fac(N) -> N * fac(N - 1).  % 其他都需要通过调用自己实现

 %% 又比如计算列表长度
 len([]) -> 0;
 len([_ | Rest]) -> 1 + len(Rest).
 ```

 ### 尾递归
 首先来分析一下前面正常递归的样子
 ```erlang
 len([1,2,3]) = 1 + len([2, 3]) 
              = 1 + 1 + len([3]) 
              = 1 + 1 + 1 + len([])
              = 1 + 1 + 1 + 0
              = 1 + 1 + 1
              = 1 + 2
              = 3
```
> 因为每一步都依赖下一步的返回，所以即使 `1+1+1+0`，仍然需要一个一个返回相加

如果加一个参数记录当前的结果，传入后面的递归中，其实就不需要再返回处理了
不仅是返回的问题，依赖下一步导致每一步操作都要记录，会占用更多的内存
```erlang
%% 使用尾递归实现计算列表长度
len([], Len) -> Len;
len([_ | Rest], Len) -> len(Rest, Len + 1).
```
> 尾递归不依赖下一步的返回，也就不需要留着当前占用，实际就只会占一次调用的空间

### 其他函数
```erlang
%% 高阶函数 
%% Erlang 中可以直接使用 Mod:Fun/Arity 来绑定一个函数
%% 比如下面例子，文件名 test.erl
-module(test).
-compile(export_all).
one() -> 1.
two() -> 2.

%% 这里就需要传进来两个函数，结果是他们的返回值的和
add(X, Y) -> X() + Y().

%% Shell 中调用
test:add(test:one/1, test:two/1).

%% 匿名函数
F = fun() -> a end. % #Fun<erl_eval.xx.xxx>
F().                % a
```

### 作用域和闭包
**作用域**顾名思义就是变量可以使用的范围。与继承有点类似，函数可以使用函数外定义的，匿名函数可以使用函数内定义的，反过来则不行

**闭包**是将函数内部和函数外部连接起来的桥梁，当匿名函数、作用域和可携带变量的能力组合在一起就是闭包
```erlang
%% 举个例子
base() ->
    A = 1,
    fun(B) -> A + B.

F = base(). % #Fun<...> 返回的是一个匿名函数
F(1).       % 2 通过该子函数使用了 base() 中的 A，称其为闭包
```

## 异常处理

### 异常错误
- 编译期错误，通常是一些语法错误
- 逻辑错误，测试是最好的防御手段
- 运行时错误
  1. 函数/`case`/`if` 子句错误
  2. 匹配错误（一般为函数已经绑定）
  3. 参数错误
  4. 未定义错误
  5. 计算错误（除 0，非数值计算）
  6. 系统限制错误（进程太多、原子太多等）

### 异常类型
包括 `error`、`exit`、`throw`，前两个会导致进程直接退出

当期望处理某个可能发生的异常，可以使用 `throw` 抛出，同时并不会导致进程退出

在大量函数调用、深度递归中，可以将 `throw` 当成返回使用，直接在顶部函数进行捕获，根据抛出信息再进行处理

> `error` 和 `exit` 的区别是，在捕获的情况下，`error` 会有更多的调用栈信息

### 处理异常
```erlang
try F1() of % 捕获 F1() 调用的错误
    _ -> ok % 正常返回的情况
catch
    throw: Throw -> Throw;  % throw 异常
    error: Error -> Error;  % error 异常
    exit: Exit -> Exit      % exit 异常
after                       % after 非必须
    F2()                    % 始终会执行 F2()
end.

%% 当有多个语句的时候可以使用
try
    %% todo 这里可以执行多个语句
    ok
catch
    throw: Throw -> Throw
end.
```
> 被保护部分因为需要捕获异常，是无法进行尾调用优化的；
> 有 `after` 的情况下，即使在 `of` 和 `catch` 的非保护部分仍然无法尾调用优化

```erlang
%% 甚至可以直接使用 catch 捕获异常 catch/1

case catch F() of
    {ok, Data} -> Data;                     % 正常的情况
    Throw when is_atom(Throw) -> Throw;     % throw
    {'EXIT', {Reason, Stack}} -> Reason;    % error
    {'EXIT', Reason} ->                     % exit
end.
```
> `catch/1` 的写法虽然简单，但是也会有一些问题，无法判断是正常的返回还是异常

## 数据结构

### 记录
其实**记录**就是一个元组，只是第一个元素是标记
```erlang
-record(node, { % 定义一个记录，这里是一个节点
    value = 0,  % 节点值
    next        % 下一个节点
}).

Next = #node{value = 2, next = nil}.    % 创建节点
Node = #node{value = 1, next = Next}.
Val = Node#node.value.                  % 读取
Node1 = Node#node{value = 3}.           % 更新
```
> `Shell` 中可以使用 `rr/1` 导入记录，`rd/2` 定义记录，`rf/0` 删除记录，`rl/0` 展示记录

#### 头文件
如果一个记录很多模块使用，可以使用**头文件**共享记录定义，头文件以 `.hrl` 结尾

同时注意使用到的模块需要引入头文件，比如：`-include("record.hrl").`

> 当然尽量避免不同功能的模块直接访问记录，可以提高代码的**可读性**和**可维护性**

### 键值存储
1. 属性列表：处理**小数据量**，使用很少，比较局限
2. 有序字典（orddict）：处理**小数据量**，为避免顺序错误，应该只使用其提供的接口
3. 字典（dict）：处理**大数据量**，接口和**有序字典**完全一致
4. 通用平衡树（gb_trees）：处理**大数据量**，有**智能模式**和简单模式
  - **简单模式**的操作函数：`enter/2`、`lookup/2`、`delete/2`、`delete_any/2`
  - **智能模式**的操作函数：`insert/3`、`get/2`、`update/2`、`delete/2`
  - **智能模式**是区分了已知键值是否存在的情况，从而不执行无用的检查达到更快的执行速度

`dict` 和 `gb_trees` 使用起来基本差不多，通常字典读取性能更好，其他操作 GB 树更快一些

字典有 `fold` 函数，而 GB 树只有 `next/1` 来得到后面的值，意味着只能自己写递归函数遍历

GB 树保留了元素的顺序，有 `smallest/1` 和 `largest/1` 快速获取最大/小元素

### 集合
1. `ordsets`: **有序**集合，适用小集合，最慢但是最容易理解
    - `new/0`、`is_element/2`、`add_element/2`、`del_element/2`、`union/1`、`intersection/1`
2. `sets`：与 `dict` 类似，可以处理更大规模的数据，擅长读密集处理
3. `gb_sets`：底层就是一颗 `gb_trees`，同样拥有**智能模式**和**简单模式**，特性也类似
4. `sofs`：集合的集合，使用有序列表实现，实现数学意义上的集合，而不仅仅是唯一元素时候很有用

> `sets` 和 `gb_sets` 的选择类似 `dict` 和 `gb_trees`，但是注意如果需要使用 `=:=`，则 `sets` 是唯一选择

### 有向图
`digraph` 和 `digraph_utils`，前者实现了构造和修改，后者实现了遍历、检测等功能
> 有需要的时候再深入了解也不失为一个好选择，文档中也非常容易找到相关内容

### 队列
`queue`: `new/0`、`in/2`、`out/1`、`len/1`等
> 使用两个列表实现的**双端队列**

## 并发
并发指在 `VM` 中存在多个独立进程，但是并不要求其同时运行
> 并行则是多个进程存在的情况下同时运行
### 伸缩性
让进程保持**轻量**是实现伸缩性必需的能力，也不必像进程池固定进程，可以需要多少使用多少
`Erlang` 通过禁止共享内存，采用**消息传递机制**的方式来实现并发的可靠性，效率低一点但是更安全
### 容错
得益于**轻量进程**和**消息传递机制**的设计，当出现某个错误可以重启进程，
保证进程继续工作的同时防止错误和坏数据传播。
**分布式**可以实现硬件故障导致的问题，独立的**消息传递机制**可以让进程在不同计算机的工作方式完全一样。
> 进程之间是相互独立的，每个进程只会监听自己的**邮箱**，处理自己的工作，以及向其他进程发消息（尽管他可能并不存在）
### 并发实现
`Erlang` 在自己的 `VM` 中实现 `Erlang` 进程，一个进程仅占用几百字节的空间，创建时间仅几微秒

`VM` 为每个核启动一个线程**调度器**，调度器中有一个**运行队列**，为其中的每个 `Erlang` 进程分一小段时间片。
同时虚拟机会自动进行**负载均衡**，当某个队列任务过多时会迁移到其他队列

### 创建进程
```erlang
Pid = spawn(fun() -> 1 + 1 end).    % <x.xx.x> 返回一个进程标识符（pid）

%% 创建多个进程，观察其是如何运行的
F = fun(N) -> timer:sleep(10), io:format("~p~n", [N]) end.
[spawn(F(N)) || N <- lists:seq(1, 10)].
%% 打印的结果可能每次都不一样，谁也无法保证谁先运行，这就是并发

self(). % 查看当前进程的 pid
exit(). % 再次查看就变了，因为进程被重启了
```
### 发送消息
```erlang
self() ! hello. % hello 给自己发一个消息
%% 返回值就是自己发的消息，所以也可以同时给多个进程发
self() ! self() ! hello.

flush(). % 可以查看收到的消息
```

### 接受消息
```erlang
receive % 使用 receive 可以接受消息，与 case ... of 类似，也可以使用模式匹配和卫语句
    Msg ->
        io:format("receive: ~p~n", [Msg])
end.

receive
    Msg ->
        ok
after 10 -> % 超时时间，毫秒
    %% todo 超时没收到消息会执行的代码段
    ok
end.
```

### 如何回信？
显然，只需要我们将自己的进程标识符也发过去，对方也就可以回信了
```erlang
tom() ->
    receive
        {Pid, Msg} when is_pid(Pid) ->
            Pid ! Msg;
        _Msg ->
            ok
    end.
TomPid = spawn(tom()).
TomPid ! hello.     % 发一个 hello 同时也会收到一个 hello
```
> 简简单单几行代码就轻松实现了并发通信，更多的是需要理解并发逻辑在实际应用中如何处理

### 一个简单的例子
```erlang
%%% 一个可以存取的盒子进程
module(box).
-compile(export_all).

%% 递归实现一直接受和处理消息
box(List) ->
    receive
        {From, {add, Item}} ->
            From ! {self(), ok},
            box([Item | List]);
        {From, {del, Item}} ->
            case lists:member(Item, List) of
                true ->
                    From ! {self(), {ok, Item}},
                    box(lists:delete(Item, List));
                false ->
                    From ! {self(), not_found},
                    box(List)
        stop ->
            ok
        _ ->
            %% 避免无用消息占用邮箱，可以添加日志打印等
            box(List)
    end.

%% 为了方便外部调用，隐藏消息的实现逻辑
add(BoxPid, Item) ->
    BoxPid ! {self(), {add, Item}},
    receive
        {BoxPid, Msg} -> Msg;   % 正常返回
        after 1000 -> timeout   % 超时的情况
    end.

del(BoxPid, Item) ->
    BoxPid ! {self(), {del, Item}},
    receive
        {BoxPid, Msg} -> Msg
        after 1000 -> timeout
    end.

%% 启动一个盒子进程
start() ->
    spawn(?MODULE, box, [[]]).
```
在 `Shell` 中可以使用 `box:start().` 启动盒子进程，使用 `box:add/2` 添加物品，`box:del/2` 删除物品