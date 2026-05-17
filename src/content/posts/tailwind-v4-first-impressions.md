---
title: "Tailwind v4 第一印象"
date: 2026-05-05
description: "从 v3 升级到 v4 的几点感受：配置消失了，CSS 变量变成了一等公民。"
category: "工程笔记"
tags: ["tailwind", "css", "frontend"]
lang: zh
---

## 配置文件消失了

v3 时代的 `tailwind.config.ts` 在 v4 里几乎可以删掉。所有定制都通过 CSS 的 `@theme` 完成：

```css
@theme {
  --font-sans: "Inter", system-ui, sans-serif;
  --color-accent: #67e8f9;
}
```

定义之后，`bg-accent` `text-accent` 这些工具类自动可用。

## CSS 变量是一等公民

每一个 token 在浏览器里都是真正的 CSS 变量，意味着：

- 不需要构建工具就能动态切换主题
- DevTools 里能直接看到值
- 第三方组件可以直接消费

## 引擎重写

构建速度比 v3 快了一个量级。我的工程几千个工具类，冷启动从 ~800ms 降到 ~100ms。

## 一点不爽

`@apply` 还能用，但不再被推荐。文档建议直接用工具类，少数情况下用 `@utility` 自定义。对于已经习惯把样式抽到组件 `.css` 文件的人来说，会有一段调整期。

整体上是值得升级的。
