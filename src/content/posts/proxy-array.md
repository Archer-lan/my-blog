---
title: 代理数组
date: 2026-04-26
description: 数组是异质对象，索引赋值会隐式修改 length，而修改 length 又会影响数组元素。配合 ownKeys 与 for...of 一起完成 Vue 3 中数组的响应式代理。
category: Vue
tags: [Vue, Proxy, 数组, 响应式]
lang: zh
draft: false
---

数组是异质对象，因为数组对象的 `[[DefineOwnProperty]]` 内部方法与常规对象不同。

数组的操作包含：

1. 通过索引访问数组元素值：`arr[0]`
2. 访问数组的长度：`arr.length`
3. 把数组作为对象，使用 `for...in` 循环遍历
4. 使用 `for...of` 迭代遍历数组
5. 数组的原型方法，如 `concat`/`join`/`every`/`some`/`find`/`findIndex`/`includes` 等，以及其他所有不改变原数组的原型方法

## 索引数组

通过索引设置数组的元素值时，参考 ECMA 规范，其与普通对象设置属性值完全不同。当我们通过索引设置数组元素的值时，会执行数组对象的内部 `[[Set]]` 方法。

此外，如果设置的索引值大于数组当前的长度，那么要更新数组的 length 属性。所以当通过索引设置元素值时，可能会隐式地修改 length 的属性值。因此触发响应式时，需要触发 length 属性相关的副作用函数。

```javascript
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 拦截设置操作
    set(target, key, newVal, receiver) {
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }
      const oldVal = target[key]
      // 如果属性不存在，则说明是在添加新的属性，否则是设置已有属性
      const type = Array.isArray(target)
        // 如果代理目标是数组，则检测被设置的索引值是否小于数组长度，
        // 如果是，则视作 SET 操作，否则是 ADD 操作
        ? Number(key) < target.length ? 'SET' : 'ADD'
        : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'

      const res = Reflect.set(target, key, newVal, receiver)
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type)
        }
      }

      return res
    }
    // 省略其他拦截函数
  })
}
```

trigger 为：

```javascript
function trigger(target, key, type) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  // 省略部分内容

  // 当操作类型为 ADD 并且目标对象是数组时，应该取出并执行那些与 length 属性相关联的副作用函数
  if (type === 'ADD' && Array.isArray(target)) {
    // 取出与 length 相关联的副作用函数
    const lengthEffects = depsMap.get('length')
    // 将这些副作用函数添加到 effectsToRun 中，待执行
    lengthEffects && lengthEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  }

  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}
```

反过来，我们修改数组的 length 属性，也会隐式地影响数组元素。

```javascript
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 拦截设置操作
    set(target, key, newVal, receiver) {
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`)
        return true
      }
      const oldVal = target[key]

      const type = Array.isArray(target)
        ? Number(key) < target.length ? 'SET' : 'ADD'
        : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD'

      const res = Reflect.set(target, key, newVal, receiver)
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          // 增加第四个参数，即触发响应的新值
          trigger(target, key, type, newVal)
        }
      }

      return res
    },
  })
}
```

```javascript
// 为 trigger 函数增加第四个参数，newVal，即新值
function trigger(target, key, type, newVal) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  // 省略其他代码

  // 如果操作目标是数组，并且修改了数组的 length 属性
  if (Array.isArray(target) && key === 'length') {
    // 对于索引大于或等于新的 length 值的元素，
    // 需要把所有相关联的副作用函数取出并添加到 effectsToRun 中待执行
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }

  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}
```

## 遍历数组

使用 `for...in` 循环遍历数组与遍历常规对象没有差异，因此，同样可以使用 `ownKeys` 拦截函数进行拦截：

```javascript
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 省略其他拦截函数
    ownKeys(target) {
      // 如果操作目标 target 是数组，则使用 length 属性作为 key 并建立响应联系
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
      return Reflect.ownKeys(target)
    }
  })
}
```

这样无论是为数组添加新元素，还是直接修改 length 属性，本质上都是因为修改了数组的 length 属性。

`for...of` 不同于 `for...in`，是用来遍历可迭代对象的（iterable object）。如果一个对象实现了 `Symbol.iterator` 方法，那么这个对象就是可迭代的。

```javascript
const obj = {
  val: 0,
  [Symbol.iterator]() {
    return {
      next() {
        return {
          value: obj.val++,
          done: obj.val > 10 ? true : false
        }
      }
    }
  }
}
```
