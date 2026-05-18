---
title: 请求拦截器实现原理
date: 2026-04-13
description: 以 Axios 拦截器为例，剖析"请求拦截器后注册先执行、响应拦截器先注册先执行"背后的链式结构：unshift 与 push 如何拼出 Promise 链，以及为什么这种设计能同时支持解耦、异步与错误捕获。
category: 网络
tags: [Axios, 拦截器, Promise, 设计模式, HTTP]
lang: zh
draft: false
---

```javascript
class Axios {
  constructor() {
    this.interceptors = {
      request: new InterceptorManager(),
      response: new InterceptorManager()
    };
  }

  request(config) {
    // 1. 初始执行链：中间是实际发送请求的方法，undefined 是为了占位
    //    （Promise.then 需要成对的成功/失败回调）
    const chain = [this.dispatchRequest.bind(this), undefined];

    // 2. 将请求拦截器 插入到链的前面 (Unshift)
    // 顺序：[req拦截器2, req失败2, req拦截器1, req失败1, dispatchRequest, undefined]
    this.interceptors.request.handlers.forEach(interceptor => {
      chain.unshift(interceptor.fulfilled, interceptor.rejected);
    });

    // 3. 将响应拦截器 插入到链的后面 (Push)
    // 顺序：[..., dispatchRequest, undefined, res拦截器1, res失败1, res拦截器2, res失败2]
    this.interceptors.response.handlers.forEach(interceptor => {
      chain.push(interceptor.fulfilled, interceptor.rejected);
    });

    // 4. 核心：开启 Promise 链式调用
    let promise = Promise.resolve(config);
    while (chain.length) {
      // 每次取出两个（一个成功回调，一个失败回调）
      promise = promise.then(chain.shift(), chain.shift());
    }

    return promise;
  }

  dispatchRequest(config) {
    console.log("正在发送真正的网络请求...", config);
    return { data: "服务器返回的数据" };
  }
}

// 拦截器管理器
class InterceptorManager {
  constructor() {
    this.handlers = [];
  }
  use(fulfilled, rejected) {
    this.handlers.push({ fulfilled, rejected });
  }
}
```

## 拦截器的执行顺序

这是一个非常容易混淆的点。由于 request 拦截器是 `unshift`（插到前面），而 response 是 `push`（插到后面），所以：

- **请求拦截器**：后注册的先执行（类似栈）。
- **响应拦截器**：先注册的先执行（类似队列）。

执行流如下：

1. 请求拦截器 2（修改配置）
2. 请求拦截器 1（注入 Token）
3. 实际网络请求（`dispatchRequest`）
4. 响应拦截器 1（格式化数据）
5. 响应拦截器 2（错误统一处理）

## 为什么这么设计？

1. **解耦**：开发者可以把 Token 注入、日志打印、参数加密等逻辑拆分成多个独立的拦截器，互不干扰。
2. **异步支持**：由于使用了 `Promise.then`，如果某个拦截器内部返回一个 Promise（比如需要先异步获取 Token），整条链条会自动等待该异步操作完成后再继续执行。
3. **错误捕获**：`Promise.then(fulfilled, rejected)` 的结构允许任何一个拦截器抛出错误，并被后续的 `rejected` 回调或最后的 `.catch` 捕获。
