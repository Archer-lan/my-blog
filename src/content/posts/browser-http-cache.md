---
title: 浏览器缓存与 HTTP 缓存
date: 2026-04-24
description: 系统梳理浏览器缓存机制：强缓存与协商缓存的判定流程、Cache-Control/Expires/ETag/Last-Modified 字段，以及内存与硬盘缓存的存储位置。
category: 性能优化
tags: [浏览器缓存, HTTP, Cache-Control, ETag, 性能优化]
lang: zh
draft: false
---

浏览器缓存的运作机制主要依赖于 HTTP 协议定义的规则。浏览器在请求阶段，会遵循一套严密的决策流程，主要分两个阶段：**强缓存** 和 **协商缓存**。

## 强缓存 (Strong Caching)

强缓存是"霸道"的缓存。如果命中强缓存，浏览器根本不会向服务器发送请求，直接从本地读取资源，速度最快。在 Chrome 开发者工具中显示为 `200 OK (from disk cache)` 或 `200 OK (from memory cache)`。

控制字段主要通过 HTTP 响应头中的 `Cache-Control` 和 `Expires` 来控制。

### Expires (HTTP/1.0)

- **原理**：服务器返回一个绝对时间（如 `Expires: Mon, 13 Apr 2026 12:00:00 GMT`）。
- **缺点**：依赖客户端本地时间，如果客户端时间偏差大，缓存会失效。

### Cache-Control (HTTP/1.1) —— 优先级最高

- **原理**：使用相对时间（如 `Cache-Control: max-age=3600`，表示 1 小时内有效）。
- **常见指令**：
    - `public`：所有内容（包括代理服务器/CDN）都可以缓存。
    - `private`：仅浏览器可以缓存（中间代理不行）。
    - `no-cache`：跳过强缓存，直接进入协商缓存阶段。
    - `no-store`：不使用任何缓存，每次都下载完整资源。

`Cache-Control` 优先级高于 `Expires`。

## 协商缓存 (Negotiated Caching)

当强缓存失效（例如 `max-age` 时间到了），浏览器会进入"协商"阶段。此时浏览器会向服务器发送请求，询问："我本地的这个资源还是最新的吗？"如果资源没变，服务器返回 `304 Not Modified`。

### Last-Modified / If-Modified-Since (基于时间)

- **流程**：服务器返回 `Last-Modified`（最后修改时间）。下次请求时，浏览器带上 `If-Modified-Since`。
- **缺点**：精度只有秒级；如果文件内容没变但修改时间变了，会导致缓存误失效。

### ETag / If-None-Match (基于内容指纹) —— 优先级更高

- **流程**：服务器根据文件内容生成一个唯一哈希值 `ETag`。下次请求时，浏览器带上 `If-None-Match`。
- **优点**：最精确。只要内容不变，`ETag` 就不变。

## 缓存存储位置

- **Memory Cache（内存缓存）**：响应速度最快，进程关闭（如关闭标签页）后失效。通常存放较小的脚本、字体、图片。
- **Disk Cache（硬盘缓存）**：容量大，速度稍慢，持久存储。

## 完整流程

1. **检查 `Cache-Control`/`Expires`**：
    - 有效 → `200 (from cache)`，流程结束。
    - 失效 → 进入下一步。
2. **发送请求携带 `If-None-Match`/`If-Modified-Since`**：
    - 服务器对比资源没变 → `304 (Not Modified)`，从本地读，流程结束。
    - 服务器对比资源已变 → `200 (OK)`，返回新资源，更新缓存。

## 总结对比

| 缓存类型 | 状态码 | 判定 Header | 优点 | 缺点 |
| --- | --- | --- | --- | --- |
| 强缓存 | 200 | `Cache-Control` / `Expires` | 速度最快，无网络消耗 | 资源更新不及时可能读到旧数据 |
| 协商缓存 | 304 | `ETag`、`Last-Modified` | 节省带宽，确保数据准确 | 仍需一次网络往返 (RTT) |
