---
author: Posase
pubDatetime: 2022-04-08T06:56:11Z
title: "LeetCode 273. 整数转换英文表示"
draft: true
tags:
  - LeetCode
  - 算法
description: "LeetCode 273 题：将非负整数转换为英文表示的解题思路和代码实现"
---


## 描述
将非负整数 num 转换为其对应的英文表示。

## 示例
>**输入：**num = 123  
>**输出：**"One Hundred Twenty Three"
> 
>**输入：**num = 1234567  
>**输出：**"One Million Two Hundred Thirty Four Thousand Five Hundred Sixty Seven"
> **提示：**0 <= n <= 2<sup>31</sup> - 1 

## 代码
```cpp
class Solution {
    private:
        string hd = " Hundred";
        string unit[4] = {" Billion", " Million", " Thousand", ""};
        string n[10] = {"", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"};
        string n1[10] = {"", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"};
        string n2[10] = {"", "Ten", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"};
    public:
        string numberToWords(int num) {
            if(num == 0) return "Zero";

            string ans = "";
            for(int u = 1000000000, i = 0; num != 0; u /= 1000, ++i) {
                ans = parse(num / u, ans, unit[i]);
                num %= u;
            }
            return ans;
        }

        string parse(int num, string head, string unit) {
            // cout << num << "|" << head << "|" << unit << endl;
            int a = num % 10, b = num / 10 % 10, c = num / 100;
            if(a == b && b == c && a == 0) return head;
            head = head == "" ? head : head + " ";
            if(a == 0 && b == 0) return head + n[c] + hd + unit;

            string tmp = "", hundred = c == 0 ? "" : n[c] + hd;
            if(b == 0) tmp = n[a];                  // 01 - 09
            else if(b == 1 && a != 0) tmp = n1[a];  // 11 - 19
            else if(a == 0) tmp = n2[b];            // 10, 20, 30
            else tmp = n2[b] + " " + n[a];          // others
            
            return head + (hundred == "" ? tmp : hundred + " " + tmp) + unit;
        }
};
```

## 来源
[273. 整数转换英文表示](https://leetcode-cn.com/problems/integer-to-english-words/)