---
title: CORS 跨域资源共享
date: 2026-05-03
description: 同源策略是浏览器最核心的安全机制，CORS 是它的官方放行通道。本文梳理简单请求与预检请求的区分依据、OPTIONS 请求与响应中的 Access-Control-* 头字段，以及凭据与缓存的协商方式。
category: 网络
tags: [CORS, 跨域, 同源策略, 浏览器安全, HTTP]
lang: zh
draft: false
---

## 为什么会出现 CORS

因为同源策略。

同源策略是**浏览器**最核心的安全机制。它规定：默认情况下，客户端脚本只能访问与自身"同源"的资源。

**同源的定义：协议（Protocol）、域名（Domain）、端口（Port）三者必须完全一致。**

**目的：** 防止恶意网站窃取数据。如果没有同源策略，在 A 网站登录后的 Cookie 可能会被恶意网站 B 的脚本读取，从而伪造你的身份进行攻击（如 CSRF）。

## CORS 分为以下几个步骤来处理

- **预检请求（Preflight Request）**：对于某些类型的请求（如使用 HTTP 方法 PUT、DELETE，或者请求带有非简单头部），浏览器会首先发送一个 OPTIONS 请求，这个请求称为"预检请求"。服务器收到这个请求后，会返回一个响应头部，指明实际请求是否被允许。
- **实际请求（Actual Request）**：如果预检请求通过，浏览器会继续发送实际的请求。
- **响应头部（Response Headers）**：服务器在响应中会包含一些特定的 CORS 头部，如 `Access-Control-Allow-Origin`，以指示哪些域名可以访问资源。

我们在日常的开发中，经常会遇到跨域资源共享，或者进行跨域接口访问的情况。跨域资源共享（CORS）机制允许 Web 应用服务器进行跨域访问控制。

> 跨域资源共享标准新增了一组 HTTP 首部字段，允许服务器声明哪些源站通过浏览器有权限访问哪些资源。另外，规范要求，对那些可能对服务器数据产生副作用的 HTTP 请求方法（特别是 `GET` 以外的 HTTP 请求，或者搭配某些 MIME 类型的 `POST` 请求），浏览器必须首先使用 `OPTIONS` 方法发起一个预检请求（preflight request），从而获知服务端是否允许该跨域请求。服务器确认允许之后，才发起实际的 HTTP 请求。在预检请求的返回中，服务器端也可以通知客户端，是否需要携带身份凭证（包括 Cookies 和 HTTP 认证相关数据）。

在涉及到 CORS 的请求中，我们会把请求分为简单请求和复杂请求。

CORS 通过在 HTTP(s) 请求和响应中使用特定的头部字段来实现跨域资源共享，具体来说，CORS 分为两种类型的请求处理方式：简单请求和预检请求。

- **简单请求**：对于某些简单的 HTTP 请求（如 GET、POST 请求且不包含自定义头部），浏览器会直接发送请求，并在响应中检查 CORS 头部。
- **预检请求**：对于复杂请求（如使用 PUT、DELETE 方法，或包含自定义头部），浏览器会首先发送一个 OPTIONS 请求，称为预检请求（Preflight Request），以确定服务器是否允许实际请求。

## 简单请求

满足以下条件的请求即为简单请求：

- 请求方法：GET、POST、HEAD
- 除了以下的请求头字段之外，没有自定义的请求头：
  - Accept
  - Accept-Language
  - Content-Language
  - Content-Type
  - DPR
  - Downlink
  - Save-Data
  - Viewport-Width
  - Width
- Content-Type 的值只有以下三种：
  - `text/plain`
  - `multipart/form-data`
  - `application/x-www-form-urlencoded`
- 请求中的任意 `XMLHttpRequestUpload` 对象均没有注册任何事件监听器（未验证）
  - `XMLHttpRequestUpload` 对象可以使用
  - `XMLHttpRequest.upload` 属性访问

## 预检请求

对于复杂请求，浏览器会首先发送一个 `OPTIONS` 请求，包含以下头部字段：

- `Origin`：指示请求的源。
- `Access-Control-Request-Method`：指示实际请求将使用的方法。
- `Access-Control-Request-Headers`：指示实际请求将包含的自定义头部。

服务器收到预检请求后，会返回一个响应，包含以下头部字段以指示是否允许请求：

- `Access-Control-Allow-Origin`：表明允许访问资源的源，可以是具体的源或通配符 `*`；
- `Access-Control-Allow-Methods`：表明允许的方法，如 GET、POST、PUT、DELETE；
- `Access-Control-Allow-Headers`：表明允许的自定义头部；
- `Access-Control-Allow-Credentials`：表明是否允许发送凭据（如 Cookies）；
- `Access-Control-Expose-Headers`：表明哪些头部可以作为响应的一部分被访问；
- `Access-Control-Max-Age`：表明预检请求的结果可以被缓存的时间，单位是秒；
