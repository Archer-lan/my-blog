---
title: Sticky 粘性布局组件 - 技术实现文档
date: 2026-02-11
description: 基于 JS 滚动监听加 position:fixed 实现的粘性布局组件，相较原生 CSS sticky 提供事件通知、容器限制与 keep-alive 支持。
category: 组件库
tags: [Vue, 组件设计, sticky, IntersectionObserver]
lang: zh
draft: false
---

## 目录

- 1. 组件概述
- 2. 文件结构
- 3. 模板层（Template）逐行解析
- 4. 脚本层（Script）逐行解析
- 5. 样式层（Style）解析
- 6. 导出文件（index.ts）解析
- 7. 依赖的工具函数详解
- 8. 性能优化总结
- 9. 与 CSS position: sticky 的区别

---

## 1. 组件概述

Sticky 组件实现了粘性定位功能，在滚动时将元素固定在可视区域的顶部或底部。与 CSS 原生 `position: sticky` 不同，本组件通过 JavaScript 监听滚动事件 + `position: fixed` 实现，具备更好的兼容性和容器限制能力。

**核心能力：**

- 吸顶 / 吸底定位
- 自定义偏移距离
- 容器范围限制（sticky 元素只在容器范围内吸附）
- 窗口尺寸变化自适应
- keep-alive 组件激活/停用支持
- IntersectionObserver 可见性优化

---

## 2. 文件结构

```text
components/sticky/
├── sticky.vue    # 组件主文件（模板 + 逻辑 + 样式）
├── index.ts      # 导出文件，注册 Vue 插件
└── sticky.md     # 组件 API 文档
```

---

## 3. 模板层（Template）逐行解析

```html
<template>
  <!-- 外层容器：用于占位，防止内容吸附后页面布局发生变化 -->
  <div ref="root" :style="rootStyle">
    <!-- 内层容器：实际吸附的元素 -->
    <div :class="bem({ fixed: state.fixed && !isReset })" :style="stickyStyle">
      <slot></slot>
    </div>
  </div>
</template>
```

| 行号 | 代码 | 作用 |
| --- | --- | --- |
| 3-6 | `<div ref="root" :style="rootStyle">` | **外层占位容器**。通过 `ref="root"` 获取 DOM 引用用于计算位置；`rootStyle` 在吸附时会设置固定的 width/height，防止内层元素脱离文档流后页面高度塌缩导致抖动。 |
| 8-11 | `<div :class="bem({...})" :style="stickyStyle">` | **内层吸附元素**。当 `state.fixed` 为 true 且非重置状态时，通过 BEM 添加 `v-sticky--fixed` 类（设置 `position: fixed`）；`stickyStyle` 提供精确的宽高、top/bottom 定位和 transform 偏移。 |
| 12 | `<slot></slot>` | 默认插槽，放置用户需要吸附的内容。 |

> **双层 div 设计的核心原因：** 当内层元素变为 `position: fixed` 后会脱离文档流，外层容器通过保持原有尺寸来"占位"，防止页面内容突然上移导致视觉跳动。这是所有 sticky 组件实现的标准模式。

---

## 4. 脚本层（Script）逐行解析

### 4.1 导入与命名空间

```ts
import Vue, { PropType, CSSProperties } from 'vue'
import {
  createNamespace,
  unitToPx,
  isHidden,
  useRect,
  useWindowSize,
  useVisibilityChange
} from '../../utils'

export type StickyPosition = 'top' | 'bottom'
const [name, bem] = createNamespace('sticky')
```

| 代码 | 作用 |
| --- | --- |
| `import Vue, { PropType, CSSProperties }` | 导入 Vue 构造函数和类型辅助工具。`PropType` 用于 props 类型约束，`CSSProperties` 用于类型安全的样式对象。 |
| `createNamespace` | 创建 BEM 命名空间。`createNamespace('sticky')` 返回 `['VSticky', bem函数, 'v-sticky']`，其中 bem 函数用于生成 BEM 类名如 `v-sticky--fixed`。 |
| `unitToPx` | 将各种 CSS 单位值（number / rem / vw / vh / CSS 变量）统一转换为 px 数值。 |
| `isHidden` | 检测元素是否隐藏（`display: none` 或 `offsetParent === null`），隐藏元素不需要计算吸附。 |
| `useRect` | 获取元素的 `getBoundingClientRect()`，返回 top/left/right/bottom/width/height。 |
| `useWindowSize` | 创建响应式窗口尺寸追踪器（单例），监听 resize 和 orientationchange 事件。 |
| `useVisibilityChange` | 基于 IntersectionObserver 追踪元素可见性变化，元素进入视口时重新触发计算。 |

### 4.2 Props 定义

```ts
props: {
  /** 吸顶时的 z-index */
  zIndex: { type: [Number], default: 99 },
  /** 吸附位置 */
  position: {
    type: String as PropType<StickyPosition>,
    default: 'top' as StickyPosition
  },
  /** 吸顶时与顶部的距离，单位 px */
  offsetTop: { type: [Number, String], default: 0 },
  /** 吸底时与底部的距离，单位 px */
  offsetBottom: { type: [Number, String], default: 0 },
  /** 指定容器，用于限制 sticky 元素的吸附范围 */
  container: {
    type: null as unknown as PropType<Element>,
    default: undefined,
    validator: (value: unknown) => value == null || value instanceof Element
  }
}
```

| Prop | 类型 | 默认值 | 详细说明 |
| --- | --- | --- | --- |
| `zIndex` | `Number` | `99` | 吸附时的 CSS z-index 层级。多个 Sticky 共存时需要设置不同的 z-index 避免遮挡。 |
| `position` | `'top' \| 'bottom'` | `'top'` | 决定吸附方向。`'top'` 为吸顶，`'bottom'` 为吸底。 |
| `offsetTop` | `Number \| String` | `0` | 吸顶时距离视口顶部的距离。支持数字（px）或字符串（rem/vw 等），通过 `unitToPx` 统一转换。 |
| `offsetBottom` | `Number \| String` | `0` | 吸底时距离视口底部的距离。支持同上。 |
| `container` | `Element` | `undefined` | 指定容器元素，限制 sticky 只在容器范围内吸附。当容器滚出视口后 sticky 元素跟随容器移出。 |

### 4.3 响应式数据（data）

```ts
data() {
  return {
    scrollParent: null,
    isReset: false,
    state: {
      fixed: false,
      width: 0,
      height: 0,
      transform: 0
    },
    visibility: null as ReturnType<typeof useVisibilityChange> | null,
  }
}
```

| 字段 | 类型 | 初始值 | 作用 |
| --- | --- | --- | --- |
| `scrollParent` | `null` | `null` | 预留的滚动父元素引用（当前未使用，组件直接监听 window）。 |
| `isReset` | `boolean` | `false` | 窗口尺寸变化时的临时重置标志。设为 true 时内层元素恢复到普通文档流，以便重新测量尺寸。 |
| `state.fixed` | `boolean` | `false` | 核心状态：元素是否处于吸附状态。 |
| `state.width` | `number` | `0` | 元素在普通文档流中的宽度，吸附时用于固定尺寸。 |
| `state.height` | `number` | `0` | 元素在普通文档流中的高度，同时用于外层占位。 |
| `state.transform` | `number` | `0` | 容器限制时的 Y 轴偏移量。当容器即将滚出视口时，sticky 元素需要通过 translate3d 跟随容器移动。 |
| `visibility` | `object \| null` | `null` | IntersectionObserver 封装实例，提供 observe/unobserve 方法。 |

### 4.4 计算属性（computed）

#### 4.4.1 offset

```ts
offset() {
  return unitToPx(
    this.$props.position === 'top' ?
      this.$props.offsetTop : this.$props.offsetBottom
  )
}
```

**作用：** 根据吸附方向（top/bottom）选择对应的偏移 prop，并通过 `unitToPx` 转换为 px 数值。

#### 4.4.2 rootStyle

```ts
rootStyle(): Record<string, any> {
  if (this.isReset) return {}
  if (this.state.fixed) {
    return {
      width: `${this.state.width}px`,
      height: `${this.state.height}px`
    }
  }
  return {}
}
```

**作用：** 外层占位容器的样式。当内层元素变为 fixed 定位后脱离文档流，外层需要保持原始的 width/height 来占位，防止页面抖动。

#### 4.4.3 stickyStyle

```ts
stickyStyle(): CSSProperties {
  if (!this.state.fixed || this.isReset) return {}
  const style: CSSProperties = Object.assign(this.getZIndexStyle(this.$props.zIndex), {
    width: `${this.state.width}px`,
    height: `${this.state.height}px`,
    [this.$props.position]: `${this.offset}px`
  })
  if (this.state.transform) {
    style.transform = `translate3d(0, ${this.state.transform}px, 0)`
  }
  return style
}
```

**作用：** 内层吸附元素的样式。

- `[this.$props.position]: offset + 'px'` — 动态属性名：吸顶时设置 `top`，吸底时设置 `bottom`
- `translate3d(0, transformPx, 0)` — 容器限制偏移，触发 GPU 加速

### 4.5 核心方法（methods）

#### 4.5.1 getZIndexStyle

```ts
getZIndexStyle(zIndex?: Number) {
  const style: CSSProperties = {}
  if (zIndex !== undefined) style.zIndex = +zIndex
  return style
}
```

#### 4.5.2 getScrollTop

```ts
getScrollTop(el: Element | Window) {
  const top = 'scrollTop' in el ? el.scrollTop : el.pageYOffset
  return Math.max(top, 0)
}
```

`Math.max(top, 0)` 处理 iOS Safari 的橡皮筋回弹效果导致的负值。

#### 4.5.3 emitScroll

```ts
emitScroll(scrollTop: number) {
  this.$emit('scroll', { scrollTop, isFixed: this.state.fixed })
}
```

#### 4.5.4 onScroll（核心逻辑）

> 这是组件最核心的方法，负责在每次滚动时判断元素是否应该吸附。

```ts
onScroll() {
  const root = this.$refs.root as HTMLElement
  if (!root || isHidden(root)) return

  const container = this.$props.container
  const position = this.$props.position

  const rootRect = useRect(root)
  const scrollTop = this.getScrollTop(window)

  this.state.width = rootRect.width
  this.state.height = rootRect.height

  if (position === 'top') {
    if (container) {
      const containerRect = useRect(container)
      const difference = containerRect.bottom - this.offset - this.state.height
      this.state.fixed = this.offset > rootRect.top && containerRect.bottom > this.offset
      this.state.transform = difference < 0 ? difference : 0
    } else {
      this.state.fixed = this.offset > rootRect.top
    }
  } else {
    const { clientHeight } = document.documentElement
    if (container) {
      const containerRect = useRect(container)
      const difference = clientHeight - containerRect.top - this.offset - this.state.height
      this.state.fixed = clientHeight - this.offset < rootRect.bottom &&
        clientHeight > containerRect.top
      this.state.transform = difference < 0 ? -difference : 0
    } else {
      this.state.fixed = clientHeight - this.offset < rootRect.bottom
    }
  }

  this.emitScroll(scrollTop)
}
```

**吸顶判断逻辑：** `offset > rootRect.top` 表示元素顶部滚动到偏移距离以上时，触发吸顶。

**容器限制：** 当 `difference < 0` 表示容器底部已经越过 sticky 元素底边，sticky 需要通过 translateY(difference) 向上偏移跟随容器。

**吸底判断：** `clientHeight - offset < rootRect.bottom` 当元素底部超过吸底触发线时触发吸底。

#### 4.5.5 onWindowResize

```ts
onWindowResize() {
  const root = this.$refs.root as HTMLElement
  if (!root || isHidden(root) || !this.state.fixed) return
  this.isReset = true
  this.$nextTick(() => {
    const rootRect = useRect(root)
    this.state.width = rootRect.width
    this.state.height = rootRect.height
    this.isReset = false
  })
}
```

**为什么需要 isReset 机制？** 当元素处于 fixed 定位时，其宽度由内联样式固定，无法反映响应式布局变化。需要：

1. 先将 `isReset` 设为 true 清除 fixed 和内联样式，让元素回到普通文档流
2. 等待 `$nextTick` 后 DOM 更新，重新测量元素在新窗口尺寸下的自然宽高
3. 更新 state.width/height 后将 `isReset` 恢复为 false，重新应用 fixed 定位

### 4.6 Watch 监听器

```ts
watch: {
  'state.fixed': {
    handler(isFixed: boolean) {
      this.$emit('change', isFixed)
    }
  }
}
```

### 4.7 生命周期钩子

#### 4.7.1 created

```ts
created() {
  const windowSize = useWindowSize()
  this.$watch(
    () => [windowSize.width, windowSize.height],
    () => { this.onWindowResize() }
  )
}
```

#### 4.7.2 mounted

```ts
mounted() {
  window.addEventListener('scroll', this.onScroll, { capture: true, passive: true })
  this.$nextTick(() => { this.onScroll() })

  const root = this.$refs.root as HTMLElement
  this.visibility = useVisibilityChange(root, this.onScroll)
  this.visibility?.observe()
}
```

| 代码 | 作用 |
| --- | --- |
| `{ capture: true }` | 在**捕获阶段**监听滚动事件。可以监听到所有子元素容器的滚动，而非仅 window 的冒泡。 |
| `{ passive: true }` | 声明事件处理器不会调用 `preventDefault()`，允许浏览器优化滚动性能。 |
| `useVisibilityChange(root, this.onScroll)` | 创建 IntersectionObserver 实例监听元素可见性，元素进入视口时触发 `onScroll` 重新计算。 |

#### 4.7.3 activated / deactivated

```ts
activated() { this.visibility?.observe() },
deactivated() { this.visibility?.unobserve() }
```

支持 `<keep-alive>` 场景。

#### 4.7.4 beforeDestroy

```ts
beforeDestroy() {
  window.removeEventListener('scroll', this.onScroll, { capture: true } as EventListenerOptions)
  this.visibility?.unobserve()
}
```

`removeEventListener` 必须传入与 `addEventListener` 相同的 capture 参数才能正确移除。

---

## 5. 样式层（Style）解析

```scss
.v-sticky {
  position: relative;

  &--fixed {
    position: fixed;
    z-index: var(--v-sticky-z-index, 99);
  }
}
```

- 不使用 `scoped`，通过 BEM 命名规范实现样式隔离
- 具体的 top/bottom/width/height 通过内联样式动态设置
- CSS 变量 `--v-sticky-z-index` 允许外部自定义层级

---

## 6. 导出文件（index.ts）解析

```ts
import Vue from 'vue'
import StickyVue from './sticky.vue'

const Sticky = Object.assign(StickyVue, {
  install(app: typeof Vue) {
    app.component(StickyVue.name, StickyVue)
    return app
  }
})

export default Sticky
```

---

## 7. 依赖的工具函数详解

### 7.1 useWindowSize（单例响应式窗口尺寸）

```ts
let windowSizeInstance: Vue & WindowSizeState | null = null

export function useWindowSize() {
  if (!windowSizeInstance) {
    windowSizeInstance = new Vue({
      data(): WindowSizeState {
        return { width: 0, height: 0 }
      }
    }) as Vue & WindowSizeState

    if (inBrowser) {
      const update = () => {
        windowSizeInstance!.$data.width = window.innerWidth
        windowSizeInstance!.$data.height = window.innerHeight
      }
      update()
      window.addEventListener('resize', update, { passive: true })
      window.addEventListener('orientationchange', update, { passive: true })
    }
  }
  return {
    get width() { return windowSizeInstance!.$data.width },
    get height() { return windowSizeInstance!.$data.height }
  }
}
```

**设计亮点：** 利用 Vue 实例的响应式系统实现窗口尺寸追踪。单例模式确保多个 Sticky 组件共享同一个监听器。

### 7.2 useVisibilityChange（IntersectionObserver 封装）

```ts
export function useVisibilityChange(
  target: Element | undefined,
  onChange: (visible: boolean) => void
) {
  if (!inBrowser || !window.IntersectionObserver) {
    return { observe: () => {}, unobserve: () => {} }
  }
  const observer = new IntersectionObserver(
    (entries) => { onChange(entries[0].intersectionRatio > 0) },
    { root: document.body }
  )
  return {
    observe: () => { if (target) observer.observe(target) },
    unobserve: () => { if (target) observer.unobserve(target) }
  }
}
```

---

## 8. 性能优化总结

| 优化手段 | 说明 |
| --- | --- |
| `passive: true` | 滚动事件声明为被动监听，浏览器可以立即开始滚动而无需等待 JS 执行。 |
| `translate3d` | 容器限制偏移使用 translate3d 而非修改 top 值，触发 GPU 加速复合层，避免重排。 |
| IntersectionObserver | 使用浏览器原生 API 观察可见性，比轮询检查更高效。 |
| useWindowSize 单例 | 多个 Sticky 实例共享同一个窗口尺寸监听器，避免重复绑定 resize 事件。 |
| isHidden 跳过 | 隐藏元素直接跳过计算，避免无意义的 DOM 操作。 |
| capture 阶段监听 | 在捕获阶段监听 scroll，确保能捕获到所有滚动容器。 |

---

## 9. 与 CSS position: sticky 的区别

| 特性 | CSS sticky | JS 实现（本组件） |
| --- | --- | --- |
| 容器限制 | 自动限制在父容器内 | 通过 container prop 手动指定 |
| 事件通知 | 无 | 提供 scroll 和 change 事件 |
| 兼容性 | 部分老设备不支持 | 兼容所有浏览器 |
| 性能 | 浏览器原生优化 | 需要 JS 计算，已通过 passive 等手段优化 |
| 占位处理 | 浏览器自动处理 | 通过外层 div 手动占位 |
| z-index 控制 | 需要自行设置 | 通过 prop 统一管理 |
