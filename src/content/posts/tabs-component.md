---
title: Tabs 标签页组件 - 技术实现文档
date: 2026-02-12
description: 由 Tabs、TabsContent、Tab、TabTitle 四个组件协同的标签页组件，支持 sticky、scrollspy、手势滑动、懒加载与滚动位置记忆。
category: 组件库
tags: [Vue, 组件设计, tabs, 标签页]
lang: zh
draft: false
---

## 目录

- 1. 组件概述
- 2. 文件结构与架构
- 3. 组件通信模型
- 4. Tabs 主组件 - 模板层解析
- 5. Tabs 主组件 - 脚本层解析
- 6. TabsContent 内容容器解析
- 7. Tab 子组件解析
- 8. TabTitle 标题组件解析
- 9. 样式层解析
- 10. 核心流程图解
- 11. 性能优化总结

---

## 1. 组件概述

Tabs 是一个功能丰富的标签页组件，由 **4 个子组件**协同工作，支持多种交互模式。对标 Vant Tabs，在 API 设计上保持一致，同时增加了滚动位置记忆、自动填充高度等扩展能力。

**核心能力：**

- line / card 两种风格
- 标签栏横向滚动（超过阈值自动启用）
- 下划线跟随动画
- 手势滑动切换（swipeable）+ 转场动画（animated）
- 粘性定位（sticky）+ scrollspy 滚动监听
- 懒加载（lazyRender）
- 切换前拦截（beforeChange）
- 滚动位置记忆（rememberScroll）
- 自动填充高度（autoFit）
- keep-alive 支持
- 完整的 ARIA 无障碍属性

---

## 2. 文件结构与架构

```text
components/
├── tabs/                      # 主组件目录
│   ├── tabs.vue               # Tabs 主组件
│   ├── tabs-content.vue       # TabsContent 内容容器（Swipe 集成）
│   ├── type.ts                # TabsProps / TabsProvide 类型定义
│   └── index.ts               # 导出文件
└── tab/                       # 子组件目录
    ├── tab.vue                # Tab 子组件（面板内容 + 标题渲染）
    ├── tab-title.vue          # TabTitle 标题组件（纯展示）
    └── type.ts                # TabProps / TabData 类型定义
```

### 四组件职责划分

| 组件 | 职责 | 关键文件 |
| --- | --- | --- |
| **Tabs** | 总控协调：管理标签栏、下划线、滚动、sticky、scrollspy | tabs.vue |
| **TabsContent** | 内容区容器：封装 Swipe 组件实现滑动切换和动画 | tabs-content.vue |
| **Tab** | 面板内容：管理单个标签的激活状态、懒加载、标题渲染 | tab.vue |
| **TabTitle** | 标题展示：纯展示组件，处理样式和点击事件 | tab-title.vue |

---

## 3. 组件通信模型

```text
Tabs（父组件）
  ↓ provide(TABS_KEY)
  ↓ linkChildren({ props, id, state, setLine, scrollable,
                   currentName, onRendered, setTitleRefs, scrollIntoView })
  │
  ├──→ Tab 1 inject(TABS_KEY) → renderTitle() / shouldRender
  ├──→ Tab 2 inject(TABS_KEY)
  └──→ Tab N inject(TABS_KEY)

Tabs → TabsContent: 直接 props 传递（currentIndex, animated, swipeable 等）
TabsContent → Tabs: @change 事件
Tab → TabTitle: h(TabTitle, { props, on }) 创建 VNode
```

---

## 4. Tabs 主组件 - 模板层解析

```html
<template>
  <div ref="root" :class="bem([type, { 'auto-fit': autoFit }])">
    <template v-if="showHeader">
      <template v-if="sticky">
        <sticky :container="$refs.root" :offsetTop="offsetTopPx" :onScroll="onStickyScroll">
          <div ref="wrapRef">
            <div :class="[bem('wrap'), { 'v-hairline--top-bottom': type === 'line' && border }]">
              <div ref="navRef" role="tablist"
                :class="bem('nav', [type, { shrink, complete: scrollable }])"
                :style="navStyle" aria-orientation="horizontal">
                <slot name="nav-left"></slot>
                <component :is="renderNav"></component>
                <div v-if="type === 'line' && children.length"
                  :class="bem('line')" :style="state.lineStyle"></div>
                <slot name="nav-right"></slot>
              </div>
            </div>
            <slot name="nav-bottom"></slot>
          </div>
        </sticky>
      </template>
      <template v-else>
        <!-- 相同的标签栏结构，不包裹 Sticky -->
      </template>
    </template>

    <tabs-content
      ref="contentRef"
      :count="children.length"
      :inited="state.inited"
      :animated="animated"
      :duration="duration"
      :swipeable="swipeable"
      :lazyRender="lazyRender"
      :currentIndex="state.currentIndex"
      :transitionTimingFunction="transitionTimingFunction"
      :contentHeight="contentHeight"
      :autoFit="autoFit"
      @change="setCurrentIndex"
    >
      <slot></slot>
    </tabs-content>
  </div>
</template>
```

> **为什么 renderNav 用 `<component :is>` 而非 v-for？** 标签标题需要在 Tab 子组件中通过 `renderTitle()` 方法用 `h()` 函数创建 VNode。使用函数式组件包装后，当 `scrollable` 等响应式属性变化时，整个导航区域能正确重新渲染。

---

## 5. Tabs 主组件 - 脚本层解析

### 5.1 导入依赖

```ts
import {
  addUnit, callInterceptor, createNamespace, getElementTop,
  getScrollTop, isHidden, raf, route, ScrollElement,
  setRootScrollTop, setScrollTop, unitToPx, useChildren,
  useEventListener, useId, useRect, useVisibilityChange, windowWidth
} from '@/utils'
import Sticky from '../sticky/sticky.vue'
import TabsContent from './tabs-content.vue'
```

| 依赖 | 作用 |
| --- | --- |
| `callInterceptor` | 执行 `beforeChange` 拦截器，支持返回 Promise 和 false 阻止切换。 |
| `getElementTop` | 获取元素相对于指定滚动容器顶部的距离，scrollspy 需要。 |
| `setRootScrollTop` | 设置 document 的 scrollTop，sticky 模式切换标签后自动滚动。 |
| `route` | 处理路由跳转，支持 Tab 组件的 `to` / `url` prop。 |
| `useId` | 生成唯一 ID，用于 ARIA 关联（`aria-labelledby` / `aria-controls`）。 |

### 5.2 v-model 配置

```ts
model: {
  prop: 'active',
  event: 'update:active'
}
```

Vue2 自定义 v-model。`v-model` 绑定到 `active` prop，通过 `update:active` 事件同步。

### 5.3 Props 一览（节选）

| Prop | 默认值 | 说明 |
| --- | --- | --- |
| `type` | `'line'` | 风格类型。line = 底部下划线，card = 卡片式选中。 |
| `color` | `''` | 主题色，影响下划线颜色和 card 模式边框/背景色。 |
| `sticky` | `false` | 是否启用 Sticky 粘性定位。 |
| `active` | `0` | 当前激活标签的标识符（索引或 name）。 |
| `duration` | `0.3` | 动画时长（秒）。 |
| `animated` | `false` | 内容切换时是否有过渡动画。 |
| `swipeable` | `false` | 是否开启手势滑动切换。 |
| `scrollspy` | `false` | 滚动监听模式。 |
| `lazyRender` | `false` | 延迟渲染。 |
| `lineWidth / lineHeight` | `0 / 3` | 下划线宽高。 |
| `beforeChange` | - | 切换前拦截函数，返回 false 或 rejected Promise 阻止切换。 |
| `swipeThreshold` | `5` | 标签数量超过此值时启用横向滚动。 |
| `transitionTimingFunction` | `''` | 内容切换动画的缓动函数。 |
| `autoFit` | `false` | 自动填充父容器剩余高度。 |
| `rememberScroll` | `false` | 记住每个标签的滚动位置。 |
| `scrollContainer` | - | 指定滚动容器，配合 rememberScroll。 |

### 5.4 响应式数据

```ts
data() {
  return {
    tabHeight: 0,
    lockScroll: false,
    stickyFixed: false,
    cancelScrollLeftToRaf: () => {},
    cancelScrollTopToRaf: () => {},
    id: '',
    scroller: { value: undefined },
    children: [],
    titleRefs: [],
    titleRefCache: {},
    visibilityObserver: null,
    scrollListener: null,
    state: {
      inited: false,
      position: '',
      lineStyle: { transform: 'translateX(0px) translateX(-50%)' },
      currentIndex: -1
    },
    scrollPositions: {},
    resolvedScrollContainer: null
  }
}
```

| 字段 | 作用 |
| --- | --- |
| `lockScroll` | scrollspy 模式下，手动点击标签触发滚动时锁定，防止滚动事件反向修改 currentIndex。 |
| `cancelScrollLeftToRaf / cancelScrollTopToRaf` | 取消函数，用于中断正在进行的 rAF 滚动动画，避免新旧动画冲突。 |
| `titleRefCache` | 缓存 ref 回调函数避免每次渲染创建新函数。 |
| `state.lineStyle` | 下划线初始 `translateX(0px) translateX(-50%)` 使其居中对齐。 |
| `scrollPositions` | `{ [tabName]: scrollTop }` 映射，记住每个标签的滚动位置。 |

### 5.5 关键计算属性

#### scrollable

```ts
scrollable() {
  return (
    this.children.length > this.$props.swipeThreshold ||
    !this.$props.ellipsis ||
    this.$props.shrink
  )
}
```

**三种情况启用横向滚动：** 标签数超过阈值 / 关闭 ellipsis / 启用 shrink。

#### renderNav（标题渲染器）

```ts
renderNav() {
  const vm = this
  const currentScrollable = this.scrollable
  return {
    functional: true,
    render() {
      return vm.children.map((child) => {
        return child.renderTitle ? child.renderTitle(vm.onClickTab, currentScrollable) : null
      })
    }
  }
}
```

返回一个**函数式组件**，遍历所有 Tab 子组件调用 `renderTitle()`。

### 5.6 核心方法

#### init

```ts
init() {
  this.setCurrentIndexByName(this.$props.active, true)
  this.$nextTick(() => {
    this.state.inited = true
    const wrapRef = this.$refs.wrapRef as HTMLElement
    if (wrapRef) this.tabHeight = useRect(wrapRef).height
    this.scrollIntoView(true)
  })
}
```

#### onClickTab

```ts
onClickTab(item, index, event) {
  const { title, disabled } = this.children[index]
  const name = this.getTabName(this.children[index], index)

  if (!disabled) {
    callInterceptor(this.$props.beforeChange, {
      args: [name],
      done: () => {
        this.setCurrentIndex(index)
        this.scrollToCurrentContent()
      }
    })
    route(item)
  }

  this.$emit('clickTab', { name, title, event, disabled })
}
```

#### setCurrentIndex（核心切换逻辑）

```ts
setCurrentIndex(currentIndex, skipScrollIntoView?) {
  const newIndex = this.findAvailableTab(currentIndex)
  if (newIndex === undefined || newIndex === null) return

  const newTab = this.children[newIndex]
  const newName = this.getTabName(newTab, newIndex)
  const shouldEmitChange = this.state.currentIndex !== null
  const oldIndex = this.state.currentIndex

  if (this.state.currentIndex !== newIndex) {
    if (this.$props.rememberScroll && oldIndex >= 0) {
      const oldTab = this.children[oldIndex]
      if (oldTab) this.saveScrollPosition(this.getTabName(oldTab, oldIndex))
    }

    this.state.currentIndex = newIndex
    if (!skipScrollIntoView) this.scrollIntoView()
    this.setLine()

    if (this.$props.rememberScroll) {
      this.$nextTick(() => this.restoreScrollPosition(newName))
    }
  }

  if (newName !== this.$props.active) {
    this.$emit('update:active', newName)
    if (shouldEmitChange) this.$emit('change', newName, newTab.title)
  }

  if (this.stickyFixed && !this.$props.scrollspy) {
    setRootScrollTop(Math.ceil(getElementTop(this.$refs.root) - this.offsetTopPx))
  }
}
```

#### findAvailableTab - 查找可用标签

```ts
findAvailableTab(index) {
  const diff = index < this.state.currentIndex ? -1 : 1
  while (index >= 0 && index < this.children.length) {
    if (!this.children[index].disabled) return index
    index += diff
  }
}
```

从目标索引开始，沿滑动方向查找第一个未被禁用的标签。

#### setLine - 更新下划线

```ts
setLine() {
  const shouldAnimate = this.state.inited

  this.$nextTick(() => {
    const titles = this.titleRefs
    const root = this.$refs.root
    if (!titles || !titles[this.state.currentIndex] ||
        this.$props.type !== 'line' || isHidden(root)) return

    const title = titles[this.state.currentIndex].$el
    const left = title.offsetLeft + title.offsetWidth / 2

    const lineStyle = {
      backgroundColor: this.$props.color,
      transform: `translateX(${left}px) translateX(-50%)`
    }

    if (lineWidth) lineStyle.width = addUnit(lineWidth)
    if (shouldAnimate) lineStyle.transitionDuration = `${this.$props.duration}s`
    if (lineHeight !== undefined) {
      lineStyle.height = addUnit(lineHeight)
      lineStyle.borderRadius = addUnit(lineHeight)
    }

    this.state.lineStyle = lineStyle
  })
}
```

**下划线定位原理：** `translateX(center) translateX(-50%)` 两次 translate：先移到标签中心，再左移自身宽度的一半。

#### scrollIntoView / scrollLeftTo

```ts
scrollIntoView(immediate?) {
  const nav = this.$refs.navRef
  const titles = this.titleRefs
  if (!this.scrollable || !nav || !titles || !titles[this.state.currentIndex]) return

  const title = titles[this.state.currentIndex].$el
  const to = title.offsetLeft - (nav.offsetWidth - title.offsetWidth) / 2

  if (this.cancelScrollLeftToRaf) this.cancelScrollLeftToRaf()
  this.cancelScrollLeftToRaf = this.scrollLeftTo(nav, to, immediate ? 0 : +this.$props.duration)
}

scrollLeftTo(scroller, to, duration) {
  let count = 0
  const from = scroller.scrollLeft
  const frames = duration === 0 ? 1 : Math.round((duration * 1000) / 16)
  let scrollLeft = from
  let rafId
  function cancel() { cancelAnimationFrame(rafId) }
  function animate() {
    scrollLeft += (to - from) / frames
    scroller.scrollLeft = scrollLeft
    if (++count < frames) rafId = requestAnimationFrame(animate)
  }
  animate()
  return cancel
}
```

`to = title.offsetLeft - (nav.offsetWidth - title.offsetWidth) / 2` 将激活标签滚动到 nav 容器的水平中央。

#### scrollspy 相关

```ts
onScroll() {
  if (this.$props.scrollspy && !this.lockScroll) {
    const index = this.getCurrentIndexOnScroll()
    this.setCurrentIndex(index)
  }
}

getCurrentIndexOnScroll() {
  for (let index = 0; index < this.children.length; index++) {
    const { top } = useRect(this.children[index].$el)
    if (top > this.scrollOffset) {
      return index === 0 ? 0 : index - 1
    }
  }
  return this.children.length - 1
}
```

遍历所有 Tab 面板，找到第一个 top > scrollOffset 的元素，返回它的前一个索引。`scrollOffset = offsetTopPx + tabHeight`。

#### 滚动位置记忆

```ts
saveScrollPosition(name) {
  const container = this.resolvedScrollContainer
  if (container) this.$set(this.scrollPositions, name, container.scrollTop)
}

restoreScrollPosition(name) {
  const container = this.resolvedScrollContainer
  if (container) {
    container.scrollTop = this.scrollPositions[name] || 0
    this.$emit('scroll-restored', { name, scrollTop: container.scrollTop })
  }
}
```

---

## 6. TabsContent 内容容器解析

### 6.1 模板

```html
<template>
  <div :class="bem('content', { animated: animated || swipeable, 'auto-fit': autoFit })"
       :style="contentStyle">
    <template v-if="animated || swipeable">
      <v-swipe
        ref="swipeRef"
        :loop="false"
        :class="bem('track')"
        :duration="Number(duration) * 1000"
        :touchable="swipeable"
        :lazy-render="lazyRender"
        :show-indicators="false"
        :transition-timing-function="transitionTimingFunction"
        @change="onChange"
      >
        <slot></slot>
      </v-swipe>
    </template>
    <template v-else>
      <slot></slot>
    </template>
  </div>
</template>
```

| 模式 | 条件 | 渲染方式 |
| --- | --- | --- |
| **动画/滑动模式** | `animated \|\| swipeable` | 内容包裹在 Swipe 中，通过 Swipe 实现水平切换动画和手势滑动。 |
| **普通模式** | 否 | 直接渲染 slot，Tab 通过 `v-show` 控制显隐。 |

关键配置：

- `loop: false` Tabs 不需要循环
- `duration * 1000` Tabs 单位是秒，Swipe 是毫秒
- `touchable: swipeable` 只有 swipeable 时才启用手势
- `show-indicators: false` Tabs 有自己的指示器

### 6.2 swipeToCurrentTab

```ts
swipeToCurrentTab(index, immediate?) {
  const swipeRef = this.$refs.swipeRef
  const shouldImmediate = immediate ?? !this.inited
  if (swipeRef && swipeRef.state.active !== index) {
    swipeRef.swipeTo?.(index, { immediate: shouldImmediate })
  }
}
```

未初始化时 `immediate = true`（无动画跳转）。

---

## 7. Tab 子组件解析

### 7.1 模板（两种渲染模式）

```html
<template>
  <swipe-item v-if="isAnimatedOrSwipeable"
    :id="id" role="tabpanel"
    :class="bem('panel-wrapper', { inactive: isAnimatedOrSwipeable && hasInactiveClass })"
    :tabindex="active ? 0 : -1"
    :aria-hidden="!active"
    :aria-labelledby="ariaLabelledby">
    <div :class="bem('panel')">
      <slot></slot>
    </div>
  </swipe-item>

  <div v-else :class="bem()">
    <div v-show="show" :id="id" role="tabpanel"
      :class="bem('panel')" :tabindex="show ? 0 : -1"
      :aria-labelledby="ariaLabelledby">
      <template v-if="shouldRender">
        <slot></slot>
      </template>
    </div>
  </div>
</template>
```

| 模式 | 容器 | 可见性控制 | 懒加载控制 |
| --- | --- | --- | --- |
| 动画/滑动 | `<swipe-item>` | `hasInactiveClass` 控制高度坍缩 | Swipe 的 lazy-render |
| 普通 | `<div>` | `v-show="show"` | `v-if="shouldRender"` |

**hasInactiveClass 机制：** 非激活标签将高度设为 0，内容使用 `position: absolute` 脱离文档流。这样 Swipe 的高度只由激活标签决定，但滑动动画时相邻标签的内容仍然可见（`overflow: visible`）。

### 7.2 核心计算属性

```ts
active() {
  if (!this.parent) return false
  const tabName = this.$props.name ?? this.indexValue
  const parentCurrentIndex = this.parent.state.currentIndex
  const parentChildren = (this.parent).children || []
  const activeTab = parentChildren[parentCurrentIndex]
  let currentName = activeTab ? (activeTab.$props?.name ?? parentCurrentIndex) : undefined
  const isActive = tabName === currentName

  if (isActive && !this.inited) this.init()
  return isActive
}

shouldRender() {
  if (!this.parent) return this.inited
  return this.inited || this.parent.props.scrollspy || !this.parent.props.lazyRender
}
```

**shouldRender 三种情况：** 已被激活过 / scrollspy 全渲染 / 未启用懒加载。

### 7.3 renderTitle - 标题渲染方法

```ts
renderTitle(onClickTab, scrollable?) {
  if (!this.parent) return null
  const { parent, index, active, id } = this

  return h(TabTitle, {
    key: id,
    ref: parent.setTitleRefs(index.value),
    props: {
      id: `${parent.id}-${index.value}`,
      isActive: active,
      controls: id,
      scrollable: scrollable,
      activeColor: parent.props.titleActiveColor,
      inactiveColor: parent.props.titleInactiveColor,
      type: parent.props.type,
      color: parent.props.color,
      shrink: parent.props.shrink,
      title: this.$props.title,
      disabled: this.$props.disabled
    },
    style: this.parsedStyle,
    class: this.parsedClass,
    on: {
      click: (event) => onClickTab(this, index.value, event)
    }
  })
}
```

---

## 8. TabTitle 标题组件解析

```html
<template>
  <div :id="id" role="tab"
    :class="[bem([type, { grow: scrollable && !shrink, shrink, active: isActive, disabled }])]"
    :style="style"
    :tabindex="disabled ? undefined : isActive ? 0 : -1"
    :aria-selected="isActive"
    :aria-disabled="disabled || undefined"
    :aria-controls="controls"
    @click="onClick">
    <span :class="bem('text', { ellipsis: !scrollable })">
      <slot name="title">{{ title }}</slot>
    </span>
  </div>
</template>
```

**纯展示组件**，职责单一：BEM 类名管理、样式计算、ARIA 属性、文字省略。

```ts
style() {
  const style = {}
  if (color && isCard) {
    style.borderColor = color
    if (!disabled) {
      if (isActive) style.backgroundColor = color
      else style.color = color
    }
  }
  const titleColor = isActive ? activeColor : inactiveColor
  if (titleColor) style.color = titleColor
  return style
}
```

---

## 9. 样式层解析

### 9.1 Tabs 容器

```scss
.v-tabs {
  position: relative;
  width: 100%;
  &--auto-fit {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
}
```

### 9.2 标签导航

```scss
.v-tabs__nav {
  position: relative;
  display: flex;
  background: var(--bg1);
  user-select: none;

  &--complete {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    &::-webkit-scrollbar { display: none; }
  }

  &--line {
    box-sizing: content-box;
    height: 100%;
    padding-bottom: 15px;
  }
}
```

### 9.3 下划线

```scss
.v-tabs__line {
  position: absolute;
  bottom: 15px;
  left: 0;
  z-index: 1;
  width: 14px;
  height: 3px;
  background: var(--brand_pink);
  border-radius: 3px;
}
```

### 9.4 标签项（Tab Title）

```scss
.v-tab {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;

  &--active { color: var(--brand_pink); font-weight: 500; }
  &--disabled { color: var(--text3); cursor: not-allowed; }
  &--grow { flex: 1 0 auto; padding: 0 12px; }
  &--shrink { flex: none; padding: 0 8px; }
}
```

### 9.5 1px 细线边框

```scss
.v-hairline--top-bottom {
  &::before, &::after {
    position: absolute;
    height: 1px;
    background-color: var(--line_regular);
    transform: scaleY(0.5);
  }
  @media (min-resolution: 3dppx) {
    &::before, &::after { transform: scaleY(0.33); }
  }
}
```

### 9.6 inactive 面板

```scss
.v-tab__panel-wrapper--inactive {
  height: 0;
  overflow: visible;
  position: relative;
  .v-tab__panel {
    position: absolute;
    left: 0;
    top: 0;
  }
}
```

非激活面板高度为 0（不影响 Swipe 高度计算），但 `overflow: visible` 让内容在滑动动画时仍然可见。

---

## 10. 核心流程图解

### 10.1 标签切换完整流程

```text
用户点击 Tab 标签
  └─ onClickTab(item, index, event)
       ├─ disabled? → 仅触发 clickTab 事件，不切换
       ├─ callInterceptor(beforeChange)
       │    ├─ 返回 false / rejected → 切换被拦截
       │    └─ done():
       │        ├─ setCurrentIndex(index)
       │        │   ├─ findAvailableTab() 跳过 disabled
       │        │   ├─ saveScrollPosition()
       │        │   ├─ state.currentIndex = newIndex
       │        │   ├─ scrollIntoView() 标签栏水平滚动
       │        │   ├─ setLine() 下划线动画
       │        │   ├─ restoreScrollPosition()
       │        │   └─ $emit('update:active' / 'change')
       │        └─ scrollToCurrentContent() (scrollspy)
       └─ route(item) (if to/url)
```

### 10.2 Swipe 滑动切换流程

```text
用户在内容区滑动
  → Swipe onTouchEnd
  → Swipe @change(index)
  → TabsContent.onChange(index)
  → $emit('change', index)
  → Tabs.setCurrentIndex(index)
```

### 10.3 scrollspy 模式流程

```text
页面滚动
  → Tabs.onScroll()
       ├─ lockScroll? → 跳过
       └─ getCurrentIndexOnScroll()
            ├─ 遍历 Tab.$el，找第一个 top > scrollOffset
            └─ 返回前一个索引 → setCurrentIndex(index)
```

---

## 11. 性能优化总结

| 优化手段 | 说明 |
| --- | --- |
| **函数式组件 renderNav** | 标签标题通过函数式组件渲染，减少组件实例开销。 |
| **titleRefCache** | 缓存 ref 回调函数，避免每次渲染创建新函数。 |
| **cancelScrollToRaf** | 新动画开始前取消旧动画，避免多个 rAF 动画冲突。 |
| **lockScroll** | scrollspy 模式下手动切换时锁定，防止滚动事件和切换事件产生循环。 |
| **passive: true** | 滚动事件使用被动监听，不阻塞主线程。 |
| **lazyRender** | 只有首次激活的标签才渲染内容，提升首屏性能。 |
| **hasInactiveClass + raf2** | 非激活面板高度坍缩延迟两帧，确保过渡动画完成后再隐藏。 |
| **IntersectionObserver** | 元素从隐藏变可见时自动更新下划线位置。 |
| **scrollspy 偏移计算** | `scrollOffset = offsetTopPx + tabHeight` 精确计算。 |
| **`-webkit-overflow-scrolling: touch`** | iOS 上启用惯性滚动。 |
| **`padding-bottom: 15px`** | 隐藏 Safari 移动端的水平滚动条。 |
| **windowWidth 监听** | 窗口宽度变化时自动 resize，支持屏幕旋转。 |

---

## 附录：导出文件（index.ts）

```ts
import Vue from 'vue'
import TabsVue from './tabs.vue'
import TabVue from '../tab/tab.vue'

const Tab = Object.assign(TabVue, {
  install(app) { app.component(TabVue.name, TabVue); return app }
})

const Tabs = Object.assign(TabsVue, {
  install(app) {
    app.component(TabsVue.name, TabsVue)
    app.component(TabVue.name, TabVue)
    return app
  }
})

export default Tabs
export { Tab, Tabs }
```
