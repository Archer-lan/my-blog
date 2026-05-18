---
title: ref 与 reactive 的区别
date: 2024-09-10
description: Vue 3 中 reactive 只能代理对象类型并返回深响应代理，ref 则同时支持简单类型与对象类型，简单类型借助 defineProperty 包裹 .value 后再使用 Proxy 代理。
category: Vue
tags: [Vue, ref, reactive, Proxy]
lang: zh
draft: false
---

## reactive

`reactive` 创建的响应式对象默认是深度响应式的。

- 只适用于对象类型，比如对象、数组和集合类型，如 `Map` 和 `Set`。
- 返回代理对象。

## ref

`ref` 接受简单类型与对象类型参数。

- 当传入对象类型时，与 `reactive` 一致。
- 当传入简单类型时，其实现依靠 `defineProperty()`。

## 为什么 ref 需要 .value

`Proxy` 只能传入一个对象进行代理。为了将简单类型包裹住，其值被包裹在 `.value` 中再使用 `Proxy` 进行代理。这也是为什么在脚本中访问 `ref` 必须通过 `.value`，而在模板中会被自动解包。
