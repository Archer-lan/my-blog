---
title: computed 的实现
date: 2026-04-26
description: 从给 effect 增加 lazy 选项开始，一步步实现 computed 的惰性求值、脏值缓存以及在嵌套 effect 场景下的手动 track/trigger 触发逻辑。
category: Vue
tags: [Vue, computed, effect, 响应式]
lang: zh
draft: false
---

在之前的 `effect` 函数中，它是用来注册副作用函数的，允许指定一些选项参数 `options`。

## lazy 参数

`computed` 实现需要依赖 `lazy` 参数。

在我们实现的 effect 中，函数会立即执行传递给它的副作用函数，如：

```javascript
effect(
  () => {
    console.log(obj.foo)
  }
)
```

实际使用时，不希望立即执行，而是它在需要的时候才执行，如计算属性。这时我们可以添加 lazy 属性达到目的：

```javascript
effect(
  () => {
    console.log(obj.foo)
  },
  {
    lazy: true
  }
)
```

为了实现这个目标，我们需要对 `effect` 函数进行一些修改：

```javascript
function effect(fn, options = {}) {
  const effectFn = () => {
    cleanup(effectFn)
    activeEffect = effectFn
    effectStack.push(effectFn)
    // 将 fn 的执行结果存储到 res 中
    const res = fn()
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    // 将 res 作为 effectFn 的返回值
    return res
  }
  effectFn.options = options
  effectFn.deps = []
  if (!options.lazy) {
    effectFn()
  }

  return effectFn
}
```

现在 `effect` 已经支持了 `lazy` 属性。

## computed 实现

计算属性在 effect 之上可以实现为：

```javascript
function computed(getter) {
  // let value 用来缓存上一次计算的值
  let value
  // dirty 标志，用来标识是否需要重新计算值，为 true 则表示需要计算
  let dirty = true
  // 将 getter 作为副作用函数，创建一个 lazy 的 effect
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true
    }
  })

  const obj = {
    // 当读取 value 时才执行 effectFn
    get value() {
      if (dirty) {
        value = effectFn()
        // 将 dirty 设置为 false，下一次访问直接使用缓存的值
        dirty = false
      }
      return value
    }
  }

  return obj
}
```

此时的 `computed` 还有缺陷，表现在我们在另一个 `effect` 的副作用函数中读取创建的 `computed` 值时，并不会触发副作用函数的渲染。

分析问题的原因，我们发现，从本质上看这就是一个典型的 `effect` 嵌套。一个计算属性内部拥有自己的 `effect`，并且它是懒执行的，只有当真正读取计算属性的值时才会执行。对于计算属性的 `getter` 函数来说，它里面访问的响应式数据只会把 `computed` 内部的 `effect` 收集为依赖。而当把计算属性用于另外一个 `effect` 时，就会发生 `effect` 嵌套，外层的 `effect` 不会被内层 `effect` 中的响应式数据收集。

```javascript
function computed(getter) {
  // let value 用来缓存上一次计算的值
  let value
  // dirty 标志，用来标识是否需要重新计算值，为 true 则表示需要计算
  let dirty = true
  // 将 getter 作为副作用函数，创建一个 lazy 的 effect
  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true
      // 当计算属性依赖的响应式数据变化时，手动调用 trigger 函数触发响应
      trigger(obj, 'value')
    }
  })

  const obj = {
    // 当读取 value 时才执行 effectFn
    get value() {
      if (dirty) {
        value = effectFn()
        // 将 dirty 设置为 false，下一次访问直接使用缓存的值
        dirty = false
      }
      // 当读取 value 时，手动调用 track 函数进行追踪
      track(obj, 'value')
      return value
    }
  }

  return obj
}
```
