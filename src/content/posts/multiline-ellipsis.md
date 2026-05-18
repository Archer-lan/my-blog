---
title: CSS 多行文本省略
date: 2025-08-13
description: 使用 -webkit-line-clamp 实现多行文本省略，以及打包器丢失 -webkit-box-orient 属性的注释保护方案。
category: CSS
tags: [CSS, 文本省略, autoprefixer]
lang: zh
draft: false
---

```css
display: -webkit-box; /* 设置为 WebKit 内核的弹性盒子模型 */
-webkit-box-orient: vertical; /* 垂直排列 */
-webkit-line-clamp: 3; /* 限制显示三行 */
overflow: hidden; /* 隐藏超出范围的内容 */
text-overflow: ellipsis; /* 使用省略号 */
```

在实际项目打包中，`-webkit-box-orient: vertical;` 属性会被打包器读为错误的 CSS 属性，即使使用 less 或 scss 时也是如此。

此处需要添加注释，避免在打包时此属性被删除。

```scss
/* autoprefixer: ignore next */
-webkit-box-orient: vertical;
```
