---
title: Webpack 和 Vite 的区别
date: 2026-04-13
description: 从核心架构、冷启动、HMR、生产构建等角度对比 Webpack 全量打包与 Vite 按需编译，给出选型建议。
category: 工程化
tags: [Webpack, Vite, 构建工具, 前端工程化]
lang: zh
draft: false
---

## 1. 核心架构对比

### Webpack：全量打包

- 原理：在开发服务器启动前，Webpack 必须从入口文件开始，递归解析整个项目的依赖图，将所有模块打包成一个或多个巨大的 bundle.js，然后才能交给浏览器。
- 痛点：随着项目规模变大，热更新（HMR）和冷启动时间会指数级增加。即使只改一个字，Webpack 也可能需要重新构建相关的依赖链。

### Vite：按需编译（Unbundled）

- 原理：利用浏览器原生的 ES Modules (ESM) 特性。开发服务器启动时不需要打包，浏览器请求哪个文件，Vite 就现场处理哪个文件并返回。
- 优势：冷启动速度极快（通常小于 1s），且 HMR 性能与项目规模无关。

---

## 2. 关键性能差异

| 特性 | Webpack（传统模式） | Vite（现代模式） |
| --- | --- | --- |
| 冷启动速度 | 慢。需等待全量打包完成。 | 极快。借助原生 ESM 和 Go 编写的 Esbuild 进行预构建。 |
| 热更新（HMR） | 随规模变慢。需重新构建模块链。 | 恒定快。直接替换单个模块，利用浏览器缓存。 |
| 生产环境构建 | Webpack 自身打包。 | 使用 Rollup 打包（更小、更干净）。 |
| 配置复杂度 | 较高（Loader/Plugin 体系庞大）。 | 较低（内置了对 TS、CSS、Vue/React 的支持）。 |

---

## 3. 技术细节深挖

### A. 依赖预构建（Dependency Pre-Bundling）

Vite 在启动时会使用 Esbuild（用 Go 语言编写，比 JS 快 10-100 倍）将 CommonJS 依赖（如 React、Lodash）提前转换为 ESM，并合并零散文件。这是 Vite 既能享受 ESM 便利又能保持高性能的关键。

### B. 缓存策略

- Vite 充分利用了 HTTP 缓存。源码模块通过 `304 Not Modified` 缓存，依赖模块通过 `Cache-Control: max-age=31536000, immutable` 强缓存。
- Webpack 主要依赖内存缓存和物理磁盘缓存（filesystem cache），效率略逊一筹。

### C. 生态与稳定性

- Webpack：生态极其成熟，兼容性无敌，适合处理各种老旧库和复杂的微前端场景。
- Vite：代表未来趋势，但在某些复杂的 Legacy（老旧浏览器）支持上，仍需配置较多 Polyfill。

---

## 4. 总结：如何选择？

- 选择 Vite：如果你在开发新项目（Vue 3 / React 18），追求极致的开发体验和启动速度。
- 选择 Webpack：如果你需要维护老旧项目、需要极高度定制化的构建流程，或者项目包含大量不支持 ESM 的老旧依赖库。

一句话总结：Webpack 是在"做减法"（把万物合一），Vite 是在"做除法"（把任务拆分给浏览器）。
