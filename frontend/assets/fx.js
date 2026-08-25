// Build My AI — shared FX engine (assets/fx.js, pairs with assets/fx.css).
// 滚动 reveal、指针微倾、数字滚动、粒子星网 canvas、FX.decode 文字解码。
// 纪律:一切文本只经 textContent / createElement,无任何 HTML 字符串 sink,
// 无任何网络请求;尊重 prefers-reduced-motion;所有 rAF 循环在 document.hidden
// 时暂停。加载方式:每页在 i18n.js 之后 <script src="assets/fx.js" defer>。
// 第一行给 <html> 加 .fx:fx.css 里"先隐藏再入场"的规则全部以 html.fx 前缀
// 书写,保证无 JS 时页面完整可见。初始化完成后设 data-fx="on"(测试锚点)。
(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('fx');

  var reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var hasIO = typeof window.IntersectionObserver === 'function';

  /* ---------- 1. 滚动交错入场:.fx-reveal / .fx-stagger ---------- */
  function initReveal() {
    var els = document.querySelectorAll('.fx-reveal,.fx-stagger');
    var i;
    if (reduced || !hasIO) {
      for (i = 0; i < els.length; i++) els[i].classList.add('in');
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var k = 0; k < entries.length; k++) {
        if (!entries[k].isIntersecting) continue;
        entries[k].target.classList.add('in');
        io.unobserve(entries[k].target); // 只播一次
      }
    }, { threshold: 0.15 });
    for (i = 0; i < els.length; i++) io.observe(els[i]);
  }

  /* ---------- 2. 指针 3D 微倾:.fx-tilt(写 --rx/--ry,CSS 合成 rotate) ---------- */
  function initTilt() {
    if (reduced) return;
    try { if (window.matchMedia('(hover: none)').matches) return; } catch (e) {}
    var els = document.querySelectorAll('.fx-tilt');
    for (var i = 0; i < els.length; i++) bindTilt(els[i]);
  }
  function bindTilt(el) {
    el.addEventListener('pointermove', function (ev) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var nx = Math.max(-1, Math.min(1, (ev.clientX - r.left) / r.width * 2 - 1));
      var ny = Math.max(-1, Math.min(1, (ev.clientY - r.top) / r.height * 2 - 1));
      el.style.setProperty('--rx', (-nx).toFixed(3));
      el.style.setProperty('--ry', (-ny).toFixed(3));
    });
    el.addEventListener('pointerleave', function () {
      el.style.setProperty('--rx', '0');
      el.style.setProperty('--ry', '0');
    });
  }

  /* ---------- 3. 数字滚动:.fx-count(data-count/-prefix/-suffix/-decimals;
     HTML 里保留最终文案作无 JS 兜底,数字跨语言中立,i18n 不触碰) ---------- */
  function countFinal(el) {
    var n = parseFloat(el.getAttribute('data-count')) || 0;
    var d = parseInt(el.getAttribute('data-decimals'), 10) || 0;
    el.textContent = (el.getAttribute('data-prefix') || '') + n.toFixed(d) + (el.getAttribute('data-suffix') || '');
  }
  function countRoll(el) {
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    var dec = parseInt(el.getAttribute('data-decimals'), 10) || 0;
    var pre = el.getAttribute('data-prefix') || '';
    var suf = el.getAttribute('data-suffix') || '';
    var total = 1200, done = 0, last = 0;
    function step(ts) {
      if (!last) last = ts;
      done += Math.min(50, ts - last); // 隐藏标签页时 rAF 停;回来 dt 截断,等效暂停
      last = ts;
      var p = Math.min(1, done / total);
      var eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = pre + (target * eased).toFixed(dec) + suf;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function initCount() {
    var els = document.querySelectorAll('.fx-count');
    var i;
    if (!els.length) return;
    if (reduced || !hasIO) {
      for (i = 0; i < els.length; i++) countFinal(els[i]);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      for (var k = 0; k < entries.length; k++) {
        if (!entries[k].isIntersecting) continue;
        io.unobserve(entries[k].target);
        countRoll(entries[k].target);
      }
    }, { threshold: 0.4 });
    for (i = 0; i < els.length; i++) io.observe(els[i]);
  }

  /* ---------- 4. 粒子星网:[data-fx-net](属性值可选,作粒子数上限)。
     canvas 插为容器第一个子节点(容器需 position:relative;overflow:hidden),
     rAF 循环在 document.hidden 或容器离屏时停,可见再恢复;resize 按 DPR 重播种;
     reduced-motion 下完全不启动(无 canvas)。 ---------- */
  function initNet() {
    if (reduced) return;
    var hosts = document.querySelectorAll('[data-fx-net]');
    for (var i = 0; i < hosts.length; i++) startNet(hosts[i]);
  }
  function startNet(host) {
    var canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.inset = '0';
    canvas.style.zIndex = '0';
    canvas.style.pointerEvents = 'none';
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var cap = parseInt(host.getAttribute('data-fx-net'), 10) || 56;
    var cs = getComputedStyle(host);
    var dotColor = (cs.getPropertyValue('--particle-color') || '').trim() || 'rgba(18,105,94,.55)';
    var linkColor = (cs.getPropertyValue('--particle-link') || '').trim() || 'rgba(18,105,94,.14)';
    var W = 0, H = 0, pts = [], raf = 0, visible = true;
    var mx = 0, my = 0, smx = 0, smy = 0; // 指针视差目标值 / 缓动当前值

    function seed() {
      var dpr = Math.min(2, window.devicePixelRatio || 1);
      W = host.clientWidth; H = host.clientHeight;
      canvas.width = Math.max(1, Math.round(W * dpr));
      canvas.height = Math.max(1, Math.round(H * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.min(cap, Math.round(W * H / 26000)); // 低密度
      pts = [];
      for (var i = 0; i < n; i++) {
        pts.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() * 2 - 1) * 0.18, vy: (Math.random() * 2 - 1) * 0.18,
          depth: 0.3 + Math.random() * 0.7,
          r: 1 + Math.random() * 1.2, dx: 0, dy: 0
        });
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      smx += (mx - smx) * 0.06; smy += (my - smy) * 0.06;
      var i, j, p, q;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < -8) p.x = W + 8; else if (p.x > W + 8) p.x = -8;
        if (p.y < -8) p.y = H + 8; else if (p.y > H + 8) p.y = -8;
        p.dx = p.x + smx * 10 * p.depth;
        p.dy = p.y + smy * 10 * p.depth;
      }
      ctx.strokeStyle = linkColor;
      ctx.lineWidth = 1;
      for (i = 0; i < pts.length; i++) {
        for (j = i + 1; j < pts.length; j++) {
          p = pts[i]; q = pts[j];
          var ddx = p.dx - q.dx, ddy = p.dy - q.dy;
          var d2 = ddx * ddx + ddy * ddy;
          if (d2 > 12100) continue; // 110px
          ctx.globalAlpha = 1 - Math.sqrt(d2) / 110; // 与连线自带的 .14 相乘
          ctx.beginPath(); ctx.moveTo(p.dx, p.dy); ctx.lineTo(q.dx, q.dy); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = dotColor;
      for (i = 0; i < pts.length; i++) {
        p = pts[i];
        ctx.beginPath(); ctx.arc(p.dx, p.dy, p.r * p.depth, 0, 6.2832); ctx.fill();
      }
    }
    function frame() {
      raf = 0;
      if (!visible || document.hidden) return; // 离屏/隐藏即停,kick() 恢复
      draw();
      raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }

    seed(); kick();
    host.addEventListener('pointermove', function (ev) {
      var r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      mx = Math.max(-1, Math.min(1, (ev.clientX - r.left) / r.width * 2 - 1));
      my = Math.max(-1, Math.min(1, (ev.clientY - r.top) / r.height * 2 - 1));
    });
    host.addEventListener('pointerleave', function () { mx = 0; my = 0; });
    window.addEventListener('resize', function () { seed(); });
    document.addEventListener('visibilitychange', kick);
    if (hasIO) {
      new IntersectionObserver(function (entries) {
        for (var k = 0; k < entries.length; k++) visible = entries[k].isIntersecting;
        kick();
      }).observe(host);
    }
  }

  /* ---------- 5. FX.decode:文字解码打字机(页面亮点复用)。
     目标文本取 data-<lang>(与 i18n 同源)或现有 textContent;逐位揭示,
     揭示头附近 2~3 位显示乱码;全程 textContent 赋值。langchange 时 i18n
     已先写入新语言全文,这里随后以新语言重跑(与 hero.js run(e.detail)
     同模式);每元素代数计数器防中途切换串台;document.hidden / reduced
     直接写终态。运行期加 .fx-decoding(fx.css 给光标)。 ---------- */
  var DECODE_CHARS = '!<>-_/[]{}—=+*^?#';
  function decode(el) {
    var lang = (window.__lang === 'zh') ? 'zh' : 'en';
    var text = el.getAttribute('data-' + lang) || el.textContent || '';
    el.__fxDecGen = (el.__fxDecGen || 0) + 1;
    var gen = el.__fxDecGen;
    function finish() {
      el.textContent = text;
      el.classList.remove('fx-decoding');
      el.style.minHeight = '';
    }
    if (reduced || document.hidden || !text) { finish(); return; }
    // 先按全文锁定当前高度,解码期间不引起下方版式跳动
    el.textContent = text;
    el.style.minHeight = '';
    el.style.minHeight = el.offsetHeight + 'px';
    el.classList.add('fx-decoding');
    var total = 900, done = 0, last = 0;
    function step(ts) {
      if (el.__fxDecGen !== gen) return; // 已被更新的一次运行接管
      if (document.hidden) { finish(); return; }
      if (!last) last = ts;
      done += Math.min(50, ts - last);
      last = ts;
      var p = Math.min(1, done / total);
      var eased = 1 - (1 - p) * (1 - p);
      var i = Math.floor(eased * text.length);
      var out = text.slice(0, i);
      var scramble = Math.min(3, text.length - i);
      for (var k = 0; k < scramble; k++) out += DECODE_CHARS[(Math.random() * DECODE_CHARS.length) | 0];
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
      else finish();
    }
    requestAnimationFrame(step);
  }
  window.FX = window.FX || {};
  window.FX.decode = decode;
  function runDecodes() {
    var els = document.querySelectorAll('[data-fx-decode]');
    for (var i = 0; i < els.length; i++) decode(els[i]);
  }
  // i18n.js 首次 apply 与每次切换都会派发 langchange(此时新语言全文已就位)
  document.addEventListener('langchange', runDecodes);

  /* ---------- init ---------- */
  function init() {
    initReveal();
    initTilt();
    initCount();
    initNet();
    root.setAttribute('data-fx', 'on'); // 测试锚点:FX 层初始化完成
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
