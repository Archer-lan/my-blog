---
title: 移动端 touchend 与 click 之间 300ms 延迟的由来与移除
date: 2025-09-10
description: 移动浏览器在 touchend 与 click 之间留 300-350ms 是为等待双击放大手势；通过 viewport 标签或 touch-action 即可移除。
category: CSS
tags: [移动端, click延迟, viewport, touch-action]
lang: zh
draft: false
---

多年来，移动浏览器在 **`touchend`** 和 **`click`** 之间应用了 300-350 毫秒的延迟，以等待确定是否要执行双击操作，因为双击是用于放大文本的手势。

自 Android 版 Chrome 首次发布以来，如果同时停用了双指张合缩放功能，系统就会移除此延迟。不过，双指张合缩放是一项重要的无障碍功能。从 Chrome 32（2014 年）开始，**针对移动设备进行了优化的网站**，**这种延迟现象已消失**，**而无需移除双指张合缩放功能**！不久之后，Firefox 和 IE/Edge 也采取了相同的做法，2016 年 3 月，iOS 9.3 中也推出了类似的修复程序。

效果差异很大！

界面能够立即响应意味着用户可以放心地快速按下每个按钮，而无需暂停等待响应。如需详细了解人体反应时间和网站性能的影响，请参阅 [RAIL 简介](https://web.dev/articles/rail?hl=zh-cn)。

如需移除 300-350 毫秒的点按延迟，只需在网页的 `<head>` 中添加以下代码即可：

```html
<meta name="viewport" content="width=device-width">
```

这会将视口宽度设置为与设备相同，通常是针对移动设备进行了优化的网站的最佳实践。使用此标记后，浏览器会假定您已使文本在移动设备上可读，并会舍弃双击放大功能，以加快点击速度。

如果您因某种原因无法进行此更改，则可以使用 `touch-action: manipulation` 在整个网页或特定元素上实现相同的效果：

```css
html {
  touch-action: manipulation;
}
```

## 旧版浏览器的表现如何？

[FT Labs 的 FastClick](https://github.com/ftlabs/fastclick) 使用轻触事件更快地触发点击，并移除了双击手势。它会查看您的手指在 `touchstart` 和 `touchend` 之间移动的距离，以区分滚动和点按。

向所有内容添加 `touchstart` 监听器会对性能产生影响，因为滚动等较低级别的互动会因调用监听器来查看其是否 `event.preventDefault()` 而延迟。幸运的是，如果浏览器已移除 300 毫秒的延迟时间，FastClick 会避免设置监听器，这样您就可以同时兼得两者的好处。
