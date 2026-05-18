---
title: Promise 全解：状态机、链式调用与手写实现
date: 2026-04-13
description: 从 Promise 状态机、实例方法到 all/race/allSettled，再到符合 Promises/A+ 的 MyPromise 手写实现。
category: JavaScript
tags: [JavaScript, Promise, 异步, ES6]
lang: zh
draft: false
---

## 一、介绍

Promise，译为承诺，是异步编程的一种解决方案，比传统的解决方案（回调函数）更加合理和更加强大。

在以往我们如果处理多层异步操作，我们往往会像下面那样编写我们的代码：

```javascript
doSomething(function(result) {
  doSomethingElse(result, function(newResult) {
    doThirdThing(newResult, function(finalResult) {
      console.log('得到最终结果: ' + finalResult);
    }, failureCallback);
  }, failureCallback);
}, failureCallback);
```

阅读上面代码，是不是很难受，上述形成了经典的回调地狱。

现在通过 Promise 改写上面的代码：

```javascript
doSomething().then(function(result) {
  return doSomethingElse(result);
})
.then(function(newResult) {
  return doThirdThing(newResult);
})
.then(function(finalResult) {
  console.log('得到最终结果: ' + finalResult);
})
.catch(failureCallback);
```

瞬间感受到 Promise 解决异步操作的优点：

- 链式操作减低了编码难度
- 代码可读性明显增强

下面我们正式来认识 Promise。

### 状态

Promise 对象仅有三种状态：

- `pending`（进行中）
- `fulfilled`（已成功）
- `rejected`（已失败）

### 特点

- 对象的状态不受外界影响，只有异步操作的结果，可以决定当前是哪一种状态
- 一旦状态改变（从 `pending` 变为 `fulfilled` 和从 `pending` 变为 `rejected`），就不会再变，任何时候都可以得到这个结果

## 二、用法

Promise 对象是一个构造函数，用来生成 Promise 实例：

```javascript
const promise = new Promise(function(resolve, reject) {});
```

Promise 构造函数接受一个函数作为参数，该函数的两个参数分别是 `resolve` 和 `reject`：

- `resolve` 函数的作用是，将 Promise 对象的状态从"未完成"变为"成功"
- `reject` 函数的作用是，将 Promise 对象的状态从"未完成"变为"失败"

### 实例方法

Promise 构建出来的实例存在以下方法：

- then()
- catch()
- finally()

### then()

`then` 是实例状态发生改变时的回调函数，第一个参数是 `resolved` 状态的回调函数，第二个参数是 `rejected` 状态的回调函数。

`then` 方法返回的是一个新的 Promise 实例，也就是 promise 能链式书写的原因。

```javascript
getJSON("/posts.json").then(function(json) {
  return json.post;
}).then(function(post) {
  // ...
});
```

### catch

`catch()` 方法是 `.then(null, rejection)` 或 `.then(undefined, rejection)` 的别名，用于指定发生错误时的回调函数。

```javascript
getJSON('/posts.json').then(function(posts) {
  // ...
}).catch(function(error) {
  // 处理 getJSON 和 前一个回调函数运行时发生的错误
  console.log('发生错误！', error);
});
```

Promise 对象的错误具有"冒泡"性质，会一直向后传递，直到被捕获为止：

```javascript
getJSON('/post/1.json').then(function(post) {
  return getJSON(post.commentURL);
}).then(function(comments) {
  // some code
}).catch(function(error) {
  // 处理前面三个 Promise 产生的错误
});
```

一般来说，使用 `catch` 方法代替 `then()` 第二个参数。

Promise 对象抛出的错误不会传递到外层代码，即不会有任何反应：

```javascript
const someAsyncThing = function() {
  return new Promise(function(resolve, reject) {
    // 下面一行会报错，因为x没有声明
    resolve(x + 2);
  });
};
```

浏览器运行到这一行，会打印出错误提示 `ReferenceError: x is not defined`，但是不会退出进程。

`catch()` 方法之中，还能再抛出错误，通过后面 `catch` 方法捕获到。

### finally()

`finally()` 方法用于指定不管 Promise 对象最后状态如何，都会执行的操作。

```javascript
promise
.then(result => {/* ... */})
.catch(error => {/* ... */})
.finally(() => {/* ... */});
```

### 构造函数方法

Promise 构造函数存在以下方法：

- all()
- race()
- allSettled()
- resolve()
- reject()
- try()

### all()

`Promise.all()` 方法用于将多个 Promise 实例，包装成一个新的 Promise 实例。

```javascript
const p = Promise.all([p1, p2, p3]);
```

接受一个数组（迭代对象）作为参数，数组成员都应为 Promise 实例。

实例 `p` 的状态由 `p1`、`p2`、`p3` 决定，分为两种：

- 只有 `p1`、`p2`、`p3` 的状态都变成 `fulfilled`，`p` 的状态才会变成 `fulfilled`，此时 `p1`、`p2`、`p3` 的返回值组成一个数组，传递给 `p` 的回调函数
- 只要 `p1`、`p2`、`p3` 之中有一个被 `rejected`，`p` 的状态就变成 `rejected`，此时第一个被 `reject` 的实例的返回值，会传递给 `p` 的回调函数

注意，如果作为参数的 Promise 实例，自己定义了 `catch` 方法，那么它一旦被 `rejected`，并不会触发 `Promise.all()` 的 `catch` 方法：

```javascript
const p1 = new Promise((resolve, reject) => {
  resolve('hello');
})
.then(result => result)
.catch(e => e);

const p2 = new Promise((resolve, reject) => {
  throw new Error('报错了');
})
.then(result => result)
.catch(e => e);

Promise.all([p1, p2])
.then(result => console.log(result))
.catch(e => console.log(e));
// ["hello", Error: 报错了]
```

如果 `p2` 没有自己的 `catch` 方法，就会调用 `Promise.all()` 的 `catch` 方法：

```javascript
const p1 = new Promise((resolve, reject) => {
  resolve('hello');
})
.then(result => result);

const p2 = new Promise((resolve, reject) => {
  throw new Error('报错了');
})
.then(result => result);

Promise.all([p1, p2])
.then(result => console.log(result))
.catch(e => console.log(e));
// Error: 报错了
```

### race()

`Promise.race()` 方法同样是将多个 Promise 实例，包装成一个新的 Promise 实例。

```javascript
const p = Promise.race([p1, p2, p3]);
```

只要 `p1`、`p2`、`p3` 之中有一个实例率先改变状态，`p` 的状态就跟着改变。

率先改变的 Promise 实例的返回值则传递给 `p` 的回调函数。

```javascript
const p = Promise.race([
  fetch('/resource-that-may-take-a-while'),
  new Promise(function (resolve, reject) {
    setTimeout(() => reject(new Error('request timeout')), 5000)
  })
]);

p
.then(console.log)
.catch(console.error);
```

### allSettled()

`Promise.allSettled()` 方法接受一组 Promise 实例作为参数，包装成一个新的 Promise 实例。

只有等到所有这些参数实例都返回结果，不管是 `fulfilled` 还是 `rejected`，包装实例才会结束。

```javascript
const promises = [
  fetch('/api-1'),
  fetch('/api-2'),
  fetch('/api-3'),
];

await Promise.allSettled(promises);
removeLoadingIndicator();
```

### resolve()

将现有对象转为 Promise 对象。

```javascript
Promise.resolve('foo')
// 等价于
new Promise(resolve => resolve('foo'))
```

参数可以分成四种情况：

- 参数是一个 Promise 实例，`Promise.resolve` 将不做任何修改、原封不动地返回这个实例
- 参数是一个 `thenable` 对象，`Promise.resolve` 会将这个对象转为 Promise 对象，然后就立即执行 `thenable` 对象的 `then()` 方法
- 参数不是具有 `then()` 方法的对象，或根本就不是对象，`Promise.resolve()` 会返回一个新的 Promise 对象，状态为 `resolved`
- 没有参数时，直接返回一个 `resolved` 状态的 Promise 对象

### reject()

`Promise.reject(reason)` 方法也会返回一个新的 Promise 实例，该实例的状态为 `rejected`。

```javascript
const p = Promise.reject('出错了');
// 等同于
const p = new Promise((resolve, reject) => reject('出错了'))

p.then(null, function (s) {
  console.log(s)
});
// 出错了
```

`Promise.reject()` 方法的参数，会原封不动地变成后续方法的参数：

```javascript
Promise.reject('出错了')
.catch(e => {
  console.log(e === '出错了')
})
// true
```

## 三、使用场景

将图片的加载写成一个 Promise，一旦加载完成，Promise 的状态就发生变化：

```javascript
const preloadImage = function (path) {
  return new Promise(function (resolve, reject) {
    const image = new Image();
    image.onload  = resolve;
    image.onerror = reject;
    image.src = path;
  });
};
```

通过链式操作，将多个渲染数据分别给个 `then`，让其各司其职。或当下个异步请求依赖上个请求结果的时候，我们也能够通过链式操作友好解决问题：

```javascript
// 各司其职
getInfo().then(res=>{
    let { bannerList } = res
    //渲染轮播图
    console.log(bannerList)
    return res
}).then(res=>{
    let { storeList } = res
    //渲染店铺列表
    console.log(storeList)
    return res
}).then(res=>{
    let { categoryList } = res
    console.log(categoryList)
    //渲染分类列表
    return res
})
```

通过 `all()` 实现多个请求合并在一起，汇总所有请求结果，只需设置一个 `loading` 即可：

```javascript
function initLoad(){
    // loading.show() //加载loading
    Promise.all([getBannerList(),getStoreList(),getCategoryList()]).then(res=>{
        console.log(res)
        loading.hide() //关闭loading
    }).catch(err=>{
        console.log(err)
        loading.hide()//关闭loading
    })
}
//数据初始化
initLoad()
```

通过 `race` 可以设置图片请求超时：

```javascript
//请求某个图片资源
function requestImg(){
    var p = new Promise(function(resolve, reject){
        var img = new Image();
        img.onload = function(){
           resolve(img);
        }
        img.src = "https://b-gold-cdn.xitu.io/v3/static/img/logo.a7995ad.svg1";
    });
    return p;
}

//延时函数，用于给请求计时
function timeout(){
    var p = new Promise(function(resolve, reject){
        setTimeout(function(){
            reject('图片请求超时');
        }, 5000);
    });
    return p;
}

Promise
.race([requestImg(), timeout()])
.then(function(results){
    console.log(results);
})
.catch(function(reason){
    console.log(reason);
});
```

## 四、Promise 的实现

### 1. Promise 的核心原理

- **状态机机制**：Promise 必须处于三种状态之一：
  - `pending`（进行中）
  - `fulfilled`（已成功）
  - `rejected`（已失败）

  状态只能从 `pending` 转为 `fulfilled` 或 `rejected`，且一旦转变不可逆。
- **回调存储**：`then` 可能在异步结果返回前被调用，因此需要用数组缓存成功与失败回调。
- **异步执行**：`then` 中的回调必须在当前执行栈清空后异步执行（微任务优先，或使用宏任务兜底）。

### 2. 逐步实现 MyPromise

我们可以按照规范逐步构建。

#### 第一步：基础结构与状态转换

```javascript
class MyPromise {
	constructor(executor) {
		this.state = 'pending';
		this.value = undefined;
		this.reason = undefined;
		this.onResolvedCallbacks = [];
		this.onRejectedCallbacks = [];

		const resolve = (value) => {
			if (this.state === 'pending') {
				this.state = 'fulfilled';
				this.value = value;
				this.onResolvedCallbacks.forEach((fn) => fn());
			}
		};

		const reject = (reason) => {
			if (this.state === 'pending') {
				this.state = 'rejected';
				this.reason = reason;
				this.onRejectedCallbacks.forEach((fn) => fn());
			}
		};

		try {
			executor(resolve, reject);
		} catch (err) {
			reject(err);
		}
	}
}
```

#### 第二步：实现 then 方法（支持异步与链式调用）

`then` 的关键在于：**返回一个新的 Promise**，并对回调返回值做统一解析（普通值或 Promise）。

```javascript
then(onFulfilled, onRejected) {
	onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : (value) => value;
	onRejected = typeof onRejected === 'function' ? onRejected : (err) => { throw err };

	const promise2 = new MyPromise((resolve, reject) => {
		if (this.state === 'fulfilled') {
			queueMicrotask(() => {
				try {
					const x = onFulfilled(this.value);
					resolvePromise(promise2, x, resolve, reject);
				} catch (e) {
					reject(e);
				}
			});
		}

		if (this.state === 'rejected') {
			queueMicrotask(() => {
				try {
					const x = onRejected(this.reason);
					resolvePromise(promise2, x, resolve, reject);
				} catch (e) {
					reject(e);
				}
			});
		}

		if (this.state === 'pending') {
			this.onResolvedCallbacks.push(() => {
				queueMicrotask(() => {
					try {
						const x = onFulfilled(this.value);
						resolvePromise(promise2, x, resolve, reject);
					} catch (e) {
						reject(e);
					}
				});
			});

			this.onRejectedCallbacks.push(() => {
				queueMicrotask(() => {
					try {
						const x = onRejected(this.reason);
						resolvePromise(promise2, x, resolve, reject);
					} catch (e) {
						reject(e);
					}
				});
			});
		}
	});

	return promise2;
}
```

#### 第三步：核心解析函数 resolvePromise

这是 Promise 实现中最复杂的部分，用于处理 `then` 回调返回的不同类型（普通值或另一个 Promise）。

```javascript
function resolvePromise(promise2, x, resolve, reject) {
	if (promise2 === x) {
		return reject(new TypeError('Chaining cycle detected for promise'));
	}

	if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
		let called = false;
		try {
			const then = x.then;
			if (typeof then === 'function') {
				then.call(
					x,
					(y) => {
						if (called) return;
						called = true;
						resolvePromise(promise2, y, resolve, reject);
					},
					(r) => {
						if (called) return;
						called = true;
						reject(r);
					}
				);
			} else {
				resolve(x);
			}
		} catch (e) {
			if (called) return;
			called = true;
			reject(e);
		}
	} else {
		resolve(x);
	}
}
```

## 总结

一个完整的 Promise 实现需要：

1. **构造函数**：初始化状态与回调队列。
2. **then 方法**：支持链式调用（返回新 Promise），并通过微任务保证异步。
3. **resolvePromise**：递归解析返回值，兼容不同 Promise 与 thenable。
