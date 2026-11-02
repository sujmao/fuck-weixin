/*!
 * fuck-weixin v1.0.0
 * ------------------------------------------------------------------
 * 復現 Pixiv Viewer (pixiv.pictures) 在微信內置瀏覽器中顯示的
 * 「FUCK WECHAT」遮罩，並把檢測擴展到常見國產內置瀏覽器。
 *
 * 特性：
 *   - 零依賴、單文件、UMD（可 <script> / AMD / CommonJS / ESM import）
 *   - 純前端 User-Agent 檢測，無服務器、無 referer 依賴
 *   - 可任意網站嵌入、可完全自定義文案與樣式
 *   - 附「複製鏈接」按鈕，引導用戶用 Chrome / Edge / Safari 打開
 *
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

  // 檢測規則 —— 來源：對 Pixiv Viewer app.31596736.js 的逆向分析
  //   vA(): /MicroMessenger|QQ/i          -> 硬屏蔽，整頁「FUCK WECHAT」
  //   gA(): /Quark|QQBrowser|baidu|NewsArticle|UCBrowser|Huawei|HeyTap|Miui|Vivo|Oppo|360se|Sogou/i
  //                                        -> 軟屏蔽，清空 + 提示
  var PLATFORMS = [
    { token: "MicroMessenger", name: "微信 (WeChat)",    tier: "hard" },
    { token: "wxwork",         name: "企业微信 (WeCom)",  tier: "hard" },
    { token: "QQ",             name: "QQ",                tier: "hard" },
    { token: "Quark",          name: "夸克浏览器",        tier: "soft" },
    { token: "QQBrowser",      name: "QQ 浏览器",         tier: "soft" },
    { token: "baidu",          name: "百度 App",          tier: "soft" },
    { token: "NewsArticle",    name: "今日头条 / 资讯类", tier: "soft" },
    { token: "UCBrowser",      name: "UC 浏览器",         tier: "soft" },
    { token: "Huawei",         name: "华为浏览器",        tier: "soft" },
    { token: "HeyTap",         name: "OPPO / 一加",       tier: "soft" },
    { token: "Miui",           name: "小米浏览器",        tier: "soft" },
    { token: "Vivo",           name: "Vivo 浏览器",       tier: "soft" },
    { token: "Oppo",           name: "OPPO 浏览器",       tier: "soft" },
    { token: "360se",          name: "360 安全浏览器",    tier: "soft" },
    { token: "Sogou",          name: "搜狗浏览器",        tier: "soft" }
  ];

  var DEFAULTS = {
    title: "FUCK WECHAT",                            // 遮罩大標題
    tip: "请使用 Chrome / Edge / Safari 浏览器访问本站", // 提示文案
    hint: "点按下方按钮复制链接，粘贴到浏览器地址栏打开",  // 引導文案
    theme: "auto",                                   // auto | light | dark
    zIndex: 2147483647,                              // 遮罩層級
    copyButton: true,                                // 顯示「複製鏈接」按鈕
    copyText: "复制链接",
    copiedText: "已复制 ✓",
    extra: "",                                       // 額外自定義 HTML
    link: null,                                      // 要複製的鏈接，默認 location.href
    onBlock: null                                    // 命中時的回調 function(result, cfg)
  };

  var STYLE_ID = "fw-style";
  var OVERLAY_ID = "fw-overlay";
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

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      "#" + OVERLAY_ID + "{position:fixed;inset:0;z-index:" + DEFAULTS.zIndex + ";",
      "display:flex;align-items:center;justify-content:center;padding:24px;",
      "background:rgba(10,12,18,.82);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;}",
      "#" + OVERLAY_ID + " .fw-card{max-width:440px;width:100%;text-align:center;",
      "background:var(--fw-card,#161b26);color:var(--fw-text,#e8ecf4);",
      "border:1px solid var(--fw-border,rgba(255,255,255,.08));border-radius:20px;",
      "padding:40px 28px;box-shadow:0 24px 80px rgba(0,0,0,.5);}",
      "#" + OVERLAY_ID + " .fw-title{margin:0 0 8px;font-size:42px;font-weight:900;letter-spacing:.02em;",
      "line-height:1.1;color:var(--fw-accent,#ff3b5c);text-transform:uppercase;",
      "text-shadow:0 0 24px rgba(255,59,92,.35);}",
      "#" + OVERLAY_ID + " .fw-badge{display:inline-block;margin:0 0 18px;padding:5px 14px;",
      "font-size:13px;font-weight:600;border-radius:999px;",
      "background:var(--fw-accent-soft,rgba(255,59,92,.14));color:var(--fw-accent,#ff3b5c);}",
      "#" + OVERLAY_ID + " .fw-tip{margin:0 0 6px;font-size:16px;line-height:1.6;}",
      "#" + OVERLAY_ID + " .fw-hint{margin:0 0 24px;font-size:13px;opacity:.62;line-height:1.6;}",
      "#" + OVERLAY_ID + " .fw-btn{display:inline-block;padding:13px 30px;font-size:16px;font-weight:700;",
      "color:#fff;background:var(--fw-accent,#ff3b5c);border:none;border-radius:12px;cursor:pointer;",
      "transition:transform .12s ease,opacity .12s ease;}",
      "#" + OVERLAY_ID + " .fw-btn:hover{transform:translateY(-1px);opacity:.92;}",
      "#" + OVERLAY_ID + " .fw-extra{margin-top:18px;font-size:13px;opacity:.8;}",
      "#" + OVERLAY_ID + ".fw-light{--fw-card:#ffffff;--fw-text:#1a1e26;--fw-border:rgba(0,0,0,.08);}",
      "#" + OVERLAY_ID + ".fw-dark{--fw-card:#161b26;--fw-text:#e8ecf4;--fw-border:rgba(255,255,255,.08);}",
      "@media (max-width:480px){" + "#" + OVERLAY_ID + " .fw-title{font-size:34px;}" + "}"
    ].join("\n");
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function copyText(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    // 回退：兼容非 HTTPS / 舊 WebView
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        var ok = document.execCommand("copy");
        document.body.removeChild(ta);
        ok ? resolve() : reject(new Error("copy failed"));
      } catch (e) { reject(e); }
    });
  }

  function show(result, opts) {
    opts = opts || {};
    var cfg = {};
    for (var k in DEFAULTS) cfg[k] = DEFAULTS[k];
    for (var k2 in opts) cfg[k2] = opts[k2];

    if (cfg.theme !== "light" && cfg.theme !== "dark") {
      cfg.theme = (typeof matchMedia !== "undefined" &&
        matchMedia("(prefers-color-scheme: light)").matches) ? "light" : "dark";
    }

    injectStyle();

    var platform = result.matched.map(function (p) { return p.name; }).join(" / ");
    var badgeText = result.tier === "hard" ? "微信 / QQ 内置浏览器已拦截" : "内置浏览器已拦截";

    var card =
      '<div class="fw-card">' +
        '<h1 class="fw-title">' + escapeHtml(cfg.title) + "</h1>" +
        '<span class="fw-badge">' + escapeHtml(badgeText) + "</span>" +
        '<p class="fw-tip">' + escapeHtml(cfg.tip) + "</p>" +
        '<p class="fw-hint">' + escapeHtml(cfg.hint) + "</p>" +
        (cfg.copyButton ? '<button type="button" class="fw-btn" id="fw-copy">' + escapeHtml(cfg.copyText) + "</button>" : "") +
        (cfg.extra ? '<div class="fw-extra">' + cfg.extra + "</div>" : "") +
      "</div>";

    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.className = "fw-" + cfg.theme;
    overlay.innerHTML = card;
    document.body.appendChild(overlay);
    _overlay = overlay;

    var btn = overlay.querySelector("#fw-copy");
    if (btn) {
      btn.addEventListener("click", function () {
        var link = cfg.link || (typeof location !== "undefined" ? location.href : "");
        copyText(link).then(function () {
          var old = btn.textContent;
          btn.textContent = cfg.copiedText;
          setTimeout(function () { btn.textContent = old; }, 1800);
        }).catch(function () {
          btn.textContent = "请手动复制地址栏链接";
        });
      });
    }

    if (typeof cfg.onBlock === "function") {
      try { cfg.onBlock(result, cfg); } catch (e) { /* noop */ }
    }

    return { result: result, cfg: cfg, overlay: overlay };
  }

  function dismiss() {
    if (_overlay && _overlay.parentNode) _overlay.parentNode.removeChild(_overlay);
    _overlay = null;
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
    VERSION: "1.0.0",
    PLATFORMS: PLATFORMS,
    detect: detect,
    run: run,
    init: init,
    show: show,
    dismiss: dismiss,
    autoInit: autoInit,
    copyText: copyText
  };

  // 腳本標籤帶 data-auto 時自動執行
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
