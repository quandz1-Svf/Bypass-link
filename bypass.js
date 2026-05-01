(function () {
  'use strict';
  if (window.__datcn_full_loaded) return;
  window.__datcn_full_loaded = true;

  // ===== CONFIG =====
  const SPEED = 2;      // x20
  const WAIT_SEC = 3;   // countdown 30s
  const MIN_DELAY = 0;   // ms
  // ==================

  // --- 0) Silent mode: chặn log/warn/error (tuỳ chọn) ---
  // Nếu bạn vẫn muốn giữ error thật để debug thì comment 3 dòng dưới.
  try {
    console.log = function () {};
    console.warn = function () {};
    console.error = function () {};
  } catch (_) {}

  // --- 1) UI Countdown ---
  const panel = document.createElement('div');
  panel.id = '__datcn_panel';
  panel.style.cssText = `
    position:fixed;top:10px;right:10px;z-index:2147483647;
    background:linear-gradient(135deg,rgba(40,40,40,.95),rgba(0,0,0,.95));
    color:#fff;padding:14px 18px;border-radius:14px;
    font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    text-align:center;box-shadow:0 10px 35px rgba(0,0,0,.55);
    border:1px solid rgba(255,255,255,.12); min-width:170px;
  `;
  panel.innerHTML = `
    <div style="font-size:12px;opacity:.8">Kích hoạt sau</div>
    <div id="__datcn_cd" style="font-size:26px;font-weight:800;margin-top:4px">${WAIT_SEC}s</div>
  `;

  function mountPanel() {
    (document.body || document.documentElement).appendChild(panel);
  }
  if (document.body) mountPanel();
  else setTimeout(mountPanel, 50);

  // Countdown tick
  let left = WAIT_SEC;
  const cdTimer = setInterval(function () {
    left -= 1;
    const cdEl = document.getElementById('__datcn_cd');
    if (cdEl) cdEl.textContent = (left > 0 ? left : 0) + 's';

    if (left <= 0) {
      clearInterval(cdTimer);
      activate();
    }
  }, 1000);

  // --- 2) Safe helper: ép bất kỳ thứ gì về Element ---
  function _getEl(x) {
    if (!x) return null;

    // DOM element
    if (x.nodeType === 1) return x;

    // selector string
    if (typeof x === 'string') return document.querySelector(x);

    if (typeof x === 'object') {
      // phổ biến: { el: Element | selector }
      if (x.el && x.el.nodeType === 1) return x.el;
      if (x.el && typeof x.el === 'string') return document.querySelector(x.el);

      // phổ biến: { target: Element }
      if (x.target && x.target.nodeType === 1) return x.target;

      // fallback: { container: Element | selector }
      if (x.container && x.container.nodeType === 1) return x.container;
      if (x.container && typeof x.container === 'string') return document.querySelector(x.container);
    }

    return null;
  }

  // --- 3) Patch “querySelectorAll” crash (không động tới code lib của bạn) ---
  // Ý tưởng: nếu ai đó gọi e.el.querySelectorAll mà e.el không phải Element,
  // ta vá bằng cách đảm bảo những object hay dùng (window/document) cũng có method "an toàn".
  // Cách này giúp tránh crash mà không cần tìm đúng chỗ gọi.
  function _safeQSA(selector) {
    // "this" có thể là window/document/object lạ → cố gắng tìm root hợp lệ
    const root = _getEl(this) || document.documentElement || document;
    try {
      return root.querySelectorAll ? root.querySelectorAll(selector) : [];
    } catch (_) {
      return [];
    }
  }

  // Chỉ vá nơi dễ phát sinh: Window/Document (không phá Element prototype)
  try {
    if (typeof window.querySelectorAll !== 'function') {
      Object.defineProperty(window, 'querySelectorAll', {
        value: _safeQSA,
        writable: true,
        configurable: true
      });
    }
  } catch (_) {}

  try {
    if (typeof document.querySelectorAll !== 'function') {
      Object.defineProperty(document, 'querySelectorAll', {
        value: _safeQSA,
        writable: true,
        configurable: true
      });
    }
  } catch (_) {}

  // --- 4) Activate speed mode after countdown ---
  function activate() {
    // Update UI
    panel.innerHTML = `
      <div style="font-size:18px;font-weight:900;letter-spacing:.5px">⚡ x${SPEED}</div>
      <div style="font-size:11px;opacity:.8;margin-top:4px">Speed Active</div>
    `;
    panel.style.background =
      'linear-gradient(135deg,rgba(169,85,255,.95),rgba(90,20,180,.95))';
    panel.style.border = '1px solid rgba(255,255,255,.22)';
    panel.style.boxShadow = '0 10px 35px rgba(169,85,255,.35)';

    // Save originals
    const _st = window.setTimeout;
    const _si = window.setInterval;
    const _ct = window.clearTimeout;
    const _ci = window.clearInterval;
    const _raf = window.requestAnimationFrame;
    const _caf = window.cancelAnimationFrame;

    // Timer scaling
    const timers = new Map();
    let tid = 1;

    function scale(d) {
      if (typeof d !== 'number' || !isFinite(d)) return MIN_DELAY;
      return Math.max(MIN_DELAY, d / SPEED);
    }

    window.setTimeout = function (fn, delay, ...args) {
      const id = tid++;
      if (typeof fn !== 'function') return id;

      const real = _st(function () {
        timers.delete(id);
        try { fn(...args); } catch (_) {}
      }, scale(delay));

      timers.set(id, { real, t: 't' });
      return id;
    };

    window.setInterval = function (fn, delay, ...args) {
      const id = tid++;
      if (typeof fn !== 'function') return id;

      const real = _si(function () {
        try { fn(...args); } catch (_) {}
      }, scale(delay));

      timers.set(id, { real, t: 'i' });
      return id;
    };

    window.clearTimeout = function (id) {
      const t = timers.get(id);
      if (t && t.t === 't') { _ct(t.real); timers.delete(id); }
    };

    window.clearInterval = function (id) {
      const t = timers.get(id);
      if (t && t.t === 'i') { _ci(t.real); timers.delete(id); }
    };

    // RAF wrapper (không fake timestamp để tránh vỡ lib)
    const rafs = new Map();
    let rid = 1;

    window.requestAnimationFrame = function (cb) {
      const id = rid++;
      const real = _raf(function (ts) {
        rafs.delete(id);
        try { cb(ts); } catch (_) {}
      });
      rafs.set(id, real);
      return id;
    };

    window.cancelAnimationFrame = function (id) {
      const real = rafs.get(id);
      if (real) { _caf(real); rafs.delete(id); }
    };

    // CSS speed up (animation/transition)
    const css = document.createElement('style');
    css.textContent = `
      *, *::before, *::after {
        animation-duration: calc(1s / ${SPEED}) !important;
        transition-duration: calc(1s / ${SPEED}) !important;
        animation-delay: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
      html { scroll-behavior: auto !important; }
    `;
    (document.head || document.documentElement).appendChild(css);
  }
})();