---
title: Vue2 与 Vue3 响应式原理与依赖收集详解
date: 2024-09-23
description: 从发布-订阅模式出发，对比 Vue2 通过 Object.defineProperty 实现的属性级劫持与 Vue3 通过 Proxy 实现的整体对象代理，剖析两套响应式系统的依赖收集逻辑。
category: Vue
tags: [Vue, 响应式, Proxy, 依赖收集]
lang: zh
draft: false
---

## Vue 的响应式系统设计思路

虽然 Vue 2 与 Vue 3 实现响应式系统的方式不同，但是它们的核心思想还是一致的，都是通过**发布-订阅模式**来实现（因为发布者和观察者之间多了一个 **dependence 依赖收集者**，与传统观察者模式不同）。

观察者模式：一个被观察对象对应多个观察者，两者直接联系；被观察者改变时直接向所有观察者发送消息（调用观察者的更新方法）。

发布订阅模式：被观察对象与观察者之间可能是**多对多**的关系，两者都可以绑定多个另一角色；而两个角色之间还有一个**依赖收集和管理**的角色（提供一些观察者的操作方法）。

> 在 Vue 中，我们视图中依赖的每一个数据其实就是一个被观察者，我们的视图渲染函数（renderWatcher）和其他的 watcher/effect 函数则都是订阅者。

## Vue2 响应式实现

Vue 2 通过 `Object.defineProperty` 来实现数据**读取和更新时的操作劫持**，通过更改默认的 **getter/setter** 函数，在 **get** 过程中收集依赖，在 **set** 过程中派发更新。

```javascript
// 响应式数据处理，构造一个响应式对象
class Observer {
  constructor(data) {
    this.data = data
    this.walk(data)
  }

  // 遍历对象的每个已定义属性，分别执行 defineReactive
  walk(data) {
    if (!data || typeof data !== 'object') {
      return
    }

    Object.keys(data).forEach(key => {
      this.defineReactive(data, key, data[key])
    })
  }

  // 为对象的每个属性重新设置 getter/setter
  defineReactive(obj, key, val) {
    // 每个属性都有单独的 dep 依赖管理
    const dep = new Dep()

    // 通过 defineProperty 进行操作代理定义
    Object.defineProperty(obj, key, {
      enumerable: true,
      configurable: true,
      // 值的读取操作，进行依赖收集
      get() {
        if (Dep.target) {
          dep.depend()
        }
        return val
      },
      // 值的更新操作，触发依赖更新
      set(newVal) {
        if (newVal === val) {
          return
        }
        val = newVal
        dep.notify()
      }
    })
  }
}

// 观察者的构造函数，接收一个表达式和回调函数
class Watcher {
  constructor(vm, expOrFn, cb) {
    this.vm = vm
    this.getter = parsePath(expOrFn)
    this.cb = cb
    this.value = this.get()
  }

  // watcher 实例触发值读取时，将依赖收集的目标对象设置成自身，
  // 通过 call 绑定当前 Vue 实例进行一次函数执行，在运行过程中收集函数中用到的数据
  // 此时会在所有用到数据的 dep 依赖管理中插入该观察者实例
  get() {
    Dep.target = this
    const value = this.getter.call(this.vm, this.vm)
    // 函数执行完毕后将依赖收集目标清空，避免重复收集
    Dep.target = null
    return value
  }

  // dep 依赖更新时会调用，执行回调函数
  update() {
    const oldValue = this.value
    this.value = this.get()
    this.cb.call(this.vm, this.value, oldValue)
  }
}

// 依赖收集管理者的构造函数
class Dep {
  constructor() {
    // 保存所有 watcher 观察者依赖数组
    this.subs = []
  }

  // 插入一个观察者到依赖数组中
  addSub(sub) {
    this.subs.push(sub)
  }

  // 收集依赖，只有此时的依赖目标（watcher 实例）存在时才收集依赖
  depend() {
    if (Dep.target) {
      this.addSub(Dep.target)
    }
  }

  // 发送更新，遍历依赖数组分别执行每个观察者定义好的 update 方法
  notify() {
    this.subs.forEach(sub => {
      sub.update()
    })
  }
}

Dep.target = null

// 表达式解析
function parsePath(path) {
  const segments = path.split('.')
  return function (obj) {
    for (let i = 0; i < segments.length; i++) {
      if (!obj) {
        return
      }
      obj = obj[segments[i]]
    }
    return obj
  }
}
```

由于 `Object.defineProperty` 只能对**对象的已知属性**进行操作，所以才会导致**没有在 data 中进行声明的对象属性直接赋值时无法触发视图更新，需要通过魔法（`$set`）来处理**。而数组也因为是通过重写数组方法和遍历数组元素进行的响应式处理，会导致按照数组下标进行赋值或者更改元素时无法触发视图更新。

## Vue3 中实现依赖收集

因为 Vue 3 采用的 `Proxy` 可以直接拦截对象的访问和更新，而无需像 `Object.defineProperty` 一样单独为每个属性定义拦截，所以**一个引用类型数据我们只需要收集一个依赖即可，通过一个全局变量进行所有的依赖数据的依赖管理**。

```javascript
const targetMap = new WeakMap();
let shouldTrack = true;
let activeEffect = null;

function track(target, type, key) {
  if (shouldTrack && activeEffect) {
    let depsMap = targetMap.get(target)
    if (!depsMap) targetMap.set(target, (depsMap = new Map()))
    let dep = depsMap.get(key)
    if (!dep) depsMap.set(key, (dep = createDep()))
    const eventInfo = { effect: activeEffect, target, type, key }
    trackEffects(dep, eventInfo)
  }
}
function trackEffects(dep, debuggerEventExtraInfo) {
  let shouldTrack2 = false;
  if (effectTrackDepth <= maxMarkerBits) {
    if (!newTracked(dep)) {
      dep.n |= trackOpBit;
      shouldTrack2 = !wasTracked(dep);
    }
  } else {
    shouldTrack2 = !dep.has(activeEffect);
  }
  if (shouldTrack) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}
```

以上代码就是依赖收集部分的大致逻辑：通过 `track` 函数，在 `shouldTrack` 标识为 `true` 且存在激活副作用函数 `activeEffect` 时，会在**全局的依赖管理中心 `targetMap`** 中插入该数据，并为该数据添加一个 `Set` 格式的 `dep` 依赖，将激活状态的副作用 `activeEffect` 插入到 `dep` 中。
