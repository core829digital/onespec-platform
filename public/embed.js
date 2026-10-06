/*!
 * onespec embed loader v1
 *
 *   <script async src="https://YOUR-PLATFORM/embed.js" data-onespec="PUBLIC_ID"></script>
 *
 * Puts the configurator on the page where the tag stands: it creates the <iframe> (lazy, titled, full width), keeps its height equal
 * to the widget's content (no inner scrollbar) and, when a visitor sends a request, fires a DOM event the site can listen to:
 *
 *   window.addEventListener("onespec:submitted", function (e) { /* e.detail.publicId * / });
 *
 * Optional attributes: data-lang (it|en|fr|de|nl|ro), data-theme (light|dark|auto), data-accent (#RRGGBB), data-font,
 * data-target (CSS selector of the element to fill instead of "right after the script"), data-min-height (300-2000, default 640),
 * data-title (accessible name of the frame).
 *
 * Plain ES5, no dependencies, no eval, no innerHTML. The page that embeds the widget must be listed under "Authorised sites"
 * of the configurator (the widget refuses to be framed anywhere else).
 */
(function () {
  "use strict";
  if (window.__onespecLoader) { window.__onespecLoader.scan(); return; }

  var ID_RE = /^[A-Za-z0-9_-]{6,16}$/;
  var LANGS = { it: 1, en: 1, fr: 1, de: 1, nl: 1, ro: 1 };
  var THEMES = { light: 1, dark: 1, auto: 1 };
  var frames = []; // { id, origin, iframe }

  function clampInt(value, min, max, fallback) {
    var n = parseInt(value, 10);
    if (!isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function widgetUrl(script, id) {
    var origin;
    try {
      var u = new URL(script.src, document.baseURI);
      if (u.protocol !== "https:" && u.protocol !== "http:") return null;
      origin = u.origin;
    } catch (e) { return null; }
    var params = [];
    var lang = (script.getAttribute("data-lang") || "").toLowerCase();
    if (LANGS[lang] === 1) params.push("lang=" + lang);
    var theme = (script.getAttribute("data-theme") || "").toLowerCase();
    if (THEMES[theme] === 1) params.push("theme=" + theme);
    var accent = script.getAttribute("data-accent") || "";
    if (/^#[0-9a-fA-F]{6}$/.test(accent)) params.push("accent=" + encodeURIComponent(accent));
    var font = script.getAttribute("data-font") || "";
    if (font && font.length <= 60 && /^[A-Za-z0-9 ,'-]+$/.test(font)) params.push("font=" + encodeURIComponent(font));
    return { origin: origin, href: origin + "/w/" + id + (params.length ? "?" + params.join("&") : "") };
  }

  function mount(script) {
    if (script.getAttribute("data-onespec-done")) return;
    script.setAttribute("data-onespec-done", "1");
    var id = script.getAttribute("data-onespec") || "";
    if (!ID_RE.test(id)) return;
    var target = widgetUrl(script, id);
    if (!target) return;

    var iframe = document.createElement("iframe");
    iframe.src = target.href;
    iframe.title = (script.getAttribute("data-title") || "Configuratore").slice(0, 120);
    iframe.setAttribute("loading", "lazy");
    iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    iframe.setAttribute("allowtransparency", "true");
    iframe.style.cssText = "display:block;width:100%;max-width:100%;border:0;overflow:hidden;min-height:" + clampInt(script.getAttribute("data-min-height"), 300, 2000, 640) + "px";
    iframe.setAttribute("scrolling", "no");

    var holder = null;
    var selector = script.getAttribute("data-target");
    if (selector) { try { holder = document.querySelector(selector); } catch (e) { holder = null; } }
    if (holder) holder.appendChild(iframe);
    else if (script.parentNode) script.parentNode.insertBefore(iframe, script.nextSibling);
    else return;

    frames.push({ id: id, origin: target.origin, iframe: iframe });
  }

  function fire(name, id, iframe) {
    var event;
    try { event = new CustomEvent(name, { detail: { publicId: id }, bubbles: true }); }
    catch (e) { event = document.createEvent("CustomEvent"); event.initCustomEvent(name, true, false, { publicId: id }); }
    iframe.dispatchEvent(event); // bubbles up to window
  }

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || typeof d !== "object" || typeof d.type !== "string") return;
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      // Only the frame we created, only from the platform's own origin, only for its own widget id.
      if (e.source !== f.iframe.contentWindow || e.origin !== f.origin || d.publicId !== f.id) continue;
      if (d.type === "onespec:resize" && typeof d.height === "number" && isFinite(d.height)) {
        f.iframe.style.height = Math.min(20000, Math.max(200, Math.ceil(d.height))) + "px";
      } else if (d.type === "onespec:submitted" || d.type === "onespec:ready") {
        fire(d.type, f.id, f.iframe);
      }
      return;
    }
  });

  function scan() {
    var scripts = document.querySelectorAll("script[data-onespec]");
    for (var i = 0; i < scripts.length; i++) mount(scripts[i]);
  }

  window.__onespecLoader = { scan: scan, version: 1 };
  scan();
})();
