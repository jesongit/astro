---
author: Posase
pubDatetime: 2024-12-15T07:45:47Z
title: "「笔记」Golang 学习笔记"
draft: false
tags:
  - Golang
  - 学习笔记
description: "Golang 语言学习笔记，记录基础语法和常用写法"
---


### 导入包
```go
import (
	"fmt"
	"math/rand"
)
import "fmt"
import "math"
```

### 导出名

如果一个名字以大写字母开头，那么它就是已导出的

### 变量
```go
var x int = 3 // 显示定义变量 和对应类型 + 初始化
x := 3  // 隐式定义变量和初始化，只能用于函数内部
x, y := 1, 2 // 定义多个
const Pi = 3.14
```

### 函数
```go
func add(x, y int) int {
    return x + y
}
func test() (x, y int) {
    x = 1
    y = 2
    return // 1, 2
}
test := func() {} // 函数也是值，可以被传递 有点像 js 的多种写法
```

### 类型
- 整数：`int` `int8~int16` `uint` `uint8~uint64`
- 浮点数: `float32` `float64`
- 复数：`complex64` `complex128`
- 字符串: `string`
- 布尔值：`bool`
- 字符：`byte`(一个字节,等于`uint8`) `rune`(一个Unicode字符,等于`int32`)

**类型转换**：`var i int = 42` `var f float64 = float64(i)`

### 循环
```go
for i := 0; i < 10; i++ { // 初始化，条件表达式，后置语句 都可以省略 大括号必须要
    // todo
}
for i < 10 {} // 类似 while
for {}  // 无限循环
```

### 条件判断
```go
if i = 1; i < 10 {} // 初始化可省略 大括号必须要

switch i = 1; i { // 类似更便捷的 if else
    case 1 + 1 : 
        fmt.Printf(3)
    case 1:
        fmt.Printf(1)
        fallthrough // 以这个结尾会进入下一个分支，默认直接退出
    case 2:
        fmt.Printf(2)
    default:
        fmt.Printf(0)
}
// 打印 1 2

switch { // 比 if else 更清晰
    case t.Hour() < 12:
		fmt.Println("早上好！")
	case t.Hour() < 17:
		fmt.Println("下午好！")
	default:
		fmt.Println("晚上好！")
}
```
### defer 延迟执行
```go
func main() {
	defer fmt.Println("world1") // 函数最后执行
    defer fmt.Println("world2") // 函数最后执行

	fmt.Println("hello")
}
// hello world2 world1
```
> 可以用于 资源释放 释放锁 关闭文件 处理错误等

### 指针
```go
var p *int
i := 42
p = &i
fmt.Println(*p) // 通过指针 p 读取 i
*p = 21         // 通过指针 p 设置 i
```

### 结构体
```go
type Vertex struct {
	X int
	Y int
}

var v = Vertex{1, 2} // v = Vertex{X:1}, v = Vertex{}
fmt.Println(v.X, v.Y)
p := &v // 结构体指针
fmt.Println(p.X)  // 结构体指针会隐式解引用 不需要写 (*p).X
```

### 数组和切片
```go
var a [10]int // 数组
var s [] int  // 切片 切片类似数组的引用，修改切片时底层数组也会改变 默认值是 nil

s2 = make([]int, 1, 2) // 指定切片长度和容量

len(s2)  // 获取长度 1
cap(s2)  // 获取容量 2 2

s3 = append(s2, 1, 2, 3) // 切片追加元素

for i, v := range s3 {} // 遍历 i 是下标(0开始), v 是值
for _, _ := range s2 {} // 可以忽略不需要的值
```
> 切片的容量会根据数据动态的变化，头部被删会导致容量变小
> 切片可以包含任意类型

### Map
```go
var m map[string]int = {"a": 1} // 不初始化时是 nil
m := make(map[string]int)

type Vertex struct {
	Lat, Long float64
}

var m = map[string]Vertex{
	"Bell Labs": Vertex{40.68433, -74.39967},
	"Google":    {37.42202, -122.08408}, // 顶层只有一个类型名，可以省略 Vertex
}

m["a"] = 2 // 修改
b := m["a"]  // 获取
delete(m, "a") // 删除
elem, is_exist = m["a"] // 双值判断是否存在 不存在时 elem 为该类型默认值
```

### 方法

> go 中没有类，但是可以使用方法更灵活的实现类的功能

```go
// 定义方法 方法只是带接受者的函数
// 注意接收者只能是同一个包里面的类型，所以内置类型不能作为接受者
func (接收者变量 变量类型) 方法名(参数列表) 返回值 {
    // 方法体
}

// 1. 简单示例
type TestStruct struct {
    elem int
}
func (t TestStruct) get() int { // 方法名大小写开头只影响是否导出
    return t.elem
}
func (t *TestStruct) SetElem(newElem int) int {
    t.elem = newElem // 指针类型可以用于修改值
    // 指针通过地址指向该元素，而非指针会复制该元素使用，大型结构体会更高效
}

t := TestStruct
fmt.Printf(t.get())
t.SetElem(2)
// 如果实现一个类似修改值的函数，则需要显式使用指针对应参数类型。SetElem(&t, 2)

// 2. 可以用于实现接口 通过接口可以在多个类型切换，展现多态性
// 定义一个接口 Shape
type Shape interface {
    Area() float64
}

// 定义一个结构体 Circle
type Circle struct {
    Radius float64
}

// 实现接口 Shape 的方法 Area
func (c Circle) Area() float64 {
    return 3.14 * c.Radius * c.Radius
}
var s Shape

// 创建一个 Circle 对象
s = Circle{Radius: 5}
fmt.Println("Circle Area:", s.Area())
```
