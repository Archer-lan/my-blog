---
title: Vue3 中组件的初始化顺序
date: 2026-04-13
description: 父子组件在 Vue 3 中的生命周期触发顺序——初始化由外向内、挂载由内向外，再加上孙子组件、异步组件与 v-if 等特殊情况。
category: Vue
tags: [Vue, 生命周期, 组件]
lang: zh
draft: false
---

## 核心执行顺序（父子组件）

假设有一个父组件 Parent 和一个子组件 Child，它们的生命周期钩子执行顺序如下：

1. Parent `setup()`（开始初始化父组件）
2. Parent `onBeforeMount`
3. Child `setup()`（开始初始化子组件）
4. Child `onBeforeMount`
5. Child `onMounted`（子组件挂载完成）
6. Parent `onMounted`（父组件挂载完成）

## 为什么是这个顺序？（原理解析）

- **初始化阶段（由外向内）**：父组件要渲染，必须先执行自己的逻辑。当它解析到模板中的子组件标签时，才会触发子组件的初始化流程。所以父组件的 `setup` 永远先于子组件。
- **挂载阶段（由内向外）**：在 Vue 的设计中，父组件挂载完成的前提是它的所有子组件都已经挂载完成。
  - 如果子组件没挂载，父组件的 DOM 树是不完整的。
  - 因此，Vue 会等待最底层的子组件 `onMounted` 触发后，再一层层向上回溯，最后触发根组件的 `onMounted`。

## 加入孙子组件后的完整链条

如果有 Parent → Child → Grandson：

1. Parent `setup`
2. Parent `onBeforeMount`
3. Child `setup`
4. Child `onBeforeMount`
5. Grandson `setup`
6. Grandson `onBeforeMount`
7. Grandson `onMounted`（最底层的先完成）
8. Child `onMounted`
9. Parent `onMounted`（最顶层的最后完成）

## 两个特殊情况

### A. 异步组件（Async Components）

如果你使用了 `defineAsyncComponent` 或者子组件中有 top-level `await`（配合 Suspense）：

- 父组件会先挂载完成。
- 子组件会在异步请求加载完成后，单独触发自己的挂载钩子。
- 这会打破上述的同步挂载顺序。

### B. v-if 动态加载

- 如果子组件被 `v-if="false"` 隐藏，初始化时不会触发子组件的任何钩子。
- 当条件变为 `true` 时，子组件会经历完整的 `setup` → `beforeMount` → `mounted` 过程，而此时父组件早已挂载完毕。

## 总结建议

- **数据传递**：既然父组件的 `setup` 先执行，你可以在父组件中准备好数据，通过 props 传给子组件，子组件在自己的 `setup` 中就能拿到。
- **DOM 操作**：如果你在父组件的 `onMounted` 中操作子组件的 DOM，通常是安全的，因为此时子组件一定已经挂载好了。
- **避免竞态**：不要试图在子组件的 `setup` 中去读取父组件还没准备好的异步数据，因为子组件的 `setup` 紧随父组件之后就会执行。
