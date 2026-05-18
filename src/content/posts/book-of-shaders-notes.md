---
title: The Book of Shaders 学习笔记
date: 2026-05-03
description: 跟随 The Book of Shaders 学习 GLSL 着色器：Hello World、uniforms、gl_FragCoord 与 shaping 函数。
category: WebGL
tags: [WebGL, GLSL, Shader, 图形学]
lang: zh
draft: false
---

> 参考：[The Book of Shaders](https://thebookofshaders.com/)

## Hello World

这里渲染出来一个紫色的色块：

```glsl
#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;

void main() {
    gl_FragColor = vec4(1.000, 0.459, 0.967, 0.900);
}
```

`Shader` 语言有自己单独的 `main` 函数，最后返回一个色值，就像 C 语言一样。最终的像素色值被赋值保存在变量 `gl_FragColor` 中。

这里展示了 `vec4`，代表浮点数精度的四维矢量，之后还会有 `vec3`、`vec2`，以及 `float`、`int` 和 `bool`。`vec4` 中分别代表 `RGBA` 的值，同时我们将它们归一化，即值在 `0-1` 之间。

此段代码中还含有预处理的宏存在，`#define`，宏是预编译步骤的一部分。使用它们可以定义全局变量并进行一些基本的条件操作（使用 `#ifdef` 和 `#endif`）。所有的宏命令都以井号 `#` 开头。预编译发生在编译之前，它会复制所有的 `#define` 调用并检查 `#ifdef`（是否已定义）和 `#ifndef`（是否未定义）条件。

浮点类型在着色器中至关重要，因此精度水平非常关键。精度较低意味着渲染速度更快，但会牺牲质量。你可以挑剔并指定使用浮点数的每个变量的精度。在第二行（`precision mediump float;`）中，我们将所有浮点数设置为中等精度。但我们也可以选择将它们设置为低（`precision lowp float;`）或高（`precision highp float;`）。

`glsl` 不是自动检测类型的，如将 `gl_FragColor` 值赋值为 `vec4(1,0,0,1)` 这会导致错误。需要自己添加对应的 `.`。

## Uniforms

传递数据，用于只读。支持 `float`、`vec2`、`vec3`、`vec4`、`mat2`、`mat3`、`mat4`、`sampler2D` 和 `samplerCube`：

```glsl
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;  // Canvas size (width,height)
uniform vec2 u_mouse;       // mouse position in screen pixels
uniform float u_time;       // Time in seconds since load
```

让我们看看 uniforms 的实际应用。在下面的代码中，我们使用 `u_time`（着色器开始运行后的秒数）与正弦函数一起，来动画化 billboard 中红色量的过渡：

```glsl
#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;

void main() {
    gl_FragColor = vec4(abs(sin(u_time)), 0.0, 0.0, 1.0);
}
```

GPU 支持这些函数，并有对应的硬件加速处理：`sin()`、`cos()`、`tan()`、`asin()`、`acos()`、`atan()`、`pow()`、`exp()`、`log()`、`sqrt()`、`abs()`、`sign()`、`floor()`、`ceil()`、`fract()`、`mod()`、`min()`、`max()` 和 `clamp()`。

## gl_FragCoord

GLSL 给我们默认的输出方式 `vec4 gl_FragColor`，同样也给我们默认的输入方式 `vec4 gl_FragCoord`，它保存了当前活动线程正在处理的像素或屏幕片段的屏幕坐标。

在上述代码中，我们将片段的坐标通过除以整个 billboard 的分辨率进行归一化。这样做可以使值介于 0.0 和 1.0 之间，从而可以轻松地将 X 和 Y 值映射到 RED 和 GREEN 通道。

```glsl
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution; // 屏幕分辨率
uniform vec2 u_mouse;      // 鼠标当前位置
uniform float u_time;      // 程序运行时间

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;
    gl_FragColor = vec4(st.x, st.y, 0.0, 1.0);
}
```

`gl_FragCoord.xy / u_resolution` 是当前像素在屏幕上的绝对像素坐标（例如：x 从 0 到 1920）。除以 `u_resolution`，`st` 的值被缩放到 0.0 到 1.0 之间。

## Shaping Function

```glsl
#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

// Plot a line on Y using a value between 0.0-1.0
float plot(vec2 st) {
    return smoothstep(0.02, 0.0, abs(st.y - st.x));
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;

    float y = st.x;

    vec3 color = vec3(y);

    // Plot a line
    float pct = plot(st);
    color = (1.0 - pct) * color + pct * vec3(0.0, 1.0, 0.0);

    gl_FragColor = vec4(color, 1.0);
}
```

**1. 核心数学逻辑：`y = x`**

```glsl
float y = st.x;
vec3 color = vec3(y);
```

- 这里定义了一个简单的线性函数：输出值 `y` 等于水平坐标 `x`。
- `vec3(y)` 会产生一个从左到右由黑变白的背景渐变，这代表了函数值的大小。

> 此处为灰色，因为 `vec3` 只给一个参数时，会自动填充到所有的分量中。`vec3(y)` 等同于 `vec3(y, y, y)`。在颜色原理上，等值的 RGB 等于灰色，表现为灰阶图。

**2. 绘制线条的函数 `plot`**

这是这段代码最精妙的地方：

```glsl
float plot(vec2 st) {
    return smoothstep(0.02, 0.0, abs(st.y - st.x));
}
```

- `abs(st.y - st.x)`：计算当前像素的 `y` 坐标和 `x` 坐标之间的距离。如果像素正好在对角线上，距离就是 0。
- `smoothstep(0.02, 0.0, ...)`：
    - 这是一个插值函数。它检查距离是否在 0.0 到 0.02 之间。
    - 如果距离非常小（靠近 0），它返回 1.0（表示在线上）。
    - 如果距离超过 0.02，它返回 0.0（表示不在线上）。
    - **作用**：它为线条提供了抗锯齿（Anti-aliasing）效果，让线条边缘看起来很平滑，而不是充满了阶梯状的像素点。

**3. 颜色混合（混合背景与线条）**

```glsl
float pct = plot(st);
color = (1.0 - pct) * color + pct * vec3(0.0, 1.0, 0.0);
```

- `pct (percentage)` 是线条的强度：在线上是 1.0，不在是 0.0。
- 这行代码本质上是执行了一个 `mix` 操作：
    - 当 `pct` 为 0 时，保留原始背景色 `color`。
    - 当 `pct` 为 1 时，颜色完全变为绿色 `vec3(0.0, 1.0, 0.0)`。

## Advance Shaping Function

- Polynomial Shaping Functions: [www.flong.com/archive/texts/code/shapers_poly](http://www.flong.com/archive/texts/code/shapers_poly/)
- Exponential Shaping Functions: [www.flong.com/archive/texts/code/shapers_exp](http://www.flong.com/archive/texts/code/shapers_exp/)
- Circular & Elliptical Shaping Functions: [www.flong.com/archive/texts/code/shapers_circ](http://www.flong.com/archive/texts/code/shapers_circ/)
- Bezier and Other Parametric Shaping Functions: [www.flong.com/archive/texts/code/shapers_bez](http://www.flong.com/archive/texts/code/shapers_bez/)
