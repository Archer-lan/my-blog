---
title: 实现一个并发请求队列
date: 2024-10-12
description: 通过递归调度控制最大并发数的请求队列实现，每个任务完成后立即拉起下一个，所有任务完成后 resolve 全量结果。
category: 算法
tags: [JavaScript, Promise, 并发控制]
lang: zh
draft: false
---

```javascript
function creator(count) {
  // fn: () => Promise
  return setup;
}

async function setup(arr, count) {
  let index = 0;
  let activeCount = 0;
  const resArr = [];
  return new Promise((resolve, reject) => {
    async function requst() {
      let i = index++;
      try {
        let res = await arr[i]();
        resArr[i] = res;
      } catch (e) {
        resArr[i] = e;
      } finally {
        activeCount++;
        if (activeCount === arr.length) {
          resolve(resArr);
        }
        if (activeCount < arr.length) {
          requst();
        }
      }
    }
    for (let i = 0; i < count; i++) {
      requst();
    }
  });
}

function fn() {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(1);
      resolve(1);
    }, 2000);
  });
}

setup([fn, fn, fn, fn], 2);
```
