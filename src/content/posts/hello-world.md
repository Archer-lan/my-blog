---
title: "你好，世界"
date: 2026-05-17
description: "博客的第一篇文章。介绍这个站点的目标、风格、以及接下来会写些什么。"
category: "随笔"
tags: ["开始", "meta"]
pinned: true
lang: zh
---

## 为什么有这个博客

很久以前我就想有一个完全属于自己的角落，可以慢慢写一些不那么"即时"的内容。社交媒体的发布节奏太快，碎片太多。

这里会更慢一点。

## 会写什么

大致三类：

1. **工程笔记**：项目里踩过的坑、看完源码的总结、刻意练习的复盘
2. **设计随笔**：那些我喜欢的产品、字体、交互细节
3. **长读书**：每隔一段时间总结一次最近读完的几本书

> 写作不是为了说服任何人，而是为了让自己的思考能被自己看见。

## 关于这个站点

技术栈很简单：

- 静态站点用 [Astro](https://astro.build) 生成
- 样式用 **Tailwind CSS v4**，复用我在 `tailwind4` 项目里验证过的 token
- 内容是本地 Markdown，写完 `git push` 自动部署到 GitHub Pages

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

行内代码用 `inline code` 这样表达。

### 待办

- [ ] 接入全文搜索（Pagefind）
- [ ] 加上 RSS 与 sitemap
- [ ] 把第一篇真正想写的文章写完

希望这里能慢慢长成一个有意思的小角落。

---

如果你看到了这里，欢迎。
