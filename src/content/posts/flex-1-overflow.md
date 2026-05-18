---
title: Flex:1 宽度超出父容器宽度的解决方案
date: 2025-09-10
description: flex:1 元素被长内容撑破容器的原因是 min-width:auto 默认值，加上 min-width:0 即可恢复正常压缩。
category: CSS
tags: [CSS, Flex布局, min-width]
lang: zh
draft: false
---

`flex: 1` 导致超出容器的根本原因是 CSS Flex 布局的默认 min-width 行为：

- Flex 项目默认 `min-width: auto`，意味着最小宽度由内容决定。
- 当输入框内容（如银行卡号）很长时，浏览器不会压缩到小于内容宽度。
- 添加 `min-width: 0` 告诉浏览器这个 flex 项目可以压缩到 0 宽度，从而遵守容器的宽度限制。

这样既保持了 `flex: 1` 的伸缩特性，又防止了内容撑破容器。

## 解决方案

```scss
min-width: 0;
```
