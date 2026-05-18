---
title: watch 的实现
date: 2026-04-26
description: 从 traverse 递归读取出发实现基础 watch，再扩展 getter 模式、newValue/oldValue、immediate 与 flush 选项，最后用 onInvalidate 解决异步竞态问题。
category: Vue
tags: [Vue, watch, effect, 响应式]
lang: zh
draft: false
---

`watch` 本质是观测一个响应式数据，当数据变化时通知并执行相应的回调函数。

实际上，`watch` 的实现本质上就是利用了 `effect` 以及 `options.scheduler` 选项，如代码所示：

```javascript
function watch(source, cb) {
  effect(() => {
    traverse(source)
  }, {
    scheduler() {
      // 当 obj.foo 的值变化时，会执行 scheduler 调度函数
      cb()
    }
  })
}

function traverse(value, seen = new Set()) {
  // 如果要读取的数据是原始值，或者已经被读取过了，那么什么都不做
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  // 将数据添加到 seen 中，代表遍历地读取过了，避免循环引用引起的死循环
  seen.add(value)
  // 暂时不考虑数组等其他结构
  // 假设 value 就是一个对象，使用 for...in 读取对象的每一个值，并递归地调用 traverse 进行处理
  for (const k in value) {
    traverse(value[k], seen)
  }

  return value
}
```

`watch` 内部的 `effect` 中调用 `traverse` 函数进行递归的读取操作，这样就能读取一个对象上的任意属性，从而当任意属性发生变化时，都能够触发回调函数执行。

`watch` 函数还可以接受 `getter` 函数、新值和旧值。

其中 `options` 如果增加 `flush` 参数，为 `post` 值时，需要将内容放入微任务队列中执行。

```javascript
function watch(source, cb, options = {}) {
  let getter
  // 如果 source 是函数，说明用户传递的是 getter，所以把 source 赋值给 getter
  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }

  // 定义 oldValue, newValue
  let oldValue, newValue

  const job = () => {
    // 在 scheduler 中重新执行副作用函数，得到的是新值
    newValue = effectFn()
    // 当 obj.foo 的值变化时，会执行 scheduler 调度函数
    cb(newValue, oldValue)
    // 更新旧值，不然下一次会得到错误的旧值
    oldValue = newValue
  }

  const effectFn = effect(() => {
    getter()
  }, {
    lazy: true,
    scheduler() {
      // 在调度函数中判断 flush 是否为 'post'，如果是，将其放到微任务队列中执行
      if (options.flush === 'post') {
        const p = Promise.resolve()
        p.then(job)
      } else {
        job()
      }
    }
  })

  if (options.immediate) {
    // 当 immediate 为 true 时立即执行 job，从而触发回调执行
    job()
  } else {
    oldValue = effectFn()
  }
}
```

## 竞态问题

watch 还存在竞态问题，如：

```javascript
let finalData

watch(obj, async () => {
  // 发送并等待网络请求
  const res = await fetch('path/to')
  // 将请求结果赋值给 data
  finalData = res
})
```

此处我们监听 obj 对象的变化，每次 obj 变化都会导致发送网络请求。此处会产生一个问题，我们不确定网络请求的返回顺序，导致 `finalData` 中的数据，我们没办法确认。

但是我们希望 `finalData` 是最新的一次请求的返回值。

此处我们给 `watch` 增加第三个参数 `onInvalidate`：

```javascript
watch(obj, async (newValue, oldValue, onInvalidate) => {
  // 定义一个标志，代表当前副作用函数是否过期，默认 false，代表没有过期
  let expired = false
  // 调用 onInvalidate() 函数注册一个过期回调
  onInvalidate(() => {
    // 当过期时，将 expired 设置为 true
    expired = true
  })

  // 发送网络请求
  const res = await fetch('/path/to/request')

  // 只有当该副作用函数的执行没有过期时，才会执行后续操作
  if (!expired) {
    finalData = res
  }
})
```

watch 的实现原理为：

```javascript
function watch(source, cb, options = {}) {
  let getter
  // 如果 source 是函数，说明用户传递的是 getter，所以把 source 赋值给 getter
  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }

  // 定义 oldValue, newValue
  let oldValue, newValue

  // cleanup 用来存储用户注册的过期回调
  let cleanup
  function onInvalidate(fn) {
    // 将过期回调存储到 cleanup 中
    cleanup = fn
  }

  const job = () => {
    // 在 scheduler 中重新执行副作用函数，得到的是新值
    newValue = effectFn()
    if (cleanup) {
      cleanup()
    }
    // 当 obj.foo 的值变化时，会执行 scheduler 调度函数
    cb(newValue, oldValue, onInvalidate)
    // 更新旧值，不然下一次会得到错误的旧值
    oldValue = newValue
  }

  const effectFn = effect(() => {
    getter()
  }, {
    lazy: true,
    scheduler() {
      // 在调度函数中判断 flush 是否为 'post'，如果是，将其放到微任务队列中执行
      if (options.flush === 'post') {
        const p = Promise.resolve()
        p.then(job)
      } else {
        job()
      }
    }
  })

  if (options.immediate) {
    // 当 immediate 为 true 时立即执行 job，从而触发回调执行
    job()
  } else {
    oldValue = effectFn()
  }
}
```
