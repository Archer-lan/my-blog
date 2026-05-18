---
title: 浏览器检测手机晃动：devicemotion API 实战
date: 2026-04-07
description: 通过 devicemotion 事件结合加速度向量计算手机晃动，包含 iOS 13+ 权限申请与防抖处理。
category: JavaScript
tags: [JavaScript, 浏览器 API, DeviceMotion, 移动端]
lang: zh
draft: false
---

使用浏览器的 `devicemotion API`。

加速度为 X、Y 和 Z 轴上提供的数值，此处是检测晃动，我们不需要考虑手机的朝向。

我们只需要计算加速度向量的总大小。

公式为：

$$
Magnitude = √(x² + y² + z²)
$$

我们使用加速度（`accelerationIncludingGravity`）来表示。

静止的手机加速度大约为 9.8（重力常量），晃动产生超过 15-20 的峰值。

## 申请权限

在 iOS 13+ 等设备中，该权限不是浏览器的默认权限，需要申请才能获取。

```javascript
function requestPermission() {
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then(response => {
        if (response == 'granted') {
          window.addEventListener('devicemotion', handleMotion);
        }
      })
      .catch(console.error);
  } else {
    // Non-iOS devices don't need permission
    window.addEventListener('devicemotion', handleMotion);
  }
}
```

## 计算逻辑

此处实现了一个防抖，当真正晃动时，可能会 1 秒内触发 50 次。

```javascript
let lastShake = 0;
const MIN_INTERVAL = 1000; // Wait 1 sec between shakes

function handleMotion(event) {
  const acc = event.accelerationIncludingGravity;
  if (!acc) return;

  // Calculate Magnitude
  const total = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2);

  // Threshold of 15 is a good starting point
  if (total > 15) {
    const now = Date.now();
    if (now - lastShake > MIN_INTERVAL) {
      lastShake = now;
      alert("Shake Detected!");
    }
  }
}
```
