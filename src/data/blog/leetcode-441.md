---
author: Posase
pubDatetime: 2022-04-08T06:22:56Z
title: "LeetCode 441. 排列硬币"
draft: true
tags:
  - LeetCode
  - 算法
description: "LeetCode 441 题：计算硬币阶梯排列的完整行数的解题思路和代码实现"
---


## 描述

你总共有 n 枚硬币，并计划将它们按阶梯状排列。对于一个由 k 行组成的阶梯，其第 i 行必须正好有 i 枚硬币。阶梯的最后一行 可能 是不完整的。

给你一个数字 n ，计算并返回可形成**完整阶梯行**的总行数。

## 示例

![](https://assets.leetcode.com/uploads/2021/04/09/arrangecoins1-grid.jpg)

> **输入：**n = 5  
> **输出：**2  
> **解释：**第三行不完整, 所以返回 2  
> **提示：**1 <= n <= 2<sup>31</sup> - 1 

## 思路
假设有 k 行，则有 (1 + 2 + ... + k) = （1 + k) * k / 2 个硬币，即 (1 + x) * x = 2n

解一元二次方程得 x = sqrt(2n - &frac14;) - &frac12;

注意精度损失问题, 例如 n = 6 算出来却是 2, 使 n + 1 避免此问题

## 代码
```cpp
class Solution {
public:
    int arrangeCoins(int n) {
        // sqrt(2 * (n + 1) - 0.25) - 0.5 = sqrt(2n + 1.75) - 0.5
        return (int)(sqrt((double)n * 2.0 + 1.75) - 0.5);
    }
};
```

## 来源
[441. 排列硬币](https://leetcode-cn.com/problems/arranging-coins/)