---
title: "Hello, world"
date: 2026-05-17
description: "First post on the blog. About what it's for, its style, and what's coming next."
category: "Notes"
tags: ["start", "meta"]
pinned: true
lang: en
translationOf: "hello-world"
---

## Why this blog exists

For a long time I wanted a corner of the web that's entirely mine, where I can slowly write things that don't need to be "instant". Social media's publishing cadence is too fast, too fragmentary.

This will be slower.

## What I'll write about

Roughly three buckets:

1. **Engineering notes**: gotchas from projects, source code dives, deliberate-practice writeups
2. **Design jotting**: products, typefaces, and interaction details I admire
3. **Long reads on books**: every once in a while, a summary of recently-finished books

> Writing isn't about convincing anyone — it's about letting my own thinking become visible to myself.

## About this site

The stack is intentionally simple:

- Static site generated with [Astro](https://astro.build)
- **Tailwind CSS v4** for styling, reusing tokens validated in the `tailwind4` project
- Content is local Markdown; `git push` auto-deploys to GitHub Pages

A code sample looks like this:

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

Inline code reads like `inline code`.

### Todo

- [ ] Full-text search (Pagefind)
- [ ] RSS and sitemap
- [ ] Actually finish that first article I want to write

Hopefully this place slowly grows into an interesting little corner.

---

If you got this far, welcome.
