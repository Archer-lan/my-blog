---
title: "你好，世界"
date: 2026-05-17
description: "博客的第一篇文章。介绍这个站点的目标、风格、写些什么，以及当前已经有的内容。"
category: "随笔"
tags: ["开始", "meta"]
pinned: true
lang: zh
---

## 为什么有这个博客

很久以前我就想有一个完全属于自己的角落，可以慢慢写一些不那么"即时"的内容。社交媒体的发布节奏太快，碎片太多。

这里会更慢一点。

## 会写什么

最初设想的是工程笔记、设计随笔、读书总结三类。落地之后发现还是工程笔记占了大头——前端是我每天打交道的领域，从浏览器、网络协议到框架源码、构建工具、性能优化，很多东西如果不写下来，第二次遇到还得从头查一遍。

所以这里现在主要长成三块：

1. **学习笔记**：把第一次搞明白的东西尽量讲清楚，争取以后自己回来也能看懂
2. **工程实践**：组件设计、构建流程、CI/CD、迁仓——团队里真实写的代码、踩过的坑
3. **随笔**：少量，不在意频率

> 写作不是为了说服任何人，而是为了让自己的思考能被自己看见。

## 当前有些什么

打开导航栏的 **分类** 或 **标签**，里面已经堆了一些内容：

- **浏览器与渲染**：架构、渲染管线、缓存策略
- **网络**：HTTP/1~3、HTTPS、CORS、拦截器
- **JavaScript**：原型链、闭包、Promise、类型转换……
- **Vue**：Vue2/3 响应式原理、Proxy/Reflect、组合式 API
- **CSS**：层叠上下文、Flex 边界情况、移动端 300ms 延迟
- **工程化**：Webpack/Vite/Rollup、npm link、Cherry-Pick
- **算法**：少量 LeetCode 与并发控制
- **组件库**：Sticky、Swipe、Tabs 的实现剖析

按 `Cmd+K` 直接全文搜索；右上角能切中英文，订阅 [RSS](/my-blog/rss.xml) 也行。

## 关于这个站点

技术栈是我刻意挑了"低维护成本"的组合：

- 静态站点用 [Astro](https://astro.build) 生成，默认零客户端 JS，详情页首屏 < 100KB
- 样式 **Tailwind CSS v4**，配色 token 集中在 `app.css` 里一处定义
- 内容是本地 Markdown，写完 `git push` 自动构建并部署到 GitHub Pages
- 全文搜索用 [Pagefind](https://pagefind.app)：构建期生成索引、零后端、按需加载
- 中英双语，每篇可以独立维护翻译
- 评论用 Giscus 接 GitHub Discussions

代码示例长这样：

```ts
type Post = {
  title: string;
  date: Date;
  tags: string[];
};

function recent(posts: Post[], n = 5): Post[] {
  return posts
    .sort((a, b) => +b.date - +a.date)
    .slice(0, n);
}
```

行内代码用 `inline code` 这样表达；引用块、表格、TOC 侧栏、上一篇/下一篇都按现代杂志的排版来。

## 写在最前面的一句话

技术总会过时，但思考过的痕迹不会。如果某篇笔记帮到了你，或者你发现哪里写错了、想得不够清楚——欢迎在文末留言。

希望这里能慢慢长成一个有意思的小角落。

---

如果你看到了这里，欢迎。
