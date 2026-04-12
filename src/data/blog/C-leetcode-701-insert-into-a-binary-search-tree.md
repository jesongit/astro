---
author: Posase
pubDatetime: 2022-04-10T15:44:15Z
title: "「LeetCode」701. 二叉搜索树中的插入操作"
draft: true
tags:
  - LeetCode
  - 算法
description: "LeetCode 701 题：二叉搜索树插入操作的解题思路和代码实现"
---


## 描述
给定二叉搜索树（BST）的根节点 root 和要插入树中的值 value ，将值插入二叉搜索树。  
返回插入后二叉搜索树的根节点。 输入数据 **保证** ，新值和原始二叉搜索树中的任意节点值都不同。

**注意**，可能存在多种有效的插入方式，只要树在插入后仍保持为二叉搜索树即可。 你可以返回 **任意有效的结果** 。

## 输入
![](https://assets.leetcode.com/uploads/2020/10/05/insertbst.jpg)
>**输入：**root = [4,2,7,1,3], val = 5  
>**输出：**[4,2,7,1,3,5]
>**解释：**另一个符合要求的树是：  
>![](https://assets.leetcode.com/uploads/2020/10/05/bst.jpg)

## 代码
```python
# 正常的二叉树插入。。。
# Definition for a binary tree node.
# class TreeNode:
#     def __init__(self, val=0, left=None, right=None):
#         self.val = val
#         self.left = left
#         self.right = right
class Solution:
    def insert(self, node: TreeNode, val: int):
        if node.val < val:
            if node.right == None:
                node.right = TreeNode(val)
                return
            else:
                self.insert(node.right, val)
        else:
            if node.left == None:
                node.left = TreeNode(val)
                return
            else:
                self.insert(node.left, val)
    def insertIntoBST(self, root: TreeNode, val: int) -> TreeNode:
        if root == None: return TreeNode(val)
        self.insert(root, val)
        return root
```

## 来源
[701. 二叉搜索树中的插入操作](https://leetcode-cn.com/problems/insert-into-a-binary-search-tree/)