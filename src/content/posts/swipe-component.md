---
title: Swipe 轮播组件 - 技术实现文档
date: 2026-02-12
description: 基于 provide/inject 的 Swipe + SwipeItem 父子轮播组件，支持手势滑动、循环、自动播放、懒加载等能力。
category: 组件库
tags: [Vue, 组件设计, swipe, 轮播, 手势]
lang: zh
draft: false
---

## 目录

- 1. 组件概述
- 2. 文件结构
- 3. 架构设计
- 4. Swipe 主组件 - 模板层解析
- 5. Swipe 主组件 - 脚本层解析
- 6. SwipeItem 子组件解析
- 7. 样式层解析
- 8. 依赖的工具函数详解
- 9. 核心算法图解
- 10. 性能优化总结

---

## 1. 组件概述

Swipe 是一个移动端轮播组件，支持触摸滑动、自动播放、垂直滚动、循环轮播、懒加载等功能。由 **Swipe（父组件）** 和 **SwipeItem（子组件）** 配合使用，采用 provide/inject 模式实现父子通信。

**核心能力：**

- 水平 / 垂直方向轮播
- 循环（loop）模式无缝切换
- 手势滑动控制，支持快速滑动判定
- 自动播放与可见性联动
- 懒加载（lazy-render）未展示的轮播项
- 自定义指示器插槽
- 自定义过渡缓动函数
- 窗口尺寸变化自适应
- keep-alive 组件支持

---

## 2. 文件结构

```text
components/
├── swipe/
│   ├── swipe.vue          # 主组件（轮播容器）
│   ├── index.ts           # 导出文件
│   ├── relation-key.ts    # 父子关联标识（Symbol + 类型）
│   └── swipe.md           # API 文档
└── swipe-item/
    ├── swipe-item.vue     # 子组件（轮播项）
    └── index.ts           # 导出文件
```

---

## 3. 架构设计

### 3.1 父子通信模型

```text
┌─────────────────────────────────────────────────┐
│  Swipe（父组件）                                 │
│  provide(SWIPE_KEY) → linkChildren({           │
│    props: this.$props,                          │
│    state: reactiveState                         │
│  })                                              │
│                                                  │
│  useChildren() ──→ children[]                   │
│  管理子组件的注册/注销                            │
│                                                  │
│  ┌── SwipeItem 1 inject(SWIPE_KEY) ──┐         │
│  ├── SwipeItem 2 inject(SWIPE_KEY) ──┤         │
│  └── SwipeItem N inject(SWIPE_KEY) ──┘         │
└─────────────────────────────────────────────────┘
```

### 3.2 滑动模型

```text
  offset（整体偏移量）
  ◄──────────────────────►
  ┌───────────┐
  │  可视区域   │
  │ (容器宽度) │
  └───────────┘
  ┌──────┐┌──────┐┌──────┐┌──────┐
  │Item 0││Item 1││Item 2││Item 3│  ← track（轨道）
  └──────┘└──────┘└──────┘└──────┘
  ◄──────── trackSize ────────►

  轨道通过 translateX(offset) 移动；offset 为负值时向左滑动。
```

---

## 4. Swipe 主组件 - 模板层解析

```html
<template>
  <div :class="bem()" ref="root">
    <!-- 轨道容器：承载所有轮播项，通过 transform 平移 -->
    <div
      ref="track"
      :style="trackStyle"
      :class="bem('track', { vertical })"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <slot></slot>
    </div>

    <!-- 自定义指示器插槽 -->
    <slot
      v-if="$scopedSlots.indicator"
      name="indicator"
      :active="activeIndicator"
      :total="count"
    />

    <!-- 默认指示器 -->
    <div
      v-else-if="showIndicators && count > 1"
      :class="bem('indicators', { vertical })"
    >
      <i
        v-for="(item, index) in count"
        :key="index"
        :class="bem('indicator', { active: index === activeIndicator })"
        :style="index === activeIndicator ? { backgroundColor: indicatorColor } : undefined"
      />
    </div>
  </div>
</template>
```

> **为什么 touchmove 没有在模板中绑定？** touchmove 需要 `passive: false` 才能调用 `preventDefault` 阻止页面滚动。Vue 模板的 `.passive` 修饰符设置的是 `passive: true`，无法满足需求。因此 touchmove 在 `mounted` 中通过 `useEventListener` 手动绑定。

---

## 5. Swipe 主组件 - 脚本层解析

### 5.1 导入与命名空间

```ts
import Vue, { CSSProperties, PropType } from 'vue'
import {
  createNamespace, useChildren, raf2, useTouch, clamp, preventDefault,
  isHidden, useVisibilityChange, useEventListener, windowWidth, windowHeight
} from '../../utils'

const [name, bem] = createNamespace('swipe')
export const SWIPE_KEY = Symbol(name)
```

`SWIPE_KEY = Symbol(name)` 创建唯一标识，避免多组件库之间的命名冲突。

### 5.2 类型定义

```ts
export interface SwipeProps {
  loop: boolean
  width: number
  height: number
  vertical: boolean
  autoplay: number | string
  duration: number | string
  touchable: boolean
  lazyRender: boolean
  initialSwipe: number | string
  indicatorColor: string
  showIndicators: boolean
  stopPropagation: boolean
  transitionTimingFunction: string
}

export interface SwipeProvide {
  props: SwipeProps
  state: {
    activeIndicator: number
    count: number
    size: number
  }
}
```

### 5.3 Props 一览

| Prop | 默认值 | 说明 |
| --- | --- | --- |
| `loop` | `true` | 循环模式下，最后一张滑到第一张无缝衔接。 |
| `width` | `0` | 0 表示自动使用容器宽度。 |
| `height` | `0` | 0 表示自动使用容器高度。垂直模式必需。 |
| `vertical` | `false` | 切换水平/垂直方向。 |
| `autoplay` | `0` | 0 表示不自动播放。 |
| `duration` | `500` | 非拖拽状态下的过渡动画时长。拖拽中为 0。 |
| `touchable` | `true` | 关闭后禁用手势滑动。 |
| `lazyRender` | `false` | 开启后只渲染当前及相邻轮播项。 |
| `initialSwipe` | `0` | 初始显示第几页。 |
| `indicatorColor` | `#1989fa` | 默认指示器激活色。 |
| `showIndicators` | `true` | 是否显示默认指示器。 |
| `stopPropagation` | `true` | touchmove 时是否阻止冒泡。 |
| `transitionTimingFunction` | `''` | 自定义 CSS 缓动函数。 |

### 5.4 响应式数据

```ts
data() {
  return {
    state: {
      rect: null as { width: number; height: number } | null,
      width: 0,
      height: 0,
      offset: 0,
      active: 0,
      swiping: false
    },
    reactiveState: {
      activeIndicator: 0,
      count: 0,
      size: 0
    },
    dragging: false,
    touch: useTouch(),
    children: [] as any[],
    touchStartTime: 0,
    autoplayTimer: undefined as number | undefined,
    touchMoveListener: null as ReturnType<typeof useEventListener> | null,
    isInited: false
  }
}
```

关键字段：

- `state.offset` 轨道 `translateX/Y` 的像素值。负值表示向左/上滑动。
- `state.active` 当前活跃页索引。循环模式下可为 -1（最后一页假位）或 count（第一页假位）。
- `state.swiping` `true` = 正在拖拽，transition-duration 设为 0 实现跟手；`false` = 释放，使用 duration 做过渡动画。
- `reactiveState` 专门给子组件观察的响应式状态，通过 provide 传递。

### 5.5 关键计算属性

```ts
count(): number { return this.children.length }

maxCount(): number {
  return this.size ? Math.ceil(Math.abs(this.minOffset) / this.size) : this.count
}

minOffset(): number {
  if (this.state.rect) {
    const base = this.$props.vertical ? this.state.rect.height : this.state.rect.width
    return base - this.size * this.count
  }
  return 0
}

activeIndicator(): number {
  return (this.state.active + this.count) % this.count
}

trackStyle() {
  const duration = this.state.swiping ? 0 : this.$props.duration
  const style: CSSProperties = {
    transitionDuration: `${duration}ms`,
    transform: `translate${this.$props.vertical ? 'Y' : 'X'}(${+this.state.offset.toFixed(2)}px)`
  }
  if (this.$props.transitionTimingFunction) {
    style.transitionTimingFunction = this.$props.transitionTimingFunction
  }
  if (this.size) {
    const mainAxis = this.$props.vertical ? 'height' : 'width'
    const crossAxis = this.$props.vertical ? 'width' : 'height'
    style[mainAxis] = `${this.trackSize}px`
    style[crossAxis] = this.$props[crossAxis] ? `${this.$props[crossAxis]}px` : ''
  }
  return style
}
```

**activeIndicator 归一化举例：** active=-1, count=3 时 (-1+3)%3 = 2（最后一页）；active=3, count=3 时 0（又回到第一页）。

**trackStyle 关键点：** 拖拽中 `duration = 0` 实现跟手；`toFixed(2)` 避免浮点精度抖动。

### 5.6 核心方法

#### initialize - 初始化

```ts
initialize(active?: number) {
  let currentActive = active ?? +this.$props.initialSwipe
  if (!this.$refs.root) return

  const cb = () => {
    const root = this.$refs.root as HTMLElement
    if (!isHidden(root)) {
      const rect = { width: root.offsetWidth, height: root.offsetHeight }
      this.state.rect = rect
      this.state.width = +(this.$props.width || rect.width)
      this.state.height = +(this.$props.height || rect.height)
    }

    if (this.count) {
      currentActive = Math.min(this.count - 1, currentActive)
      if (currentActive === -1) currentActive = this.count - 1
    }

    const targetOffset = this.getTargetOffset(currentActive)
    this.state.active = currentActive
    this.state.swiping = true
    this.state.offset = targetOffset

    this.reactiveState.count = this.count
    this.reactiveState.activeIndicator = this.activeIndicator
    this.reactiveState.size = this.size

    this.children.forEach((swipe) => swipe.setOffset(0))
    this.startAutoplay()

    this.$nextTick(() => {
      this.children.forEach((child) => child.$forceUpdate())
      this.state.swiping = false
      this.isInited = true
    })
  }

  const root = this.$refs.root as HTMLElement
  if (!isHidden(root)) this.$nextTick().then(cb)
  else cb()
}
```

初始化流程：测量容器尺寸 → 约束 active → 瞬间定位（无动画）→ 同步 reactiveState → 重置子项 → 启动自动播放 → nextTick 恢复动画。

#### onTouchStart / onTouchMove / onTouchEnd

```ts
onTouchStart(event: TouchEvent) {
  if (!this.$props.touchable || event.touches.length > 1) return
  this.touch.start(event)
  this.dragging = false
  this.touchStartTime = Date.now()
  this.stopAutoplay()
  this.correctPosition()
}

onTouchMove(event: TouchEvent) {
  if (this.$props.touchable && this.state.swiping) {
    this.touch.move(event)
    if (this.isCorrectDirection) {
      const isEdgeTouch = !this.$props.loop && (
        (this.state.active === 0 && this.delta > 0) ||
        (this.state.active === this.count - 1 && this.delta < 0)
      )
      if (!isEdgeTouch) {
        preventDefault(event, this.$props.stopPropagation)
        this.move({ offset: this.delta })
        if (!this.dragging) {
          this.$emit('dragStart', { index: this.activeIndicator })
          this.dragging = true
        }
      }
    }
  }
}

onTouchEnd() {
  if (!this.$props.touchable || !this.state.swiping) return

  const duration = Date.now() - this.touchStartTime
  const speed = this.delta / duration
  const shouldSwipe = Math.abs(speed) > 0.25 || Math.abs(this.delta) > this.size / 2

  if (shouldSwipe && this.isCorrectDirection) {
    const offset = this.$props.vertical ? this.touch.offsetY : this.touch.offsetX
    let pace = 0
    if (this.$props.loop) {
      pace = offset > 0 ? (this.delta > 0 ? -1 : 1) : 0
    } else {
      pace = -Math[this.delta > 0 ? 'ceil' : 'floor'](this.delta / this.size)
    }
    this.move({ pace, emitChange: true })
  } else if (this.delta) {
    this.move({ pace: 0 })
  }

  this.dragging = false
  this.state.swiping = false
  this.$emit('dragEnd', { index: this.activeIndicator })
}
```

**切换判定（满足其一即切换）：**

| 条件 | 含义 |
| --- | --- |
| `Math.abs(speed) > 0.25` | **快速滑动**：超过 250px/s，即使距离短也切换。 |
| `Math.abs(delta) > size / 2` | **距离过半**：滑动距离超过单项尺寸的一半。 |

#### move - 核心移动方法

```ts
move({ pace = 0, offset = 0, emitChange = false }) {
  if (this.count <= 1) return

  const { active } = this.state
  const targetActive = this.getTargetActive(pace)
  const targetOffset = this.getTargetOffset(targetActive, offset)

  if (this.$props.loop) {
    // 第一项：当轨道滑到最右边时，将第一项移到末尾
    if (this.children[0] && targetOffset !== this.minOffset) {
      const outRightBound = targetOffset < this.minOffset
      this.children[0].setOffset(outRightBound ? this.trackSize : 0)
    }
    // 最后一项：当轨道滑到最左边时，将最后一项移到开头
    if (this.children[this.count - 1] && targetOffset !== 0) {
      const outLeftBound = targetOffset > 0
      this.children[this.count - 1].setOffset(outLeftBound ? -this.trackSize : 0)
    }
  }

  this.state.active = targetActive
  this.state.offset = targetOffset

  if (emitChange && targetActive !== active) {
    this.$emit('change', this.activeIndicator)
  }

  this.startAutoplay()
}
```

**循环模式无缝原理：** 通过动态修改首尾 SwipeItem 的 `translateX` 偏移，在视觉上实现无缝循环。

#### next / prev / swipeTo

```ts
next() {
  this.correctPosition()
  this.touch.reset()
  raf2(() => {
    this.state.swiping = false
    this.move({ pace: 1, emitChange: true })
  })
}
```

**为什么用 raf2（两帧延迟）？** correctPosition 设置 swiping=true 瞬间修正位置。第 1 帧浏览器应用修正后的位置；第 2 帧 swiping=false 后 move 更新 offset，产生过渡动画。

#### correctPosition

```ts
correctPosition() {
  this.state.swiping = true
  if (this.state.active <= -1) {
    this.move({ pace: this.count })
  } else if (this.state.active >= this.count) {
    this.move({ pace: -this.count })
  }
}
```

#### startAutoplay / stopAutoplay

```ts
startAutoplay() {
  this.stopAutoplay()
  if (+this.$props.autoplay > 0 && this.count > 0) {
    this.autoplayTimer = setTimeout(() => { this.next() }, +this.$props.autoplay)
  }
}
```

使用 `setTimeout` 而非 `setInterval`，因为每次 next() 内部会重新调用 startAutoplay，确保自动播放间隔从动画**结束**后开始计时。

### 5.7 生命周期

```ts
created() {
  const { linkChildren, children } = useChildren<SwipeProvide>(this, SWIPE_KEY)
  linkChildren({ props: this.$props, state: this.reactiveState })
  this.children = children
}

mounted() {
  this.$nextTick(() => {
    this.initialize()
    const root = this.$refs.root as Element
    const { observe } = useVisibilityChange(root, (visible) => {
      if (visible) {
        if (this.isInited && this.size === 0) this.resize()
        this.startAutoplay()
      } else {
        this.stopAutoplay()
      }
    })
    observe()
  })

  const track = this.$refs.track as HTMLElement
  this.touchMoveListener = useEventListener('touchmove', this.onTouchMove, {
    target: track,
    passive: false
  })
  this.touchMoveListener.add()
}
```

`touchmove` 必须 `passive: false` 才能阻止页面滚动。

---

## 6. SwipeItem 子组件解析

### 6.1 模板

```html
<template>
  <div :class="bem()" :style="style">
    <template v-if="shouldRender">
      <slot></slot>
    </template>
  </div>
</template>
```

`shouldRender` 控制懒加载：只有当前及相邻的轮播项才渲染插槽内容。

### 6.2 脚本

```ts
export default Vue.extend({
  name,
  data() {
    return {
      parent: undefined as SwipeProvide | undefined,
      index: { value: -1 },
      rendered: false,
      state: { offset: 0, inited: false, mounted: false }
    }
  },
  created() {
    const { parent, index } = useParent<SwipeProvide>(this, SWIPE_KEY)
    if (!parent) {
      console.error('[Vivid] <swipe-item> must be a child component of <swipe>.')
      return
    }
    this.parent = parent
    this.index = index
  },
  mounted() {
    this.$nextTick(() => { this.state.mounted = true })
  }
})
```

### 6.3 关键计算属性

```ts
style() {
  const style: CSSProperties = {}
  if (!this.parent) return style
  const { vertical, transitionTimingFunction } = this.parent.props
  const parentSize = this.parent.state.size
  if (parentSize) style[vertical ? 'height' : 'width'] = `${parentSize}px`
  if (this.state.offset) {
    style.transform = `translate${vertical ? 'Y' : 'X'}(${this.state.offset}px)`
  }
  if (transitionTimingFunction) style.transitionTimingFunction = transitionTimingFunction
  return style
}

shouldRender() {
  if (!this.parent) return false
  const { loop, lazyRender } = this.parent.props
  const active = this.parent.state.activeIndicator
  const maxActive = this.parent.state.count - 1

  if (!lazyRender) return true
  if (this.rendered) return true
  if (!this.state.mounted) return false

  const prevActive = active === 0 && loop ? maxActive : active - 1
  const nextActive = active === maxActive && loop ? 0 : active + 1

  return this.index.value === active ||
    this.index.value === prevActive ||
    this.index.value === nextActive
}
```

懒加载渲染范围：`[active-1, active, active+1]`，循环模式下首尾相邻。

---

## 7. 样式层解析

### 7.1 Swipe 主组件样式

```scss
.v-swipe {
  --v-swipe-indicator-size: 6px;
  --v-swipe-indicator-margin: 12px;
  --v-swipe-indicator-active-opacity: 1;
  --v-swipe-indicator-inactive-opacity: 0.3;
  --v-swipe-indicator-active-background: var(--bg2);
  --v-swipe-indicator-inactive-background: #fff;

  position: relative;
  overflow: hidden;
  transform: translateZ(0);
  cursor: grab;
  user-select: none;

  &__track {
    display: flex;
    height: 100%;
    transition-property: transform;
    &--vertical { flex-direction: column; }
  }

  &__indicators {
    position: absolute;
    bottom: var(--v-swipe-indicator-margin);
    left: 50%;
    display: flex;
    transform: translateX(-50%);
    &--vertical {
      top: 50%;
      bottom: auto;
      left: var(--v-swipe-indicator-margin);
      flex-direction: column;
      transform: translateY(-50%);
    }
  }

  &__indicator {
    width: var(--v-swipe-indicator-size);
    height: var(--v-swipe-indicator-size);
    background-color: var(--v-swipe-indicator-inactive-background);
    border-radius: 100%;
    opacity: var(--v-swipe-indicator-inactive-opacity);
    transition: opacity 0.3s, background-color 0.3s;
    &:not(:last-child) { margin-right: var(--v-swipe-indicator-size); }
    &--active {
      background-color: var(--v-swipe-indicator-active-background);
      opacity: var(--v-swipe-indicator-active-opacity);
    }
  }
}
```

### 7.2 SwipeItem 样式

```scss
.v-swipe-item {
  position: relative;
  flex-shrink: 0;
  width: 100%;
  height: 100%;
}
```

---

## 8. 依赖的工具函数详解

### 8.1 useTouch - 触摸状态追踪

```ts
function useTouch() {
  const state = Vue.observable({
    startX: 0, startY: 0,
    deltaX: 0, deltaY: 0,
    offsetX: 0, offsetY: 0,
    direction: '' as 'horizontal' | 'vertical' | '',
    isTap: true
  })

  const move = (event: TouchEvent) => {
    const touch = event.touches[0]
    if (!touch) return
    state.deltaX = (touch.clientX < 0 ? 0 : touch.clientX) - state.startX
    state.deltaY = touch.clientY - state.startY
    state.offsetX = Math.abs(state.deltaX)
    state.offsetY = Math.abs(state.deltaY)

    const LOCK_DIRECTION_DISTANCE = 10
    if (!state.direction || (state.offsetX < LOCK_DIRECTION_DISTANCE ||
      state.offsetY < LOCK_DIRECTION_DISTANCE)) {
      state.direction = getDirection(state.offsetX, state.offsetY)
    }
  }
  // ...
}
```

方向锁定阈值 10px：滑动超过 10px 后锁定方向，避免斜向滑动时方向跳变。

### 8.2 useChildren / useParent

```ts
// 父组件
const { linkChildren, children } = useChildren<SwipeProvide>(this, SWIPE_KEY)
linkChildren({ props, state })

// 子组件
const { parent, index } = useParent<SwipeProvide>(this, SWIPE_KEY)
```

### 8.3 raf2 - 两帧延迟

```ts
const raf2 = (fn: FrameRequestCallback) => {
  return requestAnimationFrame(() => {
    requestAnimationFrame(fn)
  })
}
```

确保上一帧的 DOM 更新已被浏览器渲染，下一帧的样式变化能产生过渡动画。

---

## 9. 核心算法图解

### 9.1 循环模式无缝切换

```text
初始（active = 0，offset = 0）：
┌─视口─┐
[Item0] [Item1] [Item2]

向左滑到 active = 2：
              ┌─视口─┐
[Item0] [Item1] [Item2]

继续向左滑，active = 3（假位）→ correctPosition 修正为 0：

修正前：active = 3, offset = -3 * size
                       ┌─视口─┐
[Item0] [Item1] [Item2] [Item0']  ← Item0 被 setOffset(trackSize) 移到末尾

修正后（瞬间，swiping=true，无动画）：
┌─视口─┐
[Item0] [Item1] [Item2]            ← Item0 恢复原位
```

### 9.2 touchMove 跟手流程

```text
touchStart → touch.start() 记录起点
           → stopAutoplay()
           → correctPosition()
touchMove  → touch.move() 更新 delta
           → isCorrectDirection? + 非边缘
           → preventDefault()
           → move({ offset: delta })
touchEnd   → 计算 speed 和 delta
           → shouldSwipe? → move({ pace })
           → swiping = false 恢复 transition
```

---

## 10. 性能优化总结

| 优化手段 | 说明 |
| --- | --- |
| `touchstart.passive` | 声明不阻止默认事件，浏览器可立即开始触摸反馈。 |
| `touchmove passive: false` | 仅在需要 preventDefault 的事件上设置非被动。 |
| `translateX/Y + translateZ(0)` | 使用 transform 触发 GPU 复合层，避免重排重绘。 |
| `transition-property: transform` | 限定只有 transform 有过渡效果。 |
| `toFixed(2)` | 避免浮点精度问题导致的亚像素抖动。 |
| `swiping = true/false` | 拖拽中 duration=0 跟手，松手后 duration=500 过渡。 |
| `raf2` | 两帧延迟确保修正和切换不合并在同一帧。 |
| `useVisibilityChange` | 组件不可见时停止自动播放。 |
| `lazyRender` | 只渲染当前及相邻页内容。 |
| `setTimeout` vs `setInterval` | 每次 next 后重新计时，避免动画未完成就触发下一次。 |
| `windowWidth/Height` 单例 | 多个 Swipe 实例共享同一个 resize 监听器。 |

---

## 附录：导出文件（index.ts）

```ts
import Vue, { PluginObject } from 'vue'
import SwipeVue from './swipe.vue'

type SFCWithInstall<T> = T & PluginObject<never>

const withInstall = <T>(comp: T): SFCWithInstall<T> => {
  const c = comp as SFCWithInstall<T>
  c.install = (app: typeof Vue) => {
    const name = (comp as { name?: string }).name
    if (name) app.component(name, comp as any)
  }
  return c
}

const Swipe = withInstall(SwipeVue)
export { Swipe }
export default Swipe
```
