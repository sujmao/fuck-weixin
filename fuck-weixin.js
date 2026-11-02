/*!
 * fuck-weixin v3.0.0
 * ------------------------------------------------------------------
 * 100% 复现 Pixiv Viewer (pixiv.pictures) 在微信/QQ 内置浏览器中的拦截效果。
 *
 * 逆向自原站 app.31596736.js：
 *   vA(): /MicroMessenger|QQ/i.test(ua)
 *     => document.body.innerHTML = '<h1 style="margin:10px;font-size:32px">FUCK WECHAT</h1>'
 *        + Dialog.alert({ message:"请使用 Chrome/Edge 浏览器访问本站", theme:"round-button" })
 *   gA(): /Quark|QQBrowser|baidu|NewsArticle|UCBrowser|Huawei|HeyTap|Miui|Vivo|Oppo|360se|Sogou/i.test(ua)
 *     => document.body.innerHTML = ""  + 同一个 alert
 *
 * 原站首次访问会按设备自动套用视觉主题（视觉主题会改变弹窗外观）：
 *   /iPhone|iPod|Macintosh|MacIntel/i => "ios26"（遮罩透明、毛玻璃白底 28px 圆角、按钮透明红字）
 *   /Android/i                        => "md"（#ece6f0 底 28px 圆角、方角按钮）
 *   其它                              => 默认 vant 浅色（白底 16px 圆角、红色实心按钮）
 *
 * 零依赖、单文件、UMD，可嵌入任意网站。
 * MIT License
 * ------------------------------------------------------------------
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define([], factory);
  } else {
    root.FuckWeixin = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var PLATFORMS = [
    { token: "MicroMessenger", name: "微信 (WeChat)",   tier: "hard" },
    { token: "wxwork",         name: "企业微信 (WeCom)", tier: "hard" },
    { token: "QQ",             name: "QQ",               tier: "hard" },
    { token: "Quark",          name: "夸克浏览器",       tier: "soft" },
    { token: "QQBrowser",      name: "QQ 浏览器",        tier: "soft" },
    { token: "baidu",          name: "百度 App",         tier: "soft" },
    { token: "NewsArticle",    name: "今日头条 / 资讯类", tier: "soft" },
    { token: "UCBrowser",      name: "UC 浏览器",        tier: "soft" },
    { token: "Huawei",         name: "华为浏览器",       tier: "soft" },
    { token: "HeyTap",         name: "OPPO / 一加",      tier: "soft" },
    { token: "Miui",           name: "小米浏览器",       tier: "soft" },
    { token: "Vivo",           name: "Vivo 浏览器",      tier: "soft" },
    { token: "Oppo",           name: "OPPO 浏览器",      tier: "soft" },
    { token: "360se",          name: "360 安全浏览器",   tier: "soft" },
    { token: "Sogou",          name: "搜狗浏览器",       tier: "soft" }
  ];

  var DEFAULTS = {
    title: "FUCK WECHAT",
    tip: "请使用 Chrome/Edge 浏览器访问本站",
    confirmText: "确认",
    zIndex: 2500,
    theme: "auto",       // auto | ios26 | md | default
    debug: false,
    onBlock: null
  };

  var STYLE_ID = "fw-style";
  var OVERLAY_ID = "fw-overlay";
  var DIALOG_ID = "fw-dialog";
  var _savedHtml = null;
  var _overlay = null;

  function detect(ua) {
    ua = ua || (typeof navigator !== "undefined" ? navigator.userAgent : "") || "";
    var matched = [];
    for (var i = 0; i < PLATFORMS.length; i++) {
      if (ua.indexOf(PLATFORMS[i].token) !== -1) matched.push(PLATFORMS[i]);
    }
    var hard = matched.filter(function (p) { return p.tier === "hard"; });
    var tier = hard.length ? "hard" : (matched.length ? "soft" : null);
    return { ua: ua, matched: matched, tier: tier, blocked: !!tier };
  }

  // 与原站一致的设备主题判断
  function resolveTheme(ua) {
    ua = ua || "";
    if (/iPhone|iPod|Macintosh|MacIntel/i.test(ua)) return "ios26";
    if (/Android/i.test(ua)) return "md";
    return "default";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var z = DEFAULTS.zIndex;
    var css = [
      // —— 基础（vant .van-dialog / .van-overlay）——
      "#" + OVERLAY_ID + "{position:fixed;top:0;left:0;width:100%;height:100%;z-index:" + z + "}",
      "#" + DIALOG_ID + "{position:fixed;top:45%;left:50%;width:320px;max-width:calc(100vw - 32px);",
      "overflow:hidden;font-size:16px;-webkit-transform:translate3d(-50%,-50%,0);transform:translate3d(-50%,-50%,0);",
      "z-index:" + (z + 1) + ";font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',",
      "'Hiragino Sans GB','Microsoft YaHei',sans-serif}",
      "#" + DIALOG_ID + " .fw-content{display:-webkit-flex;display:flex;-webkit-align-items:center;align-items:center;min-height:104px}",
      "#" + DIALOG_ID + " .fw-message{-webkit-flex:1;flex:1;max-height:60vh;padding:26px 24px 16px;",
      "overflow-y:auto;font-size:14px;line-height:20px;white-space:pre-wrap;text-align:center;",
      "word-wrap:break-word;box-sizing:border-box}",
      "#" + DIALOG_ID + " .fw-footer{padding:8px 24px 16px}",
      "#" + DIALOG_ID + " .fw-confirm{display:block;width:100%;height:36px;margin:0;padding:0;border:0;",
      "font-size:16px;line-height:36px;text-align:center;cursor:pointer;box-sizing:border-box;-webkit-appearance:none;appearance:none}",
      "#" + DIALOG_ID + " .fw-debug-reset{display:block;margin:0 auto;padding:6px 12px;border:0;background:none;",
      "color:#999;font-size:12px;text-decoration:underline;cursor:pointer}",

      // —— default：vant 浅色（白底 16px 圆角、红色实心按钮、遮罩 rgba(0,0,0,.7)）——
      "#" + OVERLAY_ID + ".fw-default{background-color:rgba(0,0,0,.7)}",
      "#" + DIALOG_ID + ".fw-default{background-color:#fff;border-radius:16px}",
      "#" + DIALOG_ID + ".fw-default .fw-message{color:#323233}",
      "#" + DIALOG_ID + ".fw-default .fw-confirm{background-color:#ee0a24;color:#fff;border-radius:2px}",

      // —— ios26：遮罩透明、毛玻璃白底 28px 圆角 + 内嵌阴影、按钮透明红字药丸 ——
      "#" + OVERLAY_ID + ".fw-ios26{background:transparent}",
      "#" + DIALOG_ID + ".fw-ios26{background:hsla(0,0%,100%,.88);border-radius:28px;",
      "-webkit-backdrop-filter:saturate(180%) blur(16px);backdrop-filter:saturate(180%) blur(16px);",
      "box-shadow:inset -1px -1px 0 -0.5px #fff,inset 1px 1px 0 -0.5px #fff,",
      "inset 3px 3px 10px -3px #ddd,inset -3px -3px 10px -3px #ddd,",
      "inset 0 0 5px 1px #fff,inset 0 0 0 0.5px rgba(0,0,0,.251),",
      "inset 0 0 24px 0 rgba(0,0,0,.102),0 0 25px 0 rgba(0,0,0,.2)}",
      "#" + DIALOG_ID + ".fw-ios26 .fw-message{color:#323233}",
      "#" + DIALOG_ID + ".fw-ios26 .fw-confirm{background:transparent;color:#ff3b30;border-radius:999px}",

      // —— md：Material 3 浅色（#ece6f0 底 28px 圆角、方角按钮）——
      "#" + OVERLAY_ID + ".fw-md{background-color:rgba(0,0,0,.7)}",
      "#" + DIALOG_ID + ".fw-md{background:#ece6f0;color:#1d1b20;border-radius:28px}",
      "#" + DIALOG_ID + ".fw-md .fw-message{color:#1d1b20}",
      "#" + DIALOG_ID + ".fw-md .fw-confirm{background:#ece6f0;color:#ee0a24;border-radius:0}"
    ].join("\n");
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function show(result, opts) {
    opts = opts || {};
    var cfg = {};
    for (var k in DEFAULTS) cfg[k] = DEFAULTS[k];
    for (var k2 in opts) cfg[k2] = opts[k2];

    var theme = cfg.theme === "auto" ? resolveTheme(result.ua) : cfg.theme;
    injectStyle();

    if (_savedHtml === null) _savedHtml = document.body.innerHTML;

    // 复现原站：硬屏蔽替换为 h1（原站原文），软屏蔽清空
    document.body.innerHTML = result.tier === "hard"
      ? '<h1 style="margin:10px;font-size:32px">' + escapeHtml(cfg.title) + "</h1>"
      : "";

    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "fw-" + theme;
    var dialog = document.createElement("div");
    dialog.id = DIALOG_ID;
    dialog.className = "fw-" + theme;
    dialog.setAttribute("role", "dialog");
    dialog.innerHTML =
      '<div class="fw-content"><div class="fw-message">' + escapeHtml(cfg.tip) + "</div></div>" +
      '<div class="fw-footer"><button type="button" class="fw-confirm">' + escapeHtml(cfg.confirmText) + "</button></div>" +
      (cfg.debug ? '<button type="button" class="fw-debug-reset">重置预览</button>' : "");

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    _overlay = overlay;

    dialog.querySelector(".fw-confirm").addEventListener("click", dismiss);
    if (cfg.debug) dialog.querySelector(".fw-debug-reset").addEventListener("click", restore);

    if (typeof cfg.onBlock === "function") {
      try { cfg.onBlock(result, cfg); } catch (e) { /* noop */ }
    }

    return { result: result, cfg: cfg, theme: theme, overlay: overlay };
  }

  function dismiss() {
    if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
    _overlay = null;
  }

  function restore() {
    dismiss();
    if (_savedHtml !== null) {
      document.body.innerHTML = _savedHtml;
      _savedHtml = null;
    }
  }

  function run(ua, opts) {
    var r = detect(ua);
    if (!r.blocked) return { blocked: false, result: r };
    var s = show(r, opts || {});
    return { blocked: true, result: r, show: s };
  }

  function init(opts) {
    return run(typeof navigator !== "undefined" ? navigator.userAgent : "", opts);
  }

  function autoInit() {
    if (typeof window !== "undefined" && window.FUCK_WEIXIN_DISABLE) return null;
    var cfg = (typeof window !== "undefined" && window.FUCK_WEIXIN_CONFIG) || {};
    return init(cfg);
  }

  var api = {
    VERSION: "3.0.0",
    PLATFORMS: PLATFORMS,
    detect: detect,
    resolveTheme: resolveTheme,
    run: run,
    init: init,
    show: show,
    dismiss: dismiss,
    restore: restore,
    autoInit: autoInit
  };

  if (typeof document !== "undefined") {
    var cs = document.currentScript;
    var auto = (cs && cs.getAttribute && cs.hasAttribute("data-auto")) ||
               (typeof window !== "undefined" && window.FUCK_WEIXIN_AUTO);
    if (auto) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", autoInit);
      } else {
        autoInit();
      }
    }
  }

  return api;
});
