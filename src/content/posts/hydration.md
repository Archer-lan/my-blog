---
title: 水合 (Hydration)
date: 2026-05-14
description: 从 SSR 与 SSG 场景下水合的概念出发，深入剖析 Nuxt 3 的水合底层原理、payload 传递机制、Vue 3 hydration 算法细节，以及水合不匹配与性能优化策略。
category: Vue
tags: [Vue, Nuxt, SSR, Hydration, 性能优化]
lang: zh
draft: false
---

## 什么是水合

**水合（Hydration）** 是指在服务端渲染（SSR）或静态站点生成（SSG）的场景下，将服务器返回的静态 HTML 页面与客户端 JavaScript 进行绑定，使其变为可交互的动态页面的过程。

简单理解：服务端先输出"骨架"（HTML），客户端再为其注入"灵魂"（事件监听、状态、响应式等）。

## 为什么需要水合

- **更快的首屏渲染（FCP / LCP）**：HTML 直接由服务器返回，浏览器无需等待 JS 下载和执行就能展示内容
- **更好的 SEO**：搜索引擎爬虫可以直接读取完整的 HTML 内容
- **保留交互能力**：纯 SSR 输出的 HTML 是静态的，必须通过水合恢复客户端的交互逻辑

## 水合的过程

1. **服务端**：执行组件渲染逻辑，输出 HTML 字符串发送给浏览器
2. **浏览器**：解析 HTML，立即展示页面内容（此时不可交互）
3. **下载 JS**：浏览器下载客户端 JS bundle
4. **执行水合**：JS 执行后，框架会遍历已有的 DOM，复用现有节点，绑定事件、激活响应式状态
5. **页面变为可交互**

## 常见框架的水合

### React

- `ReactDOM.hydrateRoot(container, <App />)` 替代了 `createRoot`
- React 会比对服务端 HTML 与客户端虚拟 DOM，如果不一致会触发 **hydration mismatch** 警告

### Vue

- 使用 `createSSRApp` 创建应用，客户端通过 `app.mount('#app')` 自动进行水合
- Vue 3 改进了水合性能，并提供了 hydration mismatch 的警告

### Next.js / Nuxt

- 框架层面自动处理水合流程
- 提供 `suppressHydrationWarning` / `<ClientOnly>` 等工具处理特殊场景

## Nuxt 水合的底层原理

### 整体架构

Nuxt 3 的 SSR/水合体系建立在以下几层之上：

- **Vue 3**：提供底层的 `createSSRApp` 和 `hydrate` 能力
- **Vite / Webpack**：分别构建 server bundle 与 client bundle
- **Nitro**：Nuxt 3 的服务端引擎，负责执行 server bundle 并生成 HTML 响应
- **`@vue/server-renderer`**：执行 `renderToString` 输出 HTML 字符串
- **unhead**：管理 `<head>` 标签的 SSR 与客户端同步

### 1. 服务端渲染阶段（Server）

当请求到达 Nitro 服务器：

1. **创建 Vue 应用**：调用 `createApp()`（位于 `nuxt/dist/app/entry`），内部使用 `createSSRApp(App)` 创建支持 SSR 的 Vue 应用实例
2. **创建 `nuxtApp` 上下文**：包含 `payload`、`ssrContext`、`hooks`、`provide` 等，挂载到 `app.config.globalProperties.$nuxt`
3. **执行路由匹配**：`vue-router` 根据请求 URL 解析出对应的页面组件
4. **运行 `asyncData` / `useAsyncData` / `useFetch`**：这些组合式 API 在服务端执行时会把结果写入 `nuxtApp.payload.data`，并以 key 缓存
5. **`renderToString`**：Vue 遍历组件树生成 HTML 字符串，过程中收集 `<head>` 信息（通过 unhead）
6. **序列化 payload**：把 `nuxtApp.payload`（`data`、`state`、`config`、`prerenderedAt` 等）通过 `devalue` 序列化为 JS 表达式，写入 HTML 中的 `<script id="__NUXT_DATA__" type="application/json">` 标签
7. **拼装 HTML 响应**：把渲染出的组件 HTML、head 标签、payload、模块 preload links、客户端 entry 的 `<script type="module">` 等组合成完整的文档发送给浏览器

> `devalue` 相比 `JSON.stringify` 能够序列化 `undefined`、`Date`、`RegExp`、循环引用、`Set`/`Map` 等，这是 Nuxt 3 相对 Nuxt 2 的重要升级。

### 2. 客户端水合阶段（Client）

浏览器收到 HTML 后：

1. **解析 HTML 立即显示**：用户看到完整的页面内容，但此时无任何交互能力
2. **下载并执行客户端 entry**：`entry.client.mjs` 被加载执行
3. **读取 `__NUXT_DATA__`**：使用 `parse`（`devalue`）反序列化出 `payload`，恢复服务端运行时收集的数据、状态、配置
4. **创建客户端 Vue 应用**：再次调用 `createApp()`，但这次走的是客户端路径
5. **复用 SSR 的 payload**：`useAsyncData` / `useFetch` 在客户端首次执行时会**直接从 `nuxtApp.payload.data` 取值**，跳过实际的网络请求（这就是 Nuxt 水合的关键优化点）
6. **调用 `app.mount('#__nuxt', true)`**：第二个参数 `true` 告诉 Vue 进入**水合模式**而非重新渲染
7. **Vue 内部执行 `hydrate` 流程**：
   - 从根容器（`#__nuxt`）开始，**逐节点遍历**已存在的 DOM
   - 将每个 DOM 节点与虚拟节点（vnode）配对：复用现有 DOM 元素，不重新创建
   - 为元素绑定事件监听器（`onClick` 等）
   - 激活响应式系统：把 `ref` / `reactive` 与 DOM 关联，建立 effect 依赖
   - 调用 `setup()` 和生命周期钩子（`onMounted` 此时才触发）
8. **触发 `app:mounted` / `page:finish` 钩子**：Nuxt 派发应用就绪事件，路由进入正常 CSR 模式

### 3. payload 的作用与传递机制

`payload` 是 Nuxt 水合的"信物"，避免客户端重复执行已经在服务端完成的工作：

```html
<script id="__NUXT_DATA__" type="application/json" data-ssr="true">
[{"data":1,"state":2,"..."}, ...]
</script>
```

- `payload.data`：`useAsyncData` / `useFetch` 的结果缓存，按 key 索引
- `payload.state`：`useState` 创建的跨组件共享状态
- `payload.config`：通过 `useRuntimeConfig` 暴露给客户端的公共配置
- `payload.prerenderedAt`：SSG 场景下记录预渲染时间戳

**Payload Extraction（载荷抽离）**：Nuxt 在 SSG / `payloadExtraction: true` 模式下，会把 payload 单独写入 `_payload.js`，让客户端导航到同站页面时仅请求 payload 文件而非整页 HTML，类似于 Next.js 的 `getStaticProps` JSON。

### 4. Vue 3 hydration 算法细节

Vue 3 的 `hydrate` 函数（位于 `@vue/runtime-core` 的 `renderer.ts`）核心是 `hydrateNode`：

- **优先匹配节点类型**：根据 vnode 的 `type`（Element / Text / Comment / Fragment / Component）走不同分支
- **元素节点**：
  - 校对 tag 名称是否一致
  - **不重建 DOM**，直接复用现有元素
  - 递归 hydrate 子节点
  - 给当前元素绑定 props 中的事件监听器（`patchProp` 在 hydration 模式下只处理事件，跳过属性写入，因为 SSR 已经写好）
- **组件节点**：执行 `mountComponent`，但传入 `isHydrating=true`，使其调用 `hydrateSubTree` 而非 `mountChildren`
- **不匹配处理**：当发现 DOM 与 vnode 不一致时，Vue 会**抛弃当前子树并降级为客户端重新渲染**，同时在 dev 模式下打印 `Hydration node mismatch` 警告

### 5. Nuxt 提供的水合控制工具

- **`<ClientOnly>`**：服务端渲染时仅输出占位符（`<!--[-->` 注释或 fallback 插槽），客户端挂载后再渲染真实内容；适用于依赖浏览器 API 的组件
- **`.client.vue` / `.server.vue` 后缀**：组件文件名约定，Nuxt 在编译时自动按环境裁剪
- **`useState(key, init)`**：替代 Pinia/Vuex 的轻量状态方案，自动通过 payload 在服务端 → 客户端传递，确保水合一致
- **`onNuxtReady(cb)`**：在水合完成且浏览器空闲后执行，常用于注册非关键的客户端逻辑
- **`useHydration(key, getter, setter)`**：底层 API，自定义某个数据如何序列化并在水合时恢复

### 6. Nuxt 3 的 Lazy / Island Hydration

Nuxt 3.0+ 引入了 **Server Components** 与 **Nuxt Islands**：

- **`<NuxtIsland>` / `.server.vue`**：组件**仅在服务端渲染**，输出静态 HTML 片段，客户端**不参与水合**，从而减少 bundle 体积和水合开销
- **`<NuxtClientFallback>`**：当某个区域水合失败时，自动降级为客户端重新渲染该区域，而不会让整页崩溃
- **Selective Hydration（实验特性）**：通过 `experimental.componentIslands`，可以让页面绝大部分保持静态，仅对标记为交互的孤岛进行水合

### 7. 一次完整请求时序图

```text
浏览器                Nitro 服务器              客户端 Vue
  │                       │                        │
  │── GET /page ───────>│                        │
  │                       │ createApp() + SSR      │
  │                       │ useAsyncData → payload │
  │                       │ renderToString → HTML  │
  │<──── HTML + payload ──│                        │
  │ 解析 HTML 立即显示                              │
  │── 请求 entry.client.mjs ────────────────>  │
  │<── JS bundle ──────────────────────────   │
  │                                                │ parse(__NUXT_DATA__)
  │                                                │ createApp() 客户端模式
  │                                                │ app.mount('#__nuxt', true)
  │                                                │ hydrate: 复用 DOM + 绑事件
  │                                                │ onMounted / app:mounted
  │ 页面可交互                                       │
```

### 8. 与 Nuxt 2 的关键差异

| 维度 | Nuxt 2 | Nuxt 3 |
| --- | --- | --- |
| 序列化 | `JSON.stringify` + 自定义 reviver | `devalue`，支持更多类型 |
| 状态注入 | `window.__NUXT__` 全局对象 | `<script id="__NUXT_DATA__">` 标签 |
| 服务端引擎 | Connect / Express | Nitro（H3） |
| Server Components | 不支持 | 通过 `.server.vue` / Islands 支持 |
| 水合实现 | Vue 2 `$mount(el, true)` | Vue 3 `hydrate()` + `mount(el, true)` |

### 9. devalue 的序列化方式详解

`devalue` 输出的不是传统的 JSON，而是**扁平化的数组索引结构**，能处理各种特殊值：

```javascript
// 输入
const payload = {
  data: { user: { name: 'Alice', joinedAt: new Date('2024-01-01') } },
  state: undefined,
  cyclic: null
}
payload.cyclic = payload  // 循环引用

// devalue.stringify(payload) 输出
[
  {"data":1,"state":-2,"cyclic":0},   // 0: root、-2 表示 undefined
  {"user":2},                          // 1: data
  {"name":3,"joinedAt":4},             // 2: user
  "Alice",                             // 3
  ["Date","2024-01-01T00:00:00.000Z"]  // 4: Date 类型标记
]
// 负数表示特殊常量：-1=hole、-2=undefined、-3=NaN、-4=+Infinity、-5=-Infinity
```

这种索引结构的优势：

- **处理循环引用**：同一对象多次引用只存一份，以索引复用
- **保留类型信息**：`Date`、`RegExp`、`Map`、`Set`、`BigInt`、`URL` 都能以 `[type, ...args]` 形式序列化
- **安全**：不使用 `eval`，反序列化时使用 `JSON.parse` + 手动重建，允许部署严格的 CSP 策略

### 10. Suspense 与异步组件的水合

Nuxt 3 默认在顶层用 `<Suspense>` 包裹页面组件，以支持顶层 `await`：

```vue
<!-- pages/index.vue -->
<script setup>
const { data } = await useFetch('/api/post')
</script>
```

水合底层行为：

- **服务端**：`renderToString` 会等待所有 Suspense 的 async dependency resolve 后才输出 HTML，避免输出 fallback 内容
- **客户端**：水合时 `Suspense` 不会重新 `await`（因为数据已在 payload 中），直接同步完成水合
- **`<NuxtPage>` 切换**：路由跳转时新页面又会进入 `Suspense` pending 状态，可通过 `app.suspense.resolve` / `page:finish` 钩子控制 loading UI

### 11. 错误边界与 `<NuxtErrorBoundary>`

Vue 3 在水合期间发生错误不会默认崩溃整页，但会抛出 `Hydration completed but contains mismatches` 警告。Nuxt 提供：

```vue
<NuxtErrorBoundary @error="handle">
  <RiskyComponent />
  <template #error="{ error, clearError }">
    <button @click="clearError">重试</button>
  </template>
</NuxtErrorBoundary>
```

- `onErrorCaptured` 钩子捕获子树的错误
- `error.value` 为 `ref`，调用 `clearError()` 后重新渲染子树

### 12. Head 管理与水合

unhead（`@unhead/vue`）在水合中的作用：

- **服务端**：收集 `useHead()` 调用，生成 `<title>`、`<meta>`、`<link>` 等写入 HTML `<head>`
- **客户端**：读取服务端已有的 head 标签，避免重复插入；后续路由变化时才动态更新 DOM
- 使用 `data-hid` / `data-unhead` 属性标记由 unhead 创建的节点，客户端仅接管这些节点

### 13. 性能调优实践

1. **减少需要水合的组件**：静态内容改为 `.server.vue` 或裹在 `<NuxtIsland>` 中
2. **控制 payload 体积**：`useAsyncData` 的返回值会序列化进入 HTML，避免返回庞大对象，可用 `transform` 选项裁剪
3. **使用 `payloadExtraction`**：SSG 下路由切换只拉 JSON，不重新拉整页 HTML
4. **避免不必要的 `<ClientOnly>`**：该组件会跳过 SSR、可能出现 layout shift，仅在真必要时使用
5. **路由级 lazy 加载**：通过动态 `import()` + `defineAsyncComponent` 拆分 chunk，推迟非首屏组件的 hydration
6. **开启 `experimental.asyncContext`**：让 SSR 期间的异步上下文更准确地传递，避免跨请求状态污染

### 14. 源码入口参考

- `nuxt/src/app/entry.ts` — 客户端与服务端公用入口，根据 `import.meta.client` 分流
- `nuxt/src/app/nuxt.ts` — `createNuxtApp` 定义，创建 `nuxtApp` 实例和 hooks 系统
- `nuxt/src/app/plugins/payload.client.ts` — 客户端读取 `__NUXT_DATA__` 的逻辑
- `@vue/runtime-core/src/hydration.ts` — `createHydrationFunctions` 返回 `hydrate` 与 `hydrateNode`
- `@vue/server-renderer/src/render.ts` — `renderToString` 主入口
- `nitropack/src/runtime/entries/...` — Nitro 各部署适配器的服务端入口

## 水合不匹配 (Hydration Mismatch)

当服务端渲染的 HTML 与客户端首次渲染的结果不一致时会触发，常见原因：

- 使用了仅客户端可用的 API：`window`、`document`、`localStorage`
- 使用了非确定性的数据：`Date.now()`、`Math.random()`
- 服务端与客户端环境差异：时区、语言、用户代理
- HTML 结构错误：`<p>` 内嵌套了块级元素等

**解决方案**：

- 将依赖客户端的逻辑放到 `useEffect` / `onMounted` 中
- 使用 `<ClientOnly>` 组件包裹仅客户端渲染的内容
- 确保服务端和客户端数据一致（通过 SSR 数据序列化传递）

## 水合的性能问题与优化

### 问题

- **大型应用水合慢**：客户端需要重新执行整棵组件树才能"激活"页面
- **TTI（可交互时间）延长**：水合完成前页面无法响应交互

### 新的水合策略

- **Selective Hydration（选择性水合）**：React 18 引入，根据用户交互优先水合相关组件
- **Progressive Hydration（渐进式水合）**：按需逐步水合不同区域
- **Islands Architecture（孤岛架构）**：Astro / Qwik 等框架采用，仅水合具有交互性的独立"孤岛"
- **Resumability（可恢复性）**：Qwik 提出，跳过水合阶段，直接从序列化状态中恢复执行

> 参考：[React 官方文档 - hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot)、[Vue SSR 指南](https://vuejs.org/guide/scaling-up/ssr.html)、[Islands Architecture - Jason Miller](https://jasonformat.com/islands-architecture/)
