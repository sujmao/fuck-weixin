# fuck-weixin

> 100% 复现 `pixiv.pictures`（第三方 Pixiv Viewer）在微信内置浏览器打开时显示的全屏遮罩 **「FUCK WECHAT」**，
> 并把检测扩展到常见国产内置浏览器。单文件、零依赖、可嵌入任何个性化网站。

在线演示（GitHub Pages）：https://`<你的用户名>`.github.io/fuck-weixin/

---

## 一、背景：这个效果是怎么来的（逆向调查）

`https://pixiv.pictures/i/55655838` 返回的其实是一个 SPA 壳（约 6KB 的 HTML），
遮罩并非服务端按 UA 返回不同页面，而是**前端 JS 动态渲染**的。检测与渲染逻辑位于 `app.31596736.js`：

```js
// 硬屏蔽（微信 / QQ）
if (/MicroMessenger|QQ/i.test(navigator.userAgent))
  throw document.body.innerHTML = '<h1 style="margin:10px;font-size:32px">FUCK WECHAT</h1>',
        B.lG.alert({ message: X.t("tip.browser_tip"), theme: "round-button" }),
        new Error("BLOCKED.");

// 软屏蔽（国产内置浏览器）
if (/Quark|QQBrowser|baidu|NewsArticle|UCBrowser|Huawei|HeyTap|Miui|Vivo|Oppo|360se|Sogou/i.test(navigator.userAgent))
  throw document.body.innerHTML = "",
        B.lG.alert({ message: X.t("tip.browser_tip"), theme: "round-button" }),
        new Error("BLOCKED.");
```

其中 `tip.browser_tip = "请使用 Chrome/Edge 浏览器访问本站"`，`common.confirm = "确认"`。

**本质**：纯粹的 `navigator.userAgent` 正则匹配 + 替换 `body.innerHTML` + 一个 vant 风格弹窗，与服务端、referer、IP 无关。

## 二、本仓库如何做到「完全相同」

原站首次访问会**按设备自动套用视觉主题**（`app.31596736.js` 中的主题初始化逻辑），弹窗外观随之改变：

```js
/iPhone|iPod|Macintosh|MacIntel/i.test(ua) => 视觉主题 "ios26"   // iOS
/Android/i.test(ua)                        => 视觉主题 "md"      // Android
```

本仓库按原站**逐字复现**（含这三套视觉主题），body 替换与弹窗文案完全一致：

| 项 | 原站 | 本仓库 |
|---|---|---|
| 硬屏蔽 body | `<h1 style="margin:10px;font-size:32px">FUCK WECHAT</h1>` | 完全一致 |
| 软屏蔽 body | `""`（清空） | 完全一致 |
| 遮罩（ios26） | `transparent` 透明 | 完全一致 |
| 遮罩（md / 默认） | `rgba(0,0,0,.7)` 全屏 | 完全一致 |
| 弹窗（ios26） | 毛玻璃白底 `hsla(0,0%,100%,.88)`、`border-radius:28px`、内嵌阴影、`backdrop-filter:saturate(180%) blur(16px)` | 完全一致 |
| 弹窗（md） | `#ece6f0` 底、`border-radius:28px` | 完全一致 |
| 弹窗（默认） | 白底、`border-radius:16px`、`width:320px`、`top:45%` 居中 | 完全一致 |
| 消息 | `请使用 Chrome/Edge 浏览器访问本站`，14px，居中 | 完全一致 |
| 确认按钮（ios26） | 透明背景、红字 `#ff3b30`、药丸形 `border-radius:999px`、36px 高 | 完全一致 |
| 确认按钮（md） | `#ece6f0` 底、方角 `border-radius:0` | 完全一致 |
| 确认按钮（默认） | 通栏、红 `#ee0a24`、白字、`border-radius:2px`、36px 高 | 完全一致 |

弹窗复刻的是 vant Dialog **`round-button`** 主题（原站 `B.lG.alert` 即 vant 的 `Dialog.alert`），
视觉主题的覆盖规则与 `--md-sys-*` / `--ios-*` token 均逐条还原。

## 三、检测原理

各平台内置浏览器都在 User-Agent 里带上特征 token：

| 平台 | UA token | 层级 |
|---|---|---|
| 微信 | `MicroMessenger` | hard |
| 企业微信 | `wxwork` | hard |
| QQ | `QQ` | hard |
| 夸克 | `Quark` | soft |
| QQ 浏览器 | `QQBrowser` | soft |
| 百度 App | `baidu` | soft |
| 今日头条 / 资讯类 | `NewsArticle` | soft |
| UC 浏览器 | `UCBrowser` | soft |
| 华为浏览器 | `Huawei` | soft |
| OPPO / 一加 | `HeyTap` | soft |
| 小米浏览器 | `Miui` | soft |
| Vivo | `Vivo` | soft |
| OPPO | `Oppo` | soft |
| 360 安全浏览器 | `360se` | soft |
| 搜狗浏览器 | `Sogou` | soft |

> 与原站一致：`QQ` 归 `hard`（命中即 FUCK WECHAT），其余国产浏览器归 `soft`（清空 body 不显示标题）。

## 四、快速开始

### 方式 A：script 标签 + 自动拦截（最省事）

```html
<script src="fuck-weixin.js" data-auto></script>
```

脚本加载后自动检测 UA，命中即替换 body 并弹出与原站一致的弹窗。

### 方式 B：手动调用

```html
<script src="fuck-weixin.js"></script>
<script>
  FuckWeixin.init();       // 读真实 UA 检测并渲染
</script>
```

### 方式 C：只检测、不渲染

```js
const r = FuckWeixin.detect();
// { ua, matched:[{token,name,tier}], tier:'hard'|'soft'|null, blocked:true|false }
```

### 方式 D：npm / ESM

```js
import FuckWeixin from "fuck-weixin";
FuckWeixin.init();
```

## 五、API 与配置

| 方法 | 说明 |
|---|---|
| `FuckWeixin.detect(ua?)` | 检测，返回结果对象，不渲染 |
| `FuckWeixin.run(ua, opts)` | 检测 + 命中时渲染（`ua` 可传入，便于模拟） |
| `FuckWeixin.init(opts)` | 读取真实 UA 检测并渲染 |
| `FuckWeixin.show(result, opts)` | 手动渲染 |
| `FuckWeixin.dismiss()` | 关闭弹窗（body 保持替换后状态，与原站一致） |
| `FuckWeixin.restore()` | 关闭弹窗并恢复拦截前的 body（demo 用） |
| `FuckWeixin.autoInit()` | 按 `window.FUCK_WEIXIN_CONFIG` 自动初始化 |
| `FuckWeixin.PLATFORMS` | 平台表（可覆盖/追加） |

配置项（`init` / `run` / `show` 的 `opts`）：

| 选项 | 默认值 | 说明 |
|---|---|---|
| `title` | `"FUCK WECHAT"` | 硬屏蔽时替换到 body 的标题（原站原文） |
| `tip` | `"请使用 Chrome/Edge 浏览器访问本站"` | 弹窗消息（原站原文） |
| `confirmText` | `"确认"` | 弹窗按钮文案 |
| `theme` | `"auto"` | 视觉主题：`auto`（按设备自动）/`ios26`/`md`/`default` |
| `zIndex` | `2500` | 遮罩/弹窗层级 |
| `debug` | `false` | `true` 时弹窗底部显示「重置预览」（桌面模拟用） |
| `onBlock(result, cfg)` | `null` | 命中回调 |

全局开关：

- `window.FUCK_WEIXIN_DISABLE = true` → 关闭自动拦截
- `window.FUCK_WEIXIN_AUTO = true` → 等价于 `data-auto`
- `window.FUCK_WEIXIN_CONFIG = { ...opts }` → 自动初始化时的配置

## 六、自定义（换标题 / 换检测名单）

```js
// 自定义文案
FuckWeixin.init({ title: "请在浏览器打开", tip: "微信内打开受限，请用浏览器访问" });

// 追加 / 覆盖平台名单
FuckWeixin.PLATFORMS.push({ token: "MyApp", name: "某内置浏览器", tier: "soft" });
```

## 七、测试

1. **桌面浏览器**：打开 `index.html`，点顶部按钮模拟各平台 UA，预览遮罩与文案；弹窗内「重置预览」恢复页面。
2. **真实微信**：把部署后的 GitHub Pages 链接发到「文件传输助手」，在微信里点开；或复制链接用「扫一扫」识别二维码访问。
3. Chrome DevTools「Network conditions → User agent」伪造 `MicroMessenger` UA 也可验证。

## 八、部署到 GitHub Pages

仓库根目录就是站点（`index.html` + `fuck-weixin.js`）：

1. `Settings → Pages → Source` 选 `Deploy from a branch`，分支 `main`，目录 `/ (root)`。
2. 保存后约 1 分钟，访问 `https://<用户名>.github.io/fuck-weixin/`。
3. 这个链接发给微信，即可复现「FUCK WECHAT」遮罩。

## 九、License

MIT
