---
title: LeetCode 215 数组中第K个最大元素
date: 2024-09-10
description: 利用堆排序构建大顶堆求第 K 个最大元素，附顺序存储二叉树的索引公式与 JavaScript 实现。
category: 算法
tags: [LeetCode, 堆排序, 数组]
lang: zh
draft: false
---

## 堆排序

### 顺序存储二叉树

- 第 n 个元素的左子节点为 `2*n+1`
- 第 n 个元素的右子节点为 `2*n+2`
- 第 n 个元素的父节点为 `(n-1)/2`
- 最后一个非叶子节点为 `Math.floor(arr.length/2) - 1`

```javascript
function buildMaxHeap(nums, heapSize) {
  for (let i = Math.floor(heapSize / 2) - 1; i >= 0; i--) {
    maxHeapify(nums, i, heapSize);
  }
}

// 此处构建大顶堆；若构建小顶堆，将 nums[l] > 改为 < 即可
function maxHeapify(nums, i, heapSize) {
  let l = i * 2 + 1;
  let r = i * 2 + 2;
  let largest = i;
  if (l < heapSize && nums[l] > nums[largest]) {
    largest = l;
  }
  if (r < heapSize && nums[r] > nums[largest]) {
    largest = r;
  }
  if (largest !== i) {
    [nums[i], nums[largest]] = [nums[largest], nums[i]];
    maxHeapify(nums, largest, heapSize);
  }
}

buildMaxHeap(nums, nums.length);
let heapSize = nums.length - 1;
for (let i = nums.length - 1; i > 0; i--) {
  [nums[0], nums[i]] = [nums[i], nums[0]];
  --heapSize;
  maxHeapify(nums, 0, heapSize);
}
```

利用堆排序构建大顶堆后，取第 k 个元素即为第 k 大元素。

方法二是直接用快速排序对数组排序后取出。
