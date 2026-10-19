/*!
 * onespec embed loader v1
 *
 *   <script async src="https://YOUR-PLATFORM/embed.js" data-onespec="PUBLIC_ID"></script>
 *
 * Puts the configurator on the page where the tag stands: it creates the <iframe> (lazy, titled, full width), keeps its height equal
 * to the widget's content (the page scrolls, not the frame) and, when a visitor sends a request, fires a DOM event the site can listen to:
 *
 *   window.addEventListener("onespec:submitted", function (e) { /* e.detail.publicId * / });
 *
 * Optional attributes: data-lang (it|en|fr|de|nl|ro), data-theme (light|dark|auto), data-accent (#RRGGBB), data-font,
 * data-target (CSS selector of the element to fill instead of "right after the script"), data-min-height (300-2000, default 640),
 * data-title (accessible name of the frame), data-mode (guided|full: the 3-step guided path or the whole form first),
 * data-scroll-shield (off: no scroll shield, see below).
 *
 * Scroll shield (mouse and trackpad only): a transparent layer over the widget lets the mouse wheel scroll the website instead of
 * getting caught by the frame. The first click removes it so the visitor can configure; it comes back when the pointer leaves the
 * widget. Keyboard users are never blocked (tabbing into the frame removes it) and touch screens never get it (a swipe already
 * scrolls the page).
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
  var HINTS = {
    it: "Clicca per usare il configuratore",
    en: "Click to use the configurator",
    fr: "Cliquez pour utiliser le configurateur",
    de: "Klicken, um den Konfigurator zu benutzen",
    nl: "Klik om de configurator te gebruiken",
    ro: "Faceți clic pentru a folosi configuratorul"
  };

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
    var mode = (script.getAttribute("data-mode") || "").toLowerCase();
    if (mode === "guided" || mode === "full") params.push("mode=" + mode);
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
    // The frame keeps its own scrolling: until the widget reports its height (slow network, blocked script, a site builder that
    // re-frames this tag) the visitor can still scroll inside it. Once the height matches the content there is nothing to scroll.
    var minHeight = clampInt(script.getAttribute("data-min-height"), 300, 2000, 640);
    if (nestedInFrame() && window.innerHeight > 0) minHeight = Math.min(minHeight, Math.max(300, window.innerHeight));
    iframe.style.cssText = "display:block;width:100%;max-width:100%;border:0;min-height:" + minHeight + "px";

    var box = document.createElement("div");
    box.style.cssText = "position:relative;width:100%;max-width:100%";
    box.appendChild(iframe);

    var holder = null;
    var selector = script.getAttribute("data-target");
    if (selector) { try { holder = document.querySelector(selector); } catch (e) { holder = null; } }
    if (holder) holder.appendChild(box);
    else if (script.parentNode) script.parentNode.insertBefore(box, script.nextSibling);
    else return;

    if ((script.getAttribute("data-scroll-shield") || "").toLowerCase() !== "off") addScrollShield(box, iframe, script);
    frames.push({ id: id, origin: target.origin, iframe: iframe });
  }

  function hintText(script) {
    var lang = (script.getAttribute("data-lang") || document.documentElement.lang || navigator.language || "it").slice(0, 2).toLowerCase();
    return HINTS[lang] || HINTS.it;
  }

  function addScrollShield(box, iframe, script) {
    var mouse;
    try { mouse = window.matchMedia("(hover: hover) and (pointer: fine)"); } catch (e) { return; }
    if (!mouse || !mouse.matches) return; // touch screens: a swipe over the frame already scrolls the page

    var shield = document.createElement("div");
    shield.setAttribute("aria-hidden", "true");
    shield.setAttribute("data-onespec-shield", "");
    shield.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;z-index:2;background:transparent;cursor:pointer";
    var hint = document.createElement("div");
    hint.textContent = hintText(script);
    hint.style.cssText = "position:sticky;top:12px;margin:12px auto 0;width:max-content;max-width:calc(100% - 24px);padding:8px 14px;" +
      "border-radius:999px;background:rgba(10,12,14,.82);color:#fff;font:500 13px/1.3 system-ui,-apple-system,'Segoe UI',sans-serif;" +
      "pointer-events:none;opacity:0;transition:opacity .2s ease";
    shield.appendChild(hint);
    box.appendChild(shield);

    var armed = true;
    var hideTimer = 0;
    function showHint() {
      hint.style.opacity = "1";
      clearTimeout(hideTimer);
      hideTimer = setTimeout(function () { hint.style.opacity = "0"; }, 1600);
    }
    function disarm() {
      if (!armed) return;
      armed = false;
      shield.style.display = "none";
      hint.style.opacity = "0";
    }
    function arm() {
      if (armed) return;
      armed = true;
      shield.style.display = "block";
    }
    function inside(e) {
      var r = box.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    }

    // The wheel lands on the shield (part of this page), so the page scrolls; the hint says how to start configuring.
    shield.addEventListener("wheel", showHint, { passive: true });
    shield.addEventListener("mousemove", showHint);
    shield.addEventListener("click", function (e) { e.preventDefault(); disarm(); });
    // While the pointer is over the frame this page receives no mouse events: one arriving outside the box means the visitor left.
    document.addEventListener("mousemove", function (e) { if (!armed && !inside(e)) arm(); }, { passive: true });
    // Keyboard: tabbing into the widget moves focus into the frame, which blurs this window.
    window.addEventListener("blur", function () {
      setTimeout(function () { if (document.activeElement === iframe) disarm(); }, 0);
    });
  }

  function nestedInFrame() {
    try { return window.self !== window.top; } catch (e) { return true; }
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
        var h = Math.min(20000, Math.max(200, Math.ceil(d.height)));
        // This page is itself a fixed-size frame (Wix, Google Sites and other builders put custom code in one): a taller iframe
        // would only be cut off, so it fills the visible box and the widget scrolls inside it.
        if (nestedInFrame() && window.innerHeight > 0) {
          h = Math.min(h, Math.max(300, window.innerHeight));
          f.iframe.style.minHeight = "0";
        }
        f.iframe.style.height = h + "px";
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
