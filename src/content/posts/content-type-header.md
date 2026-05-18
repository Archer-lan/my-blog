---
title: 请求头 Content-Type
date: 2025-08-20
description: Content-Type 是 HTTP 请求/响应中用来指明数据格式的字段，俗称 MIME 媒体类型。本文列出前端常见的取值场景：HTML、JSON、表单提交、文件上传、二进制流等。
category: 网络
tags: [HTTP, Content-Type, MIME, 请求头]
lang: zh
draft: false
---

Content-Type 用来指定不同格式的请求/响应信息，俗称 **MIME 媒体类型**。

## 常见的取值

- `text/html`：HTML 格式
- `text/plain`：纯文本格式
- `text/xml`：XML 格式
- `image/gif`：gif 图片格式
- `image/jpeg`：jpg 图片格式
- `image/png`：png 图片格式
- `application/json`：JSON 数据格式
- `application/pdf`：pdf 格式
- `application/octet-stream`：二进制流数据，一般是文件下载
- `application/x-www-form-urlencoded`：form 表单默认的提交数据的格式，会编码成 `key=value` 格式
- `multipart/form-data`：表单中需要上传文件的文件格式类型
