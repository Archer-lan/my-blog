---
title: Vue2 的 defineProperty 与 Vue3 的 Proxy 的区别
date: 2026-04-02
description: 从拦截目标、新增删除属性、数组处理、初始化性能与浏览器兼容性五个角度，对比 Vue 2 的 Object.defineProperty 与 Vue 3 的 Proxy。
category: Vue
tags: [Vue, Proxy, defineProperty, 响应式]
lang: zh
draft: false
---

Vue 2 到 Vue 3 最大的底层架构升级之一，就是将响应式系统的核心从 `Object.defineProperty` 替换成了 ES6 的 `Proxy`。这也是为什么在开发体验上，Vue 3 解决了很多我们在 Vue 2 中常遇到的"历史遗留痛点"。

我们可以把 `defineProperty` 比作是**给每个房间（属性）单独配一把锁**，而 `Proxy` 则是**直接在整栋大楼（对象）的大门上装了一个智能安检机**。

## 五个核心区别

### 1. 劫持的目标层面不同（属性 vs 整个对象）

- **Vue 2（`defineProperty`）**：只能劫持对象的某一个具体属性。为了让整个对象都变成响应式，Vue 2 必须在初始化时通过 `Object.keys()` 遍历所有属性，并逐个绑定 `get` 和 `set`。
- **Vue 3（`Proxy`）**：劫持的是整个对象。只需要把目标对象传给 `Proxy`，返回的代理对象会拦截对任意属性的访问和修改，不需要挨个遍历。

### 2. 动态新增和删除属性

- **Vue 2 痛点**：初始化只遍历已有属性。运行时新增属性（例如 `obj.newKey = 'value'`）或删除属性，Vue 2 无法监听到，通常需要用 `this.$set()` 和 `this.$delete()`。
- **Vue 3 突破**：`Proxy` 的 `set` 可以拦截新增属性赋值，`deleteProperty` 可以拦截属性删除。直接新增或删除属性就能保持响应式，基本告别 `$set` 和 `$delete`。

### 3. 数组的处理能力

- **Vue 2 痛点**：`defineProperty` 对数组索引修改（`arr[0] = 1`）和长度修改（`arr.length = 0`）支持较弱。Vue 2 通过"重写"7 个数组方法（`push`、`pop`、`shift`、`unshift`、`splice`、`sort`、`reverse`）来实现拦截。
- **Vue 3 突破**：`Proxy` 天生支持拦截数组的索引和 `length` 变化，数组操作更自然，覆盖更完整。

### 4. 初始化性能差异（递归深搜 vs 懒加载）

- **Vue 2（`defineProperty`）**：组件初始化时会一次性递归遍历深层对象，把所有嵌套属性都转换成 getter 和 setter，深层数据会带来更高的启动开销。
- **Vue 3（`Proxy`）**：响应式是按需的。创建代理时通常只处理第一层，只有访问到更深层对象时，才会继续把深层对象包装成 Proxy，从而降低初始渲染成本。

### 5. 兼容性权衡

- **Vue 2（`defineProperty`）**：ES5 能力，兼容性好，最低可支持到 IE9。
- **Vue 3（`Proxy`）**：ES6 能力，无法被 Babel 等工具完全 polyfill，因此 Vue 3 放弃了 IE 支持，面向现代浏览器。

## 核心区别总结表

| 对比维度 | Vue 2（Object.defineProperty） | Vue 3（Proxy） |
| --- | --- | --- |
| 拦截目标 | 具体的属性（Property） | 整个对象（Object 或 Array） |
| 新增和删除属性 | 无法检测，需要 `$set` 或 `$delete` | 原生拦截，直接操作即可 |
| 数组处理 | 需重写数组方法，难以拦截索引和长度 | 原生支持数组索引和长度变化 |
| 初始化性能 | 一次性深度递归，初始开销更大 | 按需（Lazy）代理，初始更轻 |
| 浏览器兼容性 | 好，支持到 IE9 | 较差，不支持 IE |
