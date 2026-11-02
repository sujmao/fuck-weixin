/*!
 * fuck-weixin v2.0.0
 * ------------------------------------------------------------------
 * 100% 復現 Pixiv Viewer (pixiv.pictures) 在微信/QQ 內置瀏覽器中的攔截效果。
 *
 * 逆向自原站 app.31596736.js：
 *   vA(): /MicroMessenger|QQ/i.test(ua)
 *     => document.body.innerHTML = '<h1 style="margin:10px;font-size:32px">FUCK WECHAT</h1>'
 *        + alert({ message:"请使用 Chrome/Edge 浏览器访问本站", theme:"round-button" })
 *   gA(): /Quark|QQBrowser|baidu|NewsArticle|UCBrowser|Huawei|HeyTap|Miui|Vivo|Oppo|360se|Sogou/i.test(ua)
 *     => document.body.innerHTML = ""  + 同一個 alert
 *
 * 彈窗為 vant Dialog「round-button」主題的像素級復刻（白底、320px、圓角 16px、
 * 消息 14px #323233、通欄紅色 #ee0a24「确认」按鈕 36px、遮罩 rgba(0,0,0,.7)）。
 *
 * 特性：
 *   - 零依賴、單文件、UMD（<script> / AMD / CommonJS / ESM）
 *   - 純前端 UA 檢測，無服務器、無 referer 依賴
 *   - 可任意網站嵌入、可自定義 title / tip / confirmText
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

  // 檢測規則 —— 與原站一致（token / tier）
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
    title: "FUCK WECHAT",                                // 硬屏蔽時替換到 body 的標題（原站原文）
    tip: "请使用 Chrome/Edge 浏览器访问本站",             // 彈窗消息（原站 i18n 原文）
    confirmText: "确认",                                 // 彈窗按鈕（原站 common.confirm 原文）
    zIndex: 2500,                                        // 遮罩/彈窗層級（vant 默認 2500 附近）
    debug: false,                                        // true 時在彈窗底部加「重置預覽」，供桌面模擬用
    onBlock: null                                        // 命中回調 function(result, cfg)
  };

  var STYLE_ID = "fw-style";
  var OVERLAY_ID = "fw-overlay";
  var DIALOG_ID = "fw-dialog";
  var _savedHtml = null;   // 攔截前的 body.innerHTML（供 restore 恢復）
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
    var z = DEFAULTS.zIndex;
    var css = [
      // 遮罩：vant .van-overlay —— 固定、全屏、rgba(0,0,0,.7)
      "#" + OVERLAY_ID + "{position:fixed;top:0;left:0;width:100%;height:100%;",
      "background-color:rgba(0,0,0,.7);z-index:" + z + "}",
      // 彈窗：vant .van-dialog —— 固定、top 45%、left 50%、translate(-50%,-50%)、320px、白底、圓角 16px
      "#" + DIALOG_ID + "{position:fixed;top:45%;left:50%;width:320px;max-width:calc(100vw - 32px);",
      "overflow:hidden;font-size:16px;background-color:#fff;border-radius:16px;",
      "-webkit-transform:translate3d(-50%,-50%,0);transform:translate3d(-50%,-50%,0);",
      "z-index:" + (z + 1) + ";font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC',",
      "'Hiragino Sans GB','Microsoft YaHei',sans-serif}",
      // 內容區：無標題時 isolated —— 垂直居中、min-height 104px
      "#" + DIALOG_ID + " .fw-content{display:-webkit-flex;display:flex;",
      "-webkit-align-items:center;align-items:center;min-height:104px}",
      // 消息：vant .van-dialog__message + round-button 覆寫 padding-bottom:16px
      "#" + DIALOG_ID + " .fw-message{-webkit-flex:1;flex:1;max-height:60vh;",
      "padding:26px 24px 16px;overflow-y:auto;font-size:14px;line-height:20px;",
      "white-space:pre-wrap;text-align:center;word-wrap:break-word;color:#323233;box-sizing:border-box}",
      // 底部：round-button footer padding 8px 24px 16px
      "#" + DIALOG_ID + " .fw-footer{padding:8px 24px 16px}",
      // 確認按鈕：vant .van-dialog__confirm（type=danger #ee0a24 + size=large 通欄 + round-button 高度 36px）
      "#" + DIALOG_ID + " .fw-confirm{display:block;width:100%;height:36px;margin:0;padding:0;border:0;",
      "background-color:#ee0a24;color:#fff;font-size:16px;line-height:36px;text-align:center;",
      "border-radius:2px;cursor:pointer;-webkit-appearance:none;appearance:none;box-sizing:border-box}",
      // debug 預覽重置按鈕（僅桌面模擬時出現，不影響真實效果）
      "#" + DIALOG_ID + " .fw-debug-reset{display:block;margin:0 auto;padding:6px 12px;border:0;background:none;",
      "color:#999;font-size:12px;text-decoration:underline;cursor:pointer}"
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

    injectStyle();

    // 保存攔截前的 body，供 restore() 恢復（僅首次，避免覆蓋已保存的原頁）
    if (_savedHtml === null) _savedHtml = document.body.innerHTML;

    // 復現原站：硬屏蔽替換為 h1（原站原文），軟屏蔽清空
    document.body.innerHTML = result.tier === "hard"
      ? '<h1 style="margin:10px;font-size:32px">' + escapeHtml(cfg.title) + "</h1>"
      : "";

    // vant round-button alert
    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    var dialog = document.createElement("div");
    dialog.id = DIALOG_ID;
    dialog.setAttribute("role", "dialog");
    dialog.innerHTML =
      '<div class="fw-content"><div class="fw-message">' + escapeHtml(cfg.tip) + "</div></div>" +
      '<div class="fw-footer"><button type="button" class="fw-confirm">' + escapeHtml(cfg.confirmText) + "</button></div>" +
      (cfg.debug ? '<button type="button" class="fw-debug-reset">重置预览</button>' : "");

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    _overlay = overlay;

    // 確認 → 關閉彈窗（與原站一致，body 保持替換後狀態）
    dialog.querySelector(".fw-confirm").addEventListener("click", dismiss);
    if (cfg.debug) {
      dialog.querySelector(".fw-debug-reset").addEventListener("click", restore);
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
    VERSION: "2.0.0",
    PLATFORMS: PLATFORMS,
    detect: detect,
    run: run,
    init: init,
    show: show,
    dismiss: dismiss,
    restore: restore,
    autoInit: autoInit
  };

  // 腳本標籤帶 data-auto 時自動執行（真實微信訪問即觸發）
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
