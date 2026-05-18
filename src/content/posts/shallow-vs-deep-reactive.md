---
title: 浅响应和深响应
date: 2026-04-26
description: 用统一的 createReactive 工厂函数同时实现 reactive/shallowReactive/readonly/shallowReadonly，通过 isShallow 与 isReadonly 两个开关决定递归代理与是否拒绝写入。
category: Vue
tags: [Vue, reactive, readonly, Proxy]
lang: zh
draft: false
---

`reactive` 和 `shallowReactive` 的实现（包含 `readonly` 和 `shallowReadonly`）：

```javascript
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      if (key === 'raw') {
        return target
      }

      // 非只读的时候才需要建立响应式联系
      if (!isReadonly) {
        track(target, key)
      }
      // 得到原始结果
      const res = Reflect.get(target, key, receiver)

      if (isShallow) {
        return res
      }
      if (typeof res === 'object' && res !== null) {
        // 调用 reactive 将结果包装成响应式数据并返回
        return isReadonly ? readonly(res) : reactive(res)
      }
      return res
    },
    set(target, key, newVal, receiver) {
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }
      const oldVal = target[key]
      const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'
      const res = Reflect.set(target, key, newVal, receiver)

      // target === receiver.raw 说明 receiver 就是 target 的代理对象
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type)
        }
      }

      return res
    },
    deleteProperty(target, key) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }
      const hadKey = Object.prototype.hasOwnProperty.call(target, key)
      const res = Reflect.deleteProperty(target, key)

      if (res && hadKey) {
        trigger(target, key, 'DELETE')
      }
      return res
    }
    // 省略其他拦截函数
  })
}
```

代理对象通过 `.raw` 就可以判断是否是 `target` 的代理对象。

当前，在副作用函数中如果是访问 `obj.foo.bar` 的值，后续修改该值，并不能触发副作用函数重新执行。添加了递归调用 `reactive` 则为深度响应式。

即 `readonly` 和 `shallowReadonly` 的实现为：

```javascript
function readonly(obj) {
  return createReactive(obj, false, true)
}

function shallowReadonly(obj) {
  return createReactive(obj, true /* shallow */, true)
}
```
