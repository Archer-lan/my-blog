---
title: "JS 事件循环"
date: 2026-04-07
description: "JavaScript 单线程通过事件循环实现非阻塞;深入宏任务/微任务、async/await、Node 与浏览器差异、Vue/React 的批处理"
category: "JavaScript"
tags: ["事件循环", "宏任务微任务", "异步"]
lang: zh
---

## 一、是什么

首先,`JavaScript` 是一门单线程的语言,意味着同一时间内只能做一件事,但是这并不意味着单线程就是阻塞,而实现单线程非阻塞的方法就是事件循环。

在 `JavaScript` 中,所有的任务都可以分为:

- **同步任务**:立即执行的任务,同步任务一般会直接进入到主线程中执行
- **异步任务**:异步执行的任务,比如 `ajax` 网络请求、`setTimeout` 定时函数等

同步任务与异步任务的运行流程图大致是:同步任务进入主执行栈直接运行,异步任务则放入任务队列等待。

从上面我们可以看到,同步任务进入主线程,即主执行栈,异步任务进入任务队列。主线程内的任务执行完毕为空,会去任务队列读取对应的任务,推入主线程执行。上述过程的不断重复就是事件循环。

## 二、宏任务与微任务

如果将任务划分为同步任务和异步任务并不是那么准确,举个例子:

```javascript
console.log(1)

setTimeout(() => {
  console.log(2)
}, 0)

new Promise((resolve, reject) => {
  console.log('new Promise')
  resolve()
}).then(() => {
  console.log('then')
})

console.log(3)
```

如果按照上面流程图来分析代码,我们会得到下面的执行步骤:

- `console.log(1)`,同步任务,主线程中执行
- `setTimeout()`,异步任务,放到 `Event Table`,0 毫秒后 `console.log(2)` 回调推入 `Event Queue` 中
- `new Promise`,同步任务,主线程直接执行
- `.then`,异步任务,放到 `Event Table`
- `console.log(3)`,同步任务,主线程执行

按照分析,它的结果应该是 `1` => `'new Promise'` => `3` => `2` => `'then'`,但是实际结果是:`1` => `'new Promise'` => `3` => `'then'` => `2`。

出现分歧的原因在于异步任务执行顺序。事件队列其实是一个"先进先出"的数据结构,排在前面的事件会优先被主线程读取。例子中 `setTimeout` 回调事件是先进入队列中的,按理说应该先于 `.then` 中的执行,但是结果却偏偏相反 —— 原因在于异步任务还可以细分为**微任务**与**宏任务**。

### 微任务

一个需要异步执行的函数,执行时机是在主函数执行结束之后、当前宏任务结束之前。

常见的微任务有:

- `Promise.then`
- `MutationObserver`
- `Object.observe`(已废弃;`Proxy` 对象替代)
- `process.nextTick`(Node.js)

### 宏任务

宏任务的时间粒度比较大,执行的时间间隔是不能精确控制的,对一些高实时性的需求就不太符合。

常见的宏任务有:

- script(可以理解为外层同步代码)
- `setTimeout` / `setInterval`
- UI rendering / UI 事件
- `postMessage`、`MessageChannel`
- `setImmediate`、I/O(Node.js)

这时候,事件循环、宏任务、微任务的关系大致是:一个宏任务执行完后,清空所有待执行的微任务,再进入下一个宏任务循环。

按照这个流程,它的执行机制是:

- 执行一个宏任务,如果遇到微任务就将它放到微任务的事件队列中
- 当前宏任务执行完成后,会查看微任务的事件队列,然后将里面的所有微任务依次执行完

回到上面的题目:

```javascript
// 遇到 console.log(1),直接打印 1
// 遇到定时器,属于新的宏任务,留着后面执行
// 遇到 new Promise,这个是直接执行的,打印 'new Promise'
// .then 属于微任务,放入微任务队列,后面再执行
// 遇到 console.log(3) 直接打印 3
// 本轮宏任务执行完毕,现在去微任务列表查看是否有微任务,
// 发现 .then 的回调,执行它,打印 'then'
// 当一次宏任务执行完,再去执行新的宏任务,
// 这里就剩一个定时器的宏任务了,执行它,打印 2
```

## 三、async 与 await

`async` 是异步的意思,`await` 则可以理解为 `async wait`。所以可以理解 `async` 就是用来声明一个异步方法,而 `await` 是用来等待异步方法执行。

### async

`async` 函数返回一个 `promise` 对象,下面两种方法是等效的:

```javascript
function f() {
  return Promise.resolve('TEST');
}

// asyncF is equivalent to f!
async function asyncF() {
  return 'TEST';
}
```

### await

正常情况下,`await` 命令后面是一个 `Promise` 对象,返回该对象的结果。如果不是 `Promise` 对象,就直接返回对应的值:

```javascript
async function f() {
  // 等同于 return 123
  return await 123;
}
f().then(v => console.log(v)); // 123
```

不管 `await` 后面跟着的是什么,`await` 都会阻塞后面的代码:

```javascript
async function fn1() {
  console.log(1)
  await fn2()
  console.log(2) // 阻塞
}

async function fn2() {
  console.log('fn2')
}

fn1()
console.log(3)
```

上面的例子中,`await` 会阻塞下面的代码(即加入微任务队列),先执行 `async` 外面的同步代码,同步代码执行完,再回到 `async` 函数中,再执行之前阻塞的代码。

所以上述输出结果为:`1`、`fn2`、`3`、`2`。

## 四、流程分析

通过对上面的了解,我们对 `JavaScript` 各种场景的执行顺序有了大致的了解。这里直接上代码:

```javascript
async function async1() {
  console.log('async1 start')
  await async2()
  console.log('async1 end')
}
async function async2() {
  console.log('async2')
}
console.log('script start')
setTimeout(function () {
  console.log('settimeout')
})
async1()
new Promise(function (resolve) {
  console.log('promise1')
  resolve()
}).then(function () {
  console.log('promise2')
})
console.log('script end')
```

分析过程:

1. 执行整段代码,遇到 `console.log('script start')` 直接打印结果,输出 `script start`
2. 遇到定时器,它是宏任务,先放着不执行
3. 遇到 `async1()`,执行 `async1` 函数,先打印 `async1 start`,下面遇到 `await` 怎么办?先执行 `async2`,打印 `async2`,然后阻塞下面代码(即加入微任务列表),跳出去执行同步代码
4. 跳到 `new Promise` 这里,直接执行,打印 `promise1`,下面遇到 `.then()`,它是微任务,放到微任务列表等待执行
5. 最后一行直接打印 `script end`,现在同步代码执行完了,开始执行微任务,即 `await` 下面的代码,打印 `async1 end`
6. 继续执行下一个微任务,即执行 `then` 的回调,打印 `promise2`
7. 上一个宏任务所有事都做完了,开始下一个宏任务,就是定时器,打印 `settimeout`

所以最后的结果是:`script start`、`async1 start`、`async2`、`promise1`、`script end`、`async1 end`、`promise2`、`settimeout`。

---

## 五、进阶:浏览器与 Node.js 的环境差异

前面的流程分析主要基于浏览器 Event Loop;在 Node.js 中,事件循环底层由 **libuv** 驱动,任务调度会有差异。

### Node.js 的事件循环阶段

Node.js 的事件循环分为 6 个阶段:

- Timers
- Pending callbacks
- Idle/prepare
- Poll
- Check
- Close callbacks

不同类型的"宏任务"会被分配到不同阶段执行。

### `process.nextTick` 的特权

虽然常被拿来和"微任务"一起讨论,但 `process.nextTick` 的优先级**更高**。在当前调用栈清空后、以及任意阶段切换前,Node.js 会优先清空 `nextTick` 队列,再处理其他微任务(如 `Promise.then`)。

### `setImmediate`

Node.js 独有 API,属于 **Check** 阶段的宏任务。如果 `setTimeout(fn, 0)` 和 `setImmediate(fn)` **在同一个 I/O 回调里**同时注册,通常 `setImmediate` 会更先执行。

---

## 六、进阶:UI 渲染与 `requestAnimationFrame`

### UI 渲染的触发时机

一般而言:

- 同步代码执行完
- 且当前轮产生的**微任务全部清空**
- 浏览器才会视情况进行 UI 渲染(与屏幕刷新率相关,常见 60Hz ≈ 16.6ms)

渲染通常发生在**下一次宏任务开始之前**。

### `requestAnimationFrame`(rAF)

rAF 回调既不等同于常规宏任务、也不等同于微任务。规范语义:回调会尽量安排在**下一次重绘之前**执行,以便动画更新与刷新率同步,降低丢帧风险。

---

## 七、历史防坑点:V8 对 `await` 的优化

在第四部分流程分析里,结论是 `async1 end` 会在 `promise2` 之前打印,这是现代环境的标准行为。但在旧环境中,结果可能不同。

- **早期实现**:老版本 V8(如 Node 8、更早的 Chrome)对 `await` 的实现会产生额外的 Promise 包装,导致 `await` 之后的代码被推迟到更靠后的微任务时机;可能出现 `promise2` 先于 `async1 end`。
- **现代优化**:后续 V8 针对 async/await 与 Promise 做了性能与调度优化(减少 Promise 创建等),才稳定为现在常见的顺序。

---

## 八、实际落地:前端框架中的 Event Loop

### Vue:异步更新与 `nextTick`

Vue 对 DOM 更新做了**异步批处理**:频繁的响应式变更不会立刻同步更新 DOM,而是将相关 Watcher 推入队列并去重。队列的调度通常优先使用**微任务**(如 `Promise.then` / `MutationObserver`),必要时才降级到宏任务(如 `setTimeout`)。

因此 `Vue.nextTick()` 的语义可以理解为:把回调安排在**本轮 DOM 更新完成之后**尽快执行。

### React:批处理(Batching)

React 同样会合并多次状态更新,减少不必要的重复渲染。在 React 18 引入自动批处理与并发能力后,对任务调度(包含微任务/宏任务时机)的利用更明显,以提升整体吞吐与交互体验。
