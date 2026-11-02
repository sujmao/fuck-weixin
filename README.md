# fuck-weixin

> 复现 `pixiv.pictures`（第三方 Pixiv Viewer）在微信内置浏览器打开时显示的全屏遮罩 **「FUCK WECHAT」**，
> 并把检测扩展到常见国产内置浏览器。单文件、零依赖、可嵌入任何个性化网站。

在线演示（GitHub Pages）：https://`<你的用户名>`.github.io/fuck-weixin/

---

## 一、背景：这个效果是怎么来的（逆向调查）

`https://pixiv.pictures/i/55655838` 返回的其实是一个 SPA 壳（约 6KB 的 HTML），
遮罩并非服务端按 UA 返回不同页面，而是**前端 JS 动态渲染**的。检测逻辑位于 `app.31596736.js` 中：

| 层级 | 检测正则（源码） | 命中的平台 | 效果 |
|---|---|---|---|
| 硬屏蔽 | `/MicroMessenger\|QQ/i` | **微信 WeChat**、**QQ** | 清空 body → `<h1>FUCK WECHAT</h1>` + 弹窗 |
| 软屏蔽 | `/Quark\|QQBrowser\|baidu\|NewsArticle\|UCBrowser\|Huawei\|HeyTap\|Miui\|Vivo\|Oppo\|360se\|Sogou/i` | 夸克、QQ浏览器、百度、今日头条/资讯类、UC、华为、OPPO/一加、小米、Vivo、OPPO、360、搜狗 | 清空 body + 弹窗 |
| 提示文案 | `tip.browser_tip` | — | 「请使用 Chrome/Edge 浏览器访问本站」 |
| （无关）内容/地区门 | `PXV_NSFW_ON` + `zh` | 非 UA | 跳转验证页 `/zq39i1hjru.html` |

**本质**：纯粹的 `navigator.userAgent` 正则匹配，与服务端、referer、IP 无关。所以可以做成一段可复用的前端脚本。

## 二、检测原理

各平台内置浏览器都会在 User-Agent 里带上自己的特征 token：

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

> 注意 `MicroMessenger` 与 `QQ` 的匹配顺序：QQ 浏览器 UA 里也可能带 `QQ`，实测 Pixiv Viewer 用同一个正则，
> 会一并命中硬屏蔽。本仓库按 token 精确拆分，默认层级照搬原站（`QQ` 归 hard）。

## 三、快速开始

### 方式 A：script 标签 + 自动拦截（最省事）

```html
<script src="fuck-weixin.js" data-auto></script>
```

脚本加载后自动检测 UA，命中即在 `<body>` 末尾插入全屏遮罩。

### 方式 B：手动调用

```html
<script src="fuck-weixin.js"></script>
<script>
  FuckWeixin.init({
    title: "FUCK WECHAT",
    tip: "请使用 Chrome / Edge / Safari 浏览器访问本站",
    hint: "点按下方按钮复制链接，粘贴到浏览器打开"
  });
</script>
```

### 方式 C：只检测、不渲染

```js
const r = FuckWeixin.detect();          // 默认读 navigator.userAgent
// { ua, matched:[{token,name,tier}], tier:'hard'|'soft'|null, blocked:true|false }

if (r.blocked) {
  // 自己决定怎么处理
}
```

### 方式 D：npm / ESM

```js
import FuckWeixin from "fuck-weixin";
FuckWeixin.init();
```

## 四、API 与配置

| 方法 | 说明 |
|---|---|
| `FuckWeixin.detect(ua?)` | 检测，返回结果对象，不渲染 |
| `FuckWeixin.run(ua, opts)` | 检测 + 命中时渲染（`ua` 可传入，便于模拟） |
| `FuckWeixin.init(opts)` | 读取真实 UA 检测并渲染 |
| `FuckWeixin.show(result, opts)` | 手动渲染遮罩 |
| `FuckWeixin.dismiss()` | 关闭遮罩 |
| `FuckWeixin.autoInit()` | 按 `window.FUCK_WEIXIN_CONFIG` 自动初始化 |
| `FuckWeixin.copyText(text)` | 复制文本（含旧 WebView 回退） |
| `FuckWeixin.PLATFORMS` | 平台表（可覆盖/追加） |

配置项（`init` / `run` / `show` 的 `opts`）：

| 选项 | 默认值 | 说明 |
|---|---|---|
| `title` | `"FUCK WECHAT"` | 遮罩大标题 |
| `tip` | `"请使用 Chrome / Edge / Safari 浏览器访问本站"` | 提示文案 |
| `hint` | `"点按下方按钮复制链接…"` | 引导文案 |
| `theme` | `"auto"` | `auto` / `light` / `dark` |
| `zIndex` | `2147483647` | 遮罩层级 |
| `copyButton` | `true` | 是否显示「复制链接」按钮 |
| `copyText` / `copiedText` | `"复制链接"` / `"已复制 ✓"` | 按钮文案 |
| `extra` | `""` | 额外自定义 HTML |
| `link` | `location.href` | 要复制的链接 |
| `onBlock(result, cfg)` | `null` | 命中回调 |

全局开关：

- `window.FUCK_WEIXIN_DISABLE = true` → 关闭自动拦截
- `window.FUCK_WEIXIN_AUTO = true` → 等价于 `data-auto`
- `window.FUCK_WEIXIN_CONFIG = { ...opts }` → 自动初始化时的配置

## 五、自定义（换标题 / 换检测名单）

```js
// 追加自己的平台
FuckWeixin.PLATFORMS.push({ token: "MyApp", name: "某内置浏览器", tier: "soft" });

// 或整体覆盖
FuckWeixin.PLATFORMS = [
  { token: "MicroMessenger", name: "微信", tier: "hard" }
];

FuckWeixin.init({ title: "请在浏览器中打开", tip: "微信内打开受限，请点击右上角 → 在浏览器中打开" });
```

## 六、测试

1. **桌面浏览器**：打开 demo 的 `index.html`，用顶部按钮模拟各平台 UA，预览遮罩与文案。
2. **真实微信**：把部署后的 GitHub Pages 链接发到「文件传输助手」，在微信里点开；或复制链接用「扫一扫」识别二维码访问。
3. 用 Chrome DevTools 的「Network conditions → User agent」也可以直接伪造 `MicroMessenger` UA 验证。

## 七、部署到 GitHub Pages

仓库根目录就是站点（`index.html` + `fuck-weixin.js`）：

1. `Settings → Pages → Source` 选择 `Deploy from a branch`，分支 `main`，目录 `/ (root)`。
2. 保存后约 1 分钟，访问 `https://<用户名>.github.io/fuck-weixin/`。
3. 这个链接发给微信，即可复现「FUCK WECHAT」遮罩。

> GitHub Pages 是 HTTPS，剪贴板 API 与「复制链接」按钮可正常工作；在微信内长按链接同样可复制。

## 八、License

MIT
