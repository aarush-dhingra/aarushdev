/* shared across pages: theme, clock, nav, the topo backdrop, the sunset scene + intro, small ui bits */
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
  const store = {
    get(k, s = localStorage) { try { return s.getItem(k); } catch (e) { return null; } },
    set(k, v, s = localStorage) { try { s.setItem(k, v); } catch (e) {} },
  };
  const sleep = (ms, signal) =>
    new Promise((res, rej) => {
      if (signal && signal.aborted) return rej(new DOMException("stop", "AbortError"));
      const t = setTimeout(res, ms);
      signal && signal.addEventListener("abort", () => { clearTimeout(t); rej(new DOMException("stop", "AbortError")); }, { once: true });
    });

  /* ---------- colours ---------- */
  const C = {};
  const colorHooks = [];
  function readColors() {
    const cs = getComputedStyle(root);
    for (const k of ["bg", "bg-2", "fg", "fg-2", "muted", "line", "sun", "dusk"]) C[k] = cs.getPropertyValue("--" + k).trim();
    C.dark = (root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";
    colorHooks.forEach((f) => f());
  }
  readColors();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", readColors);

  function sizeCanvas(c, w = c.clientWidth, h = c.clientHeight) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const ctx = c.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  /* ---------- ready: kicks off the entrance once the intro (if any) is done ---------- */
  let isReady = false;
  function ready() {
    if (isReady) return;
    isReady = true;
    document.body.classList.add("ready");
    observeReveals();
    document.dispatchEvent(new Event("ad:ready"));
  }

  /* split text into words so they can blur in one after another */
  function splitWords() {
    let n = 0;
    $$(".bw").forEach((el) => {
      const walk = (node) => {
        [...node.childNodes].forEach((c) => {
          if (c.nodeType === 3) {
            const frag = document.createDocumentFragment();
            c.textContent.split(/(\s+)/).forEach((p) => {
              if (!p) return;
              if (/^\s+$/.test(p)) return frag.appendChild(document.createTextNode(" "));
              const s = document.createElement("span");
              s.className = "w wt";
              s.style.setProperty("--d", Math.min(1300, 120 + n++ * 24));
              s.textContent = p;
              frag.appendChild(s);
            });
            c.replaceWith(frag);
          } else if (c.nodeType === 1) {
            if (c.matches("a, button, .chip, .flip, kbd, code, svg, img, .status, .nb")) {
              c.classList.add("w");
              c.style.setProperty("--d", Math.min(1300, 120 + n++ * 24));
            } else walk(c);
          }
        });
      };
      walk(el);
    });
  }
  splitWords();
  // once a word has landed, drop the animation so hover transforms (dock, chips) work again
  document.addEventListener("animationend", (e) => { if (e.animationName === "win") e.target.classList.remove("w"); });

  function observeReveals() {
    const els = $$(".rv");
    if (!("IntersectionObserver" in window)) return els.forEach((e) => e.classList.add("in"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach((e) => io.observe(e));
  }

  /* ---------- theme (circle wipe from the toggle) ---------- */
  const themeBtn = $("#theme");
  function toggleTheme() {
    const now = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = now === "dark" ? "light" : "dark";
    const apply = () => { root.dataset.theme = next; store.set("theme", next); readColors(); };
    if (!document.startViewTransition || reduced || !themeBtn) return apply();
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    root.classList.add("theme-vt");
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
        { duration: 700, easing: "cubic-bezier(.2,.7,.1,1)", pseudoElement: "::view-transition-new(root)" }
      );
    }).catch(() => {});
    vt.finished.finally(() => root.classList.remove("theme-vt"));
  }
  themeBtn && themeBtn.addEventListener("click", toggleTheme);

  /* ---------- clock + where the sun is in bengaluru ---------- */
  const clock = $("#clock");
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
  function phaseOf(m) {
    if (m >= 345 && m < 420) return ["sunrise", true];
    if (m >= 420 && m < 1035) return ["daylight", false];
    if (m >= 1035 && m < 1110) return ["golden hour", true];
    if (m >= 1110 && m < 1145) return ["dusk", true];
    return ["after dark", false];
  }
  function tick() {
    if (!clock) return;
    const [h, m] = fmt.format(new Date()).split(":");
    const [ph, gold] = phaseOf(+h * 60 + +m);
    clock.innerHTML = `blr ${h}<span class="blink">:</span>${m}<span class="phase-wrap"> · <span class="phase${gold ? " gold" : ""}">${ph}</span></span>`;
  }
  tick();
  setInterval(tick, 15000);

  /* ---------- header ---------- */
  const onScroll = () => root.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  (function navPill() {
    const nav = $(".nav");
    if (!nav) return;
    const pill = document.createElement("span");
    pill.className = "nav-pill";
    nav.prepend(pill);
    const active = $('a[aria-current="page"]', nav);
    const to = (a, instant) => {
      if (!a) { pill.style.opacity = 0; return; }
      if (instant) pill.style.transition = "none";
      pill.style.opacity = 1;
      pill.style.width = a.offsetWidth + "px";
      pill.style.transform = `translateX(${a.offsetLeft}px)`;
      if (instant) { pill.offsetWidth; pill.style.transition = ""; }
    };
    $$("a", nav).forEach((a) => a.addEventListener("pointerenter", () => to(a)));
    nav.addEventListener("pointerleave", () => to(active));
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => to(active, true));
    to(active, true);
  })();

  /* ---------- keys ---------- */
  addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (document.querySelector(".intro")) return;
    const k = e.key.toLowerCase();
    if (k === "t") toggleTheme();
    else if (k === "h" && location.pathname !== "/") location.href = "/";
    else if (k === "p" && !location.pathname.startsWith("/projects")) location.href = "/projects/";
    else document.dispatchEvent(new CustomEvent("ad:key", { detail: k }));
  });

  /* ---------- copy ---------- */
  $$("[data-copy]").forEach((b) => {
    let t;
    b.addEventListener("click", async (e) => {
      e.preventDefault();
      const text = b.dataset.copy;
      try { await navigator.clipboard.writeText(text); }
      catch (err) {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); } catch (e2) {}
        ta.remove();
      }
      b.classList.add("done");
      clearTimeout(t);
      t = setTimeout(() => b.classList.remove("done"), 1700);
    });
  });

  /* ---------- buttons: glow follows the cursor ---------- */
  $$(".btn").forEach((b) => b.addEventListener("pointermove", (e) => {
    const r = b.getBoundingClientRect();
    b.style.setProperty("--bx", e.clientX - r.left + "px");
    b.style.setProperty("--by", e.clientY - r.top + "px");
  }));

  /* ---------- dock: icons swell as the cursor gets close ---------- */
  if (finePointer && !reduced) $$(".dock").forEach((dock) => {
    const items = $$("a", dock);
    let x = 0, queued = false, centres = null;
    const apply = () => {
      queued = false;
      if (!centres) centres = items.map((a) => { const r = a.getBoundingClientRect(); return r.left + r.width / 2; });
      items.forEach((a, i) => {
        const s = (1 + 0.36 * Math.pow(clamp(1 - Math.abs(x - centres[i]) / 90), 2)).toFixed(3);
        a.style.transform = `scale(${s})`;
        a.style.setProperty("--s", s);
      });
    };
    dock.addEventListener("pointerenter", () => (centres = null));
    dock.addEventListener("pointermove", (e) => { x = e.clientX; if (!queued) { queued = true; requestAnimationFrame(apply); } });
    dock.addEventListener("pointerleave", () => items.forEach((a) => { a.style.transform = ""; a.style.setProperty("--s", 1); }));
  });

  /* ---------- spotlight borders: every card in the group catches the light ---------- */
  $$("[data-spot]").forEach((grp) => {
    const cards = $$(".spot", grp);
    let x = 0, y = 0, queued = false;
    const apply = () => {
      queued = false;
      const rects = cards.map((c) => c.getBoundingClientRect());
      cards.forEach((c, i) => {
        c.style.setProperty("--mx", x - rects[i].left + "px");
        c.style.setProperty("--my", y - rects[i].top + "px");
      });
    };
    grp.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; if (!queued) { queued = true; requestAnimationFrame(apply); } });
  });

  /* ---------- simplex noise (3d), for the topo map ---------- */
  function makeNoise3D(seed) {
    const g3 = [1,1,0,-1,1,0,1,-1,0,-1,-1,0,1,0,1,-1,0,1,1,0,-1,-1,0,-1,0,1,1,0,-1,1,0,1,-1,0,-1,-1];
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = seed;
    const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 255; i > 0; i--) { const r = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[r]; p[r] = t; }
    const perm = new Uint8Array(512), pm = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm[i] = perm[i] % 12; }
    const F3 = 1 / 3, G3 = 1 / 6;
    return (x, y, z) => {
      const s0 = (x + y + z) * F3;
      const i = Math.floor(x + s0), j = Math.floor(y + s0), k = Math.floor(z + s0);
      const t = (i + j + k) * G3;
      const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      let n = 0, tt, gi;
      tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (tt > 0) { gi = pm[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x0 + g3[gi + 1] * y0 + g3[gi + 2] * z0); }
      tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (tt > 0) { gi = pm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x1 + g3[gi + 1] * y1 + g3[gi + 2] * z1); }
      tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (tt > 0) { gi = pm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x2 + g3[gi + 1] * y2 + g3[gi + 2] * z2); }
      tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (tt > 0) { gi = pm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (g3[gi] * x3 + g3[gi + 1] * y3 + g3[gi + 2] * z3); }
      return 32 * n;
    };
  }

  /* ---------- topo: a contour map that drifts, and rises softly where your cursor is ---------- */
  // the engine runs in a worker on an OffscreenCanvas, so drawing never competes with scrolling.
  // it's written to run anywhere: browsers without OffscreenCanvas get the same engine on the main thread.
  function topoEngine(scope) {
    const noise = makeNoise3D(11);
    const CELL = 24, SIG2 = 2 * 180 * 180, STEP = 0.11;
    let ctx = null, w = 0, h = 0, cols = 0, rows = 0, vals = null;
    let mx = -1e4, my = -1e4, tx = -1e4, ty = -1e4, amp = 0, tamp = 0, sy = 0, tsy = 0, gotScroll = false;
    let fg = "#edebe6", lo = 0.05, hi = 0.09, running = true, still = false, timer = 0, vignette = null;
    const t0 = Date.now();

    function size(W, H) {
      w = W; h = H;
      ctx.canvas.width = W; ctx.canvas.height = H;
      cols = Math.ceil(W / CELL) + 1; rows = Math.ceil(H / CELL) + 1;
      vals = new Float32Array(cols * rows);
      vignette = null;
    }
    function field(t) {
      const near = amp > 0.01;
      for (let j = 0; j < rows; j++) {
        const y = j * CELL, ny = (y + sy) * 0.0016, ny2 = (y + sy) * 0.0042;
        for (let i = 0; i < cols; i++) {
          const x = i * CELL;
          let n = noise(x * 0.0016, ny, t) * 0.74 + noise(x * 0.0042 + 31, ny2, t * 1.5) * 0.26;
          if (near) { const dx = x - mx, dy = y - my; n += amp * 0.6 * Math.exp(-(dx * dx + dy * dy) / SIG2); }
          vals[j * cols + i] = n;
        }
      }
    }
    // marching squares, no allocations: interpolate straight into moveTo/lineTo
    function march(L) {
      for (let j = 0; j < rows - 1; j++) {
        const y0 = j * CELL, y1 = y0 + CELL, r0 = j * cols, r1 = r0 + cols;
        for (let i = 0; i < cols - 1; i++) {
          const a = vals[r0 + i], b = vals[r0 + i + 1], c = vals[r1 + i + 1], d = vals[r1 + i];
          const k = (a > L ? 8 : 0) | (b > L ? 4 : 0) | (c > L ? 2 : 0) | (d > L ? 1 : 0);
          if (k === 0 || k === 15) continue;
          const x0 = i * CELL, x1 = x0 + CELL;
          const tX = x0 + (CELL * (L - a)) / (b - a);
          const rY = y0 + (CELL * (L - b)) / (c - b);
          const bX = x0 + (CELL * (L - d)) / (c - d);
          const lY = y0 + (CELL * (L - a)) / (d - a);
          switch (k) {
            case 1: case 14: ctx.moveTo(x0, lY); ctx.lineTo(bX, y1); break;
            case 2: case 13: ctx.moveTo(bX, y1); ctx.lineTo(x1, rY); break;
            case 3: case 12: ctx.moveTo(x0, lY); ctx.lineTo(x1, rY); break;
            case 4: case 11: ctx.moveTo(tX, y0); ctx.lineTo(x1, rY); break;
            case 5: ctx.moveTo(tX, y0); ctx.lineTo(x1, rY); ctx.moveTo(x0, lY); ctx.lineTo(bX, y1); break;
            case 6: case 9: ctx.moveTo(tX, y0); ctx.lineTo(bX, y1); break;
            case 7: case 8: ctx.moveTo(x0, lY); ctx.lineTo(tX, y0); break;
            case 10: ctx.moveTo(x0, lY); ctx.lineTo(tX, y0); ctx.moveTo(bX, y1); ctx.lineTo(x1, rY); break;
          }
        }
      }
    }
    function draw() {
      if (!ctx || !w) return;
      const t = (Date.now() - t0) * 0.000016;
      mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;
      amp += (tamp - amp) * 0.03;
      sy += (tsy - sy) * 0.1;
      field(t);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.strokeStyle = fg;
      let n = 0;
      for (let L = -0.9; L <= 1.3; L += STEP, n++) {
        ctx.beginPath();
        march(L);
        ctx.globalAlpha = n % 5 === 0 ? hi : lo;
        ctx.stroke();
      }
      // fade the middle so the text column stays clean (cheaper than a css mask on a live canvas)
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "destination-out";
      if (!vignette) {
        vignette = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        vignette.addColorStop(0, "rgba(0,0,0,.82)");
        vignette.addColorStop(1, "rgba(0,0,0,0)");
      }
      ctx.save();
      ctx.translate(w / 2, h * 0.42);
      ctx.scale(w * 0.38, h * 0.66);
      ctx.fillStyle = vignette;
      ctx.fillRect(-3, -3, 6, 6);
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
    }
    function loop() {
      timer = 0;
      if (!running || still) return;
      draw();
      timer = setTimeout(loop, 33);
    }
    scope.onmessage = (e) => {
      const m = e.data;
      if (m.canvas) ctx = m.canvas.getContext("2d");
      if (m.size) size(m.size[0], m.size[1]);
      if (m.pointer) { tx = m.pointer[0]; ty = m.pointer[1]; tamp = 1; if (mx < -1e3) { mx = tx; my = ty; } }
      if (m.leave) tamp = 0;
      if (m.scroll != null) { tsy = m.scroll * 0.18; if (!gotScroll) { sy = tsy; gotScroll = true; } }
      if (m.color) { fg = m.color; lo = m.dark ? 0.05 : 0.065; hi = m.dark ? 0.09 : 0.12; }
      if (m.still != null) still = m.still;
      if (m.run != null) running = m.run;
      if (still) draw();
      else if (running && !timer) loop();
    };
  }

  (function topo() {
    const c = $("#topo");
    if (!c) return;
    let post = null;
    if (c.transferControlToOffscreen && window.Worker && window.Blob) {
      try {
        const src = `${makeNoise3D.toString()}\n${topoEngine.toString()}\ntopoEngine(self);`;
        const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
        const worker = new Worker(url);
        const off = c.transferControlToOffscreen();
        worker.postMessage({ canvas: off }, [off]);
        post = (m) => worker.postMessage(m);
      } catch (e) { post = null; }
    }
    if (!post) {
      const scope = {};
      topoEngine(scope);
      scope.onmessage({ data: { canvas: c } });
      post = (m) => scope.onmessage({ data: m });
    }
    post({ size: [innerWidth, innerHeight], scroll: scrollY, color: C.fg, dark: C.dark, still: reduced });
    colorHooks.push(() => post({ color: C.fg, dark: C.dark }));

    // pointer and scroll go over at most once per frame
    let px = 0, py = 0, moved = false, scrolled = false, queued = false;
    const flush = () => {
      queued = false;
      if (moved) { moved = false; post({ pointer: [px, py] }); }
      if (scrolled) { scrolled = false; post({ scroll: scrollY }); }
    };
    const queue = () => { if (!queued) { queued = true; requestAnimationFrame(flush); } };
    addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") return; px = e.clientX; py = e.clientY; moved = true; queue(); }, { passive: true });
    addEventListener("scroll", () => { scrolled = true; queue(); }, { passive: true });
    document.addEventListener("pointerleave", () => post({ leave: true }));
    addEventListener("resize", () => post({ size: [innerWidth, innerHeight] }));
    document.addEventListener("visibilitychange", () => post({ run: !document.hidden }));
  })();

  /* ---------- the scene: a dot-matrix sunset over mountains, sea and a strip of beach ---------- */
  const Scene = (() => {
    const B8 = [0,32,8,40,2,34,10,42,48,16,56,24,50,18,58,26,12,44,4,36,14,46,6,38,60,28,52,20,62,30,54,22,3,35,11,43,1,33,9,41,51,19,59,27,49,17,57,25,15,47,7,39,13,45,5,37,63,31,55,23,61,29,53,21].map((v) => (v + 0.5) / 64);
    const HZ = 0.7, SU = 0.62, SR = 0.15, SV = 0.575;
    const BACK = [[-0.05, 0.24, 0.2], [0.2, 0.37, 0.3], [0.44, 0.21, 0.17], [0.87, 0.31, 0.24], [1.07, 0.26, 0.2]];
    const FRONT = [[0.03, 0.21, 0.2], [0.31, 0.13, 0.18], [0.76, 0.15, 0.17], [0.99, 0.22, 0.16]];
    const SUNC = ["#ffd37a", "#ffae57", "#ff8645", "#ff6049", "#f2466c", "#d93a8c"];
    const jag = (x) => Math.sin(x * 61.3) * 0.5 + Math.sin(x * 137.1 + 1.3) * 0.3 + Math.sin(x * 251.7 + 2.1) * 0.2;
    const ridge = (P, u, k, off) => {
      let m = 0;
      for (let i = 0; i < P.length; i++) {
        const d = Math.abs(u - P[i][0]) / P[i][2];
        if (d < 1) { const v = P[i][1] * Math.pow(1 - d, 1.15); if (v > m) m = v; }
      }
      return HZ - m - (m > 0.01 ? k * m * jag(u + off) : 0);
    };
    const rb = (u) => ridge(BACK, u, 0.05, 0);
    const rf = (u) => ridge(FRONT, u, 0.08, 3.7);
    const shore = (u) => 0.905 + 0.022 * Math.sin(u * 5.2 + 0.8) + 0.006 * jag(u * 0.5 + 7);
    const hash = (i, j) => { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); };

    // on tall screens the scene keeps a landscape box and the sky fills the rest
    const frame = (w, h) => { const sh = Math.min(h, w * 0.85); return { sh, top: (h - sh) * 0.55 }; };

    function build(w, h, g) {
      const { sh, top } = frame(w, h);
      const cols = Math.floor(w / g), rows = Math.floor(h / g);
      const ox = (w - cols * g) / 2, oy = (h - rows * g) / 2;
      const L = { star: [], back: [], bsnow: [], front: [], snow: [], foam: [], sand: [] };
      const sky = [], sea = [];
      const RB = new Float32Array(cols), RF = new Float32Array(cols), SH = new Float32Array(cols);
      for (let i = 0; i < cols; i++) { const u = (ox + (i + 0.5) * g) / w; RB[i] = rb(u); RF[i] = rf(u); SH[i] = shore(u); }
      for (let j = 0; j < rows; j++) {
        const y = oy + (j + 0.5) * g, v = (y - top) / sh;
        for (let i = 0; i < cols; i++) {
          const x = ox + (i + 0.5) * g, u = x / w;
          const T = B8[(j & 7) * 8 + (i & 7)];
          if (v < HZ) {
            if (v >= RF[i]) {
              const tall = HZ - RF[i], depth = v - RF[i];
              const sl = RF[Math.min(cols - 1, i + 1)] - RF[Math.max(0, i - 1)];
              const lit = u < SU ? sl > 0 : sl < 0;
              if (tall > 0.09 && depth < 0.012 + tall * 0.06) { if (0.95 > T) L.snow.push(x, y); }
              else { const I = (lit ? 0.66 : 0.42) * (1 - (depth / tall) * 0.3); if (I > T) L.front.push(x, y); }
            } else if (v >= RB[i]) {
              const tall = HZ - RB[i], depth = v - RB[i];
              const sl = RB[Math.min(cols - 1, i + 1)] - RB[Math.max(0, i - 1)];
              const lit = u < SU ? sl > 0 : sl < 0;
              if (tall > 0.17 && depth < 0.014 + tall * 0.07) { if (0.8 > T) L.bsnow.push(x, y); }
              else { const I = (lit ? 0.4 : 0.22) * (1 - (depth / tall) * 0.4); if (I > T) L.back.push(x, y); }
            } else {
              sky.push(i, j);
              if (v < 0.48 && hash(i, j) < Math.min(0.022, 0.013 * (1 - v / 0.48))) L.star.push(x, y);
            }
          } else {
            const s = SH[i];
            if (v > s + 0.014) { const I = Math.min(0.5, 0.24 + (v - s) * 1.6) * (v > 1 ? Math.max(0, 1 - (v - 1) * 2.2) : 1); if (I > T) L.sand.push(x, y); }
            else if (v > s) { if (0.8 > T) L.foam.push(x, y); }
            else sea.push(i, j);
          }
        }
      }
      return { w, h, g, cols, rows, ox, oy, sh, top, L, sky, sea, RB, RF };
    }

    // random start offsets so the static layers can assemble from scattered dots
    function particles(st) {
      st.P = {};
      for (const k in st.L) {
        const a = st.L[k], n = a.length / 2;
        const d = new Float32Array(n), dx = new Float32Array(n), dy = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const u = a[i * 2] / st.w;
          d[i] = u * 520 + Math.random() * 320 + (k === "front" || k === "snow" ? 140 : 0) + (k === "sand" || k === "foam" ? 260 : 0);
          dx[i] = (Math.random() - 0.5) * 120;
          dy[i] = 50 + Math.random() * 200;
        }
        st.P[k] = { d, dx, dy };
      }
    }

    const LAYERS = [["star", 0.6, 0], ["back", 0.5, 0.5], ["bsnow", 0.8, 0.5], ["front", 0.88, 1], ["snow", 1, 1], ["sand", 0.5, 0], ["foam", 0.85, 0]];

    function draw(ctx, st, o) {
      const { w, h, g } = st;
      const s = g * 0.56, hs = s / 2;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = o.fg;
      for (const [k, alpha, par] of LAYERS) {
        const a = st.L[k], dxp = (o.par || 0) * par * g * 1.4;
        if (o.partT != null) {
          const P = st.P[k];
          for (let i = 0, n = a.length / 2; i < n; i++) {
            const p = clamp((o.partT - P.d[i]) / 900);
            if (p <= 0) continue;
            const e = 1 - Math.pow(1 - p, 3);
            ctx.globalAlpha = alpha * e;
            ctx.fillRect(a[i * 2] + P.dx[i] * (1 - e) - hs, a[i * 2 + 1] + P.dy[i] * (1 - e) - hs, s, s);
          }
        } else if (k === "star") {
          for (let i = 0; i < a.length; i += 2) {
            ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(o.t * 1.7 + i * 1.37));
            ctx.fillRect(a[i] - hs, a[i + 1] - hs, s, s);
          }
        } else {
          ctx.globalAlpha = alpha;
          for (let i = 0; i < a.length; i += 2) ctx.fillRect(a[i] + dxp - hs, a[i + 1] - hs, s, s);
        }
      }

      sky(ctx, st, o);
      sea(ctx, st, o);
      ctx.globalAlpha = 1;
    }

    // sky: sun disc with its stripes, plus a dithered glow
    function sky(ctx, st, o) {
      const { w, g, ox, oy, sh, top } = st;
      const s = g * 0.56, hs = s / 2, A = w / sh;
      const R = SR * sh, R2 = R * R, sunX = SU * w, sunY = top + o.sunV * sh;
      const sunB = [[], [], [], [], [], []], glow = [];
      if (o.sunA > 0) {
        const sk = st.sky;
        for (let n = 0; n < sk.length; n += 2) {
          const i = sk[n], j = sk[n + 1];
          const x = ox + (i + 0.5) * g, y = oy + (j + 0.5) * g, v = (y - top) / sh;
          const dx = x - sunX, dy = y - sunY, d2 = dx * dx + dy * dy;
          const T = B8[(j & 7) * 8 + (i & 7)];
          if (d2 < R2) {
            const dd = (v - (o.sunV - SR * 0.12)) / SR;
            if (dd > 0) { const gap = Math.floor(dd * 3.4); if (gap > 0 && j % 5 < gap) continue; }
            if (hash(i, j) > o.sunA) continue;
            const q = clamp(Math.floor(((v - (o.sunV - SR)) / (2 * SR)) * 6), 0, 5);
            sunB[q].push(x, y);
          } else {
            const hz = (v - HZ) / 0.15, du = ((x / w) - SU) * A / 0.55;
            const I = o.glowA * (0.32 * Math.exp(-hz * hz) * (0.3 + 0.7 * Math.exp(-du * du)) + 0.3 * Math.exp(-d2 / (R2 * 2.4)));
            if (I > T) glow.push(x, y);
          }
        }
      }
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#ff8a5c";
      for (let i = 0; i < glow.length; i += 2) ctx.fillRect(glow[i] - hs, glow[i + 1] - hs, s, s);
      ctx.globalAlpha = 1;
      for (let q = 0; q < 6; q++) {
        ctx.fillStyle = SUNC[q];
        const b = sunB[q];
        for (let i = 0; i < b.length; i += 2) ctx.fillRect(b[i] - hs, b[i + 1] - hs, s, s);
      }
      ctx.globalAlpha = 1;
    }

    // sea: a slow shimmer and the sun's reflection breaking up on the water
    function sea(ctx, st, o) {
      const { w, g, ox, oy, sh, top } = st;
      const s = g * 0.56, hs = s / 2, A = w / sh;
      if (o.seaA > 0) {
        const se = st.sea, refl = [], base = [];
        for (let n = 0; n < se.length; n += 2) {
          const i = se[n], j = se[n + 1];
          const x = ox + (i + 0.5) * g, y = oy + (j + 0.5) * g, u = x / w, v = (y - top) / sh;
          const dx = Math.abs(u - SU) * A, wid = SR * (0.7 + (v - HZ) * 2.6);
          if (dx < wid && o.sunA > 0) {
            const f = 1 - dx / wid;
            const st2 = 0.5 + 0.5 * Math.sin(j * 2.1 + o.t * 2.4 + u * A * 30);
            if (st2 * f * 1.7 * o.sunA > 0.55) { refl.push(x, y); continue; }
          }
          const T = B8[(j & 7) * 8 + (i & 7)];
          const I = o.seaA * (0.1 + 0.075 * Math.sin(u * A * 46 + o.t * 1.1 + Math.sin(v * 70 - o.t * 0.6) * 2.2));
          if (I > T) base.push(x, y);
        }
        ctx.fillStyle = o.fg; ctx.globalAlpha = 0.5;
        for (let i = 0; i < base.length; i += 2) ctx.fillRect(base[i] - hs, base[i + 1] - hs, s, s);
        ctx.fillStyle = "#ff9a5a"; ctx.globalAlpha = 0.9;
        for (let i = 0; i < refl.length; i += 2) ctx.fillRect(refl[i] - hs, refl[i + 1] - hs, s, s);
      }
      ctx.globalAlpha = 1;
    }

    // everything that never moves gets painted once into its own canvas
    function bake(st, fg, dpr) {
      const s = st.g * 0.56, hs = s / 2;
      const layer = (paint) => {
        const cv = document.createElement("canvas");
        cv.width = Math.round(st.w * dpr); cv.height = Math.round(st.h * dpr);
        const x = cv.getContext("2d");
        x.setTransform(dpr, 0, 0, dpr, 0, 0);
        paint(x);
        return cv;
      };
      const dots = (x, names) => {
        x.fillStyle = fg;
        for (const [k, alpha] of names) {
          const a = st.L[k];
          x.globalAlpha = alpha;
          for (let i = 0; i < a.length; i += 2) x.fillRect(a[i] - hs, a[i + 1] - hs, s, s);
        }
        x.globalAlpha = 1;
      };
      return {
        fg,
        sky: layer((x) => sky(x, st, { sunV: SV, sunA: 1, glowA: 1 })),
        back: layer((x) => dots(x, [["back", 0.5], ["bsnow", 0.8]])),
        front: layer((x) => dots(x, [["front", 0.88], ["snow", 1]])),
        ground: layer((x) => dots(x, [["sand", 0.5], ["foam", 0.85]])),
      };
    }
    // per frame: just the twinkling stars and the sea, plus four image draws
    function drawBaked(ctx, st, baked, o) {
      const { w, h, g } = st;
      const s = g * 0.56, hs = s / 2, par = o.par || 0;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = o.fg;
      const stars = st.L.star;
      for (let i = 0; i < stars.length; i += 2) {
        ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(o.t * 1.7 + i * 1.37));
        ctx.fillRect(stars[i] - hs, stars[i + 1] - hs, s, s);
      }
      ctx.globalAlpha = 1;
      ctx.drawImage(baked.sky, 0, 0, w, h);
      ctx.drawImage(baked.back, par * 0.5 * g * 1.4, 0, w, h);
      ctx.drawImage(baked.front, par * g * 1.4, 0, w, h);
      ctx.drawImage(baked.ground, 0, 0, w, h);
      sea(ctx, st, { fg: o.fg, t: o.t, sunA: 1, seaA: 1 });
    }

    return { build, particles, draw, bake, drawBaked, SV };
  })();

  const gridFor = (vw) => clamp(vw / 205, 4.5, 8);

  /* the horizon at the bottom of every page: the same sunset, small and alive */
  (function horizon() {
    const c = $(".horizon");
    if (!c) return;
    let ctx, st, baked = null, vis = false, par = 0, tpar = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    function resize() {
      const W = c.clientWidth, H = c.clientHeight;
      if (!W) return;
      ({ ctx } = sizeCanvas(c, W, H));
      st = Scene.build(W, H, W < 600 ? 3.4 : 4);
      baked = null;
      draw(performance.now());
    }
    const draw = (now) => {
      if (!st) return;
      if (!baked || baked.fg !== C.fg) baked = Scene.bake(st, C.fg, dpr);
      Scene.drawBaked(ctx, st, baked, { fg: C.fg, t: now / 1000, par: reduced ? 0 : par });
    };
    colorHooks.push(() => draw(performance.now()));
    addEventListener("pointermove", (e) => { tpar = (e.clientX / innerWidth - 0.5) * 2; }, { passive: true });
    new IntersectionObserver(([e]) => (vis = e.isIntersecting)).observe(c);
    let last = 0;
    (function loop(now) {
      if (vis && !reduced && !document.hidden && now - last > 45) { last = now; par += (tpar - par) * 0.12; draw(now); }
      requestAnimationFrame(loop);
    })(0);
    addEventListener("resize", resize);
    resize();
  })();

  /* ---------- intro: the sunset assembles, then the curtain lifts ---------- */
  function runIntro() {
    root.classList.add("locked");
    const vw = root.clientWidth, vh = innerHeight;
    const el = document.createElement("div");
    el.className = "intro";
    el.setAttribute("aria-hidden", "true");
    const name = "aarush dhingra".split("").map((ch, i) => `<span style="animation-delay:${280 + i * 38}ms">${ch === " " ? "&nbsp;" : ch}</span>`).join("");
    el.innerHTML =
      `<canvas class="intro-canvas"></canvas>` +
      `<span class="intro-skip">click to skip</span>` +
      `<div class="intro-ui"><div><span class="big">${name}</span><span class="dim">ai engineer · builds agents · chases sunsets</span></div>` +
      `<div class="dim">golden hour <span id="gh-pct">000</span>%</div></div>`;
    document.body.appendChild(el);
    const cv = $("canvas", el);
    cv.style.width = vw + "px";
    cv.style.height = vh + "px";
    const { ctx, w, h } = sizeCanvas(cv, vw, vh);
    const st = Scene.build(w, h, gridFor(vw));
    Scene.particles(st);
    const pct = $("#gh-pct", el);
    const EXIT_AT = 2350;
    let start = performance.now(), leaving = false, done = false;

    function frame(now) {
      const T = now - start;
      const sp = easeInOut(clamp((T - 250) / 1750));
      Scene.draw(ctx, st, {
        fg: "#edebe6",
        t: T / 1000,
        sunV: lerp(0.3, Scene.SV, sp),
        sunA: clamp((T - 250) / 600),
        glowA: clamp((T - 400) / 1100),
        seaA: clamp((T - 700) / 800),
        partT: T < 1900 ? T : null,
      });
      pct.textContent = String(Math.round(clamp(T / 2000) * 100)).padStart(3, "0");
      if (!leaving && T >= EXIT_AT) leave();
      if (!done) requestAnimationFrame(frame);
    }

    function leave() {
      leaving = true;
      root.classList.remove("intro-pending", "locked");
      el.classList.add("leaving");
      setTimeout(ready, 280);
      setTimeout(() => { done = true; el.remove(); }, 1250);
    }

    const skip = () => { if (!leaving) start = performance.now() - EXIT_AT; };
    el.addEventListener("click", skip);
    addEventListener("keydown", skip, { once: true });
    addEventListener("wheel", skip, { once: true, passive: true });
    addEventListener("touchmove", skip, { once: true, passive: true });
    requestAnimationFrame(frame);
  }

  /* ---------- boot ---------- */
  if (root.classList.contains("intro-pending") && !reduced) runIntro();
  else {
    root.classList.remove("intro-pending");
    Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), sleep(300)]).then(ready, ready);
  }

  /* ---------- last push, straight from github ---------- */
  (async function lastPush() {
    const el = $("#push");
    if (!el) return;
    const ago = (d) => {
      const s = (Date.now() - new Date(d)) / 1000;
      if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
      if (s < 86400) return `${Math.round(s / 3600)}h ago`;
      if (s < 86400 * 45) return `${Math.round(s / 86400)}d ago`;
      return `${Math.round(s / (86400 * 30))}mo ago`;
    };
    let data = null;
    try { data = JSON.parse(store.get("lastpush", sessionStorage) || "null"); } catch (e) {}
    if (!data || Date.now() - data.at > 10 * 60 * 1000) {
      try {
        const r = await fetch("https://api.github.com/users/aarush-dhingra/events/public?per_page=30");
        if (!r.ok) throw 0;
        const ev = (await r.json()).find((x) => x.type === "PushEvent" || x.type === "CreateEvent");
        if (!ev) throw 0;
        data = { repo: ev.repo.name.split("/")[1], when: ev.created_at, at: Date.now() };
        store.set("lastpush", JSON.stringify(data), sessionStorage);
      } catch (e) { return; }
    }
    const a = document.createElement("a");
    a.href = `https://github.com/aarush-dhingra/${data.repo}`;
    a.target = "_blank"; a.rel = "noopener";
    a.textContent = data.repo;
    el.textContent = "";
    el.append("last push → ", a, ` · ${ago(data.when)}`);
  })();

  window.AD = { $, $$, C, clamp, lerp, sleep, sizeCanvas, reduced, finePointer, store, onReady: (f) => (isReady ? f() : document.addEventListener("ad:ready", f, { once: true })) };
})();
