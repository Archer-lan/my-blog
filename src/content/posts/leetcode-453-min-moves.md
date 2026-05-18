---
title: LeetCode 453 最小操作次数使数组元素相等
date: 2024-09-12
description: n-1 个元素加 1 等价于 1 个元素减 1，最小操作数即为所有元素与最小值之差的累加。
category: 算法
tags: [LeetCode, 数组, 数学]
lang: zh
draft: false
---

累加所有元素与最小元素的差值，即为最小操作数。

> 思路：每次给 n-1 个元素加 1，等价于让 1 个元素减 1。问题转化为把数组所有元素减到最小值需要多少步。

```javascript
var minMoves = function (nums) {
  const minNum = Math.min(...nums);
  let res = 0;
  for (let i of nums) {
    res += i - minNum;
  }
  return res;
};
```
