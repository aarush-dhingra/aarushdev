(() => {
  "use strict";
  const { $, $$, clamp, sleep, reduced, store, onReady } = window.AD;

  /* ---------- flip words ---------- */
  $$(".flip").forEach((el) => {
    const words = el.dataset.words.split("|");
    let i = 0;
    const mk = (t) => { const s = document.createElement("span"); s.textContent = t; return s; };
    const measure = (t) => {
      const m = mk(t);
      m.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap";
      el.appendChild(m);
      const w = m.offsetWidth;
      m.remove();
      return w;
    };
    el.textContent = "";
    el.appendChild(mk(words[0]));
    const fit = () => (el.style.width = measure(words[i]) + "px");
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(fit);
    fit();
    if (reduced) return;
    onReady(() => setInterval(() => {
      if (document.hidden) return;
      const old = el.querySelector("span:not(.out)");
      if (old) { old.classList.remove("in"); old.classList.add("out"); setTimeout(() => old.remove(), 460); }
      i = (i + 1) % words.length;
      const n = mk(words[i]);
      n.className = "in";
      el.appendChild(n);
      fit();
    }, 2600));
  });

  /* ---------- github, as a dot matrix ---------- */
  (async function contributions() {
    const box = $("#gh");
    if (!box) return;
    const KEY = "gh-contrib";
    let data = null;
    try { data = JSON.parse(store.get(KEY, sessionStorage) || "null"); } catch (e) {}
    if (!data || Date.now() - data.at > 3600e3) {
      try {
        const r = await fetch("https://github-contributions-api.jogruber.de/v4/aarush-dhingra?y=last");
        if (!r.ok) throw 0;
        const j = await r.json();
        data = { total: j.total.lastYear, days: j.contributions.map((d) => [d.date, d.count, d.level]), at: Date.now() };
        store.set(KEY, JSON.stringify(data), sessionStorage);
      } catch (e) {
        box.closest("section").hidden = true;
        return;
      }
    }
    const grid = $(".gh-grid", box), months = $(".gh-months", box), total = $("#gh-total");
    const first = new Date(data.days[0][0] + "T00:00:00");
    const pad = first.getDay();
    const fmtDay = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
    let html = "";
    for (let k = 0; k < pad; k++) html += `<i style="visibility:hidden"></i>`;
    data.days.forEach(([date, count, level], idx) => {
      const n = idx + pad;
      const d = new Date(date + "T00:00:00");
      html += `<i class="l${level}" style="--c:${Math.floor(n / 7)};--r:${n % 7}" data-t="${count} contribution${count === 1 ? "" : "s"} · ${fmtDay.format(d)}"></i>`;
    });
    grid.innerHTML = html;
    const mf = new Intl.DateTimeFormat("en-GB", { month: "short" });
    let mh = "";
    for (let m = 1; m <= 12; m++) mh += `<span>${mf.format(new Date(first.getFullYear(), first.getMonth() + m, 1)).toLowerCase()}</span>`;
    months.innerHTML = mh;
    total.textContent = "0";

    const sc = $(".gh-scroll", box);
    sc.scrollLeft = sc.scrollWidth;

    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      grid.classList.add("in");
      const t0 = performance.now(), D = 1400;
      (function step(now) {
        const k = clamp((now - t0) / D);
        total.textContent = Math.round(data.total * (1 - Math.pow(1 - k, 3))).toLocaleString("en-IN");
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: 0.3 }).observe(box);

    const tip = document.createElement("span");
    tip.className = "gh-tip";
    document.body.appendChild(tip);
    grid.addEventListener("pointerover", (e) => {
      const i = e.target.closest("i[data-t]");
      if (!i) return;
      const r = i.getBoundingClientRect();
      tip.textContent = i.dataset.t;
      tip.style.left = r.left + r.width / 2 + "px";
      tip.style.top = r.top + "px";
      tip.classList.add("on");
    });
    grid.addEventListener("pointerleave", () => tip.classList.remove("on"));
    addEventListener("scroll", () => tip.classList.remove("on"), { passive: true });
  })();

  /* ---------- off the clock: a deck of prints, shuffled every visit, each with its own song ---------- */
  (function album() {
    const POOL = (window.PHOTOS || []).slice();
    const SONGS = window.SONGS || {};
    const deckEl = $("#deck");
    if (!deckEl || !POOL.length) return;
    const soundBtn = $("#sound"), label = $(".sound-label", soundBtn);
    const songEl = $("#album-song"), artistEl = $("#album-artist"), countEl = $("#deck-count"), bar = $("#deck-bar");
    const DWELL = 5200;

    // audio state first, the deck reads it while laying out
    let actx = null, master = null, playing = null, soundOn = false;
    const voices = new Map();

    for (let i = POOL.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [POOL[i], POOL[j]] = [POOL[j], POOL[i]]; }

    const cards = POOL.map((photo, k) => {
      const el = document.createElement("div");
      el.className = "dcard";
      el.innerHTML = `<div class="dface"><span class="dimg"></span><span class="dnum mono">${String(k + 1).padStart(2, "0")}</span><span class="deq" aria-hidden="true"><i></i><i></i><i></i></span></div>`;
      deckEl.appendChild(el);
      return { el, photo, k, tilt: Math.random() * 6 - 3, loaded: false };
    });
    const order = cards.slice(); // order[0] is the print on top

    function load(c) {
      if (c.loaded) return;
      c.loaded = true;
      const img = new Image();
      img.alt = c.photo.alt || "";
      img.draggable = false;
      img.decoding = "async";
      img.src = c.photo.img;
      img.addEventListener("error", () => { const ph = document.createElement("span"); ph.className = "ph"; img.replaceWith(ph); }, { once: true });
      $(".dimg", c.el).replaceWith(img);
    }

    let lastSong = "";
    function showSong(id) {
      if (id === lastSong) return;
      lastSong = id;
      const s = SONGS[id] || { title: "untitled", artist: "" };
      songEl.classList.add("out");
      artistEl.classList.add("out");
      setTimeout(() => {
        songEl.textContent = s.title;
        artistEl.textContent = s.artist;
        songEl.classList.remove("out");
        artistEl.classList.remove("out");
      }, 180);
    }

    // where each card sits in the pile; the rest wait invisibly underneath
    const SLOTS = [{ x: 0, y: 0, r: 0, s: 1 }, { x: 16, y: -10, r: 5, s: 0.96 }, { x: -14, y: -14, r: -6, s: 0.93 }, { x: 22, y: -18, r: 9, s: 0.9 }];
    function layout(instant) {
      order.forEach((c, p) => {
        const sl = SLOTS[Math.min(p, SLOTS.length - 1)];
        if (p < 5) load(c);
        if (instant) c.el.style.transition = "none";
        else c.el.style.transition = "";
        c.el.style.zIndex = String(100 - p);
        c.el.style.opacity = p < SLOTS.length ? "1" : "0";
        c.el.style.transform = `translate(${sl.x}px, ${sl.y}px) rotate(${p ? sl.r : c.tilt}deg) scale(${sl.s})`;
        c.el.classList.toggle("is-top", p === 0);
      });
      if (instant) { deckEl.offsetWidth; order.forEach((c) => (c.el.style.transition = "")); }
      const top = order[0];
      countEl.textContent = `${String(top.k + 1).padStart(2, "0")} / ${String(cards.length).padStart(2, "0")}`;
      showSong(top.photo.song);
      if (soundOn) play(top.photo.song);
      ui();
    }

    let busy = false;
    function next(dir) {
      if (busy) return;
      busy = true;
      dir = dir || (Math.random() < 0.5 ? -1 : 1);
      const c = order[0];
      c.el.style.transition = "transform .5s cubic-bezier(.3,.6,.2,1), opacity .4s";
      c.el.style.transform = `translate(${dir * 520}px, ${-40 - Math.random() * 60}px) rotate(${dir * 28}deg)`;
      c.el.style.opacity = "0";
      setTimeout(() => { order.push(order.shift()); layout(false); busy = false; restart(); }, 380);
    }
    function prev() {
      if (busy) return;
      busy = true;
      const c = order.pop();
      load(c);
      c.el.style.transition = "none";
      c.el.style.transform = "translate(-520px, -60px) rotate(-28deg)";
      c.el.style.opacity = "0";
      c.el.style.zIndex = "101";
      c.el.offsetWidth;
      order.unshift(c);
      layout(false);
      setTimeout(() => { busy = false; restart(); }, 420);
    }

    /* drag the top print away (or tap it for sound) */
    let drag = null;
    deckEl.addEventListener("pointerdown", (e) => {
      const c = order[0];
      if (busy || !c.el.contains(e.target) || (e.pointerType === "mouse" && e.button !== 0)) return;
      drag = { id: e.pointerId, sx: e.clientX, sy: e.clientY, lx: e.clientX, lt: performance.now(), vx: 0, moved: false };
      c.el.setPointerCapture(e.pointerId);
      c.el.style.transition = "none";
      clearTimeout(timer);
    });
    deckEl.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.abs(dx) > 6) drag.moved = true;
      if (!drag.moved) return;
      const t = performance.now();
      drag.vx = (e.clientX - drag.lx) / Math.max(8, t - drag.lt);
      drag.lx = e.clientX; drag.lt = t;
      const c = order[0];
      c.el.style.transform = `translate(${dx}px, ${dy * 0.25}px) rotate(${c.tilt + dx * 0.07}deg)`;
    });
    const release = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag, dx = e.clientX - d.sx;
      drag = null;
      if (!d.moved) { layout(false); if (e.type === "pointerup") press(); restart(); return; }
      if (Math.abs(dx) > 90 || Math.abs(d.vx) > 0.55) next(Math.sign(dx || d.vx));
      else { layout(false); restart(); }
    };
    deckEl.addEventListener("pointerup", release);
    deckEl.addEventListener("pointercancel", release);
    deckEl.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); next(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(); }
    });
    $("#deck-next").addEventListener("click", () => next(1));
    $("#deck-prev").addEventListener("click", prev);

    /* it flips on its own while you're looking, unless you're listening or hovering */
    let visible = false, hovering = false, timer = 0;
    const auto = () => visible && !hovering && !soundOn && !document.hidden && !reduced && !drag;
    function restart() {
      clearTimeout(timer);
      bar.classList.remove("run");
      void bar.offsetWidth;
      if (!auto()) return;
      bar.style.animationDuration = DWELL + "ms";
      bar.classList.add("run");
      timer = setTimeout(() => (auto() ? next() : restart()), DWELL);
    }
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; restart(); }, { threshold: 0.35 }).observe(deckEl);
    deckEl.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") { hovering = true; restart(); } });
    deckEl.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") { hovering = false; restart(); } });
    document.addEventListener("visibilitychange", restart);

    /* audio: one voice per song, real tracks when present, otherwise a soft generated chord */
    function ctx() {
      if (!actx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        actx = new AC();
        master = actx.createGain();
        master.gain.value = 0.9;
        master.connect(actx.destination);
      }
      if (actx.state === "suspended") actx.resume();
      return actx;
    }
    function synthStart(v, chord) {
      const a = actx, out = a.createGain();
      out.connect(v.gain);
      const lp = a.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = 900; lp.Q.value = 0.6;
      lp.connect(out);
      const lfo = a.createOscillator(), lfoAmt = a.createGain();
      lfo.frequency.value = 0.07; lfoAmt.gain.value = 420;
      lfo.connect(lfoAmt).connect(lp.frequency);
      const nodes = [lfo], each = 0.11 / chord.length;
      chord.forEach((f, k) => {
        [["sine", 1, 1], ["triangle", 1.004, 0.45]].forEach(([type, mul, g]) => {
          const o = a.createOscillator(), og = a.createGain();
          o.type = type; o.frequency.value = f * mul; o.detune.value = k % 2 ? 4 : -4;
          og.gain.value = each * g;
          o.connect(og).connect(lp);
          nodes.push(o);
        });
      });
      nodes.forEach((n) => n.start());
      const pluck = () => {
        const f = chord[Math.floor(Math.random() * chord.length)] * (Math.random() < 0.5 ? 2 : 4);
        const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime;
        o.type = "sine"; o.frequency.value = f;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.035, t0 + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6);
        o.connect(g).connect(out);
        o.start(t0); o.stop(t0 + 1.7);
      };
      const t = setInterval(() => { if (Math.random() < 0.6) pluck(); }, 520);
      v.synth = { stop() { clearInterval(t); nodes.forEach((n) => { try { n.stop(); } catch (e) {} }); setTimeout(() => out.disconnect(), 200); } };
    }
    const DEFAULT_CHORD = [174.61, 220.0, 261.63, 329.63, 392.0];
    // official previews stream from Apple; if a link has gone stale, look the track up again once
    async function freshPreview(s) {
      if (!s.appleId) return null;
      for (const country of ["us", "in"]) {
        try {
          const r = await fetch(`https://itunes.apple.com/lookup?id=${s.appleId}&entity=song&country=${country}`);
          const j = await r.json();
          const hit = (j.results || []).find((x) => x.previewUrl);
          if (hit) return hit.previewUrl;
        } catch (e) {}
      }
      return null;
    }
    function voice(id) {
      if (voices.has(id)) return voices.get(id);
      const s = SONGS[id] || {};
      const src = s.track || s.preview;
      const v = { gain: actx.createGain(), el: null, synth: null, active: false, broken: !src, stopT: 0, chord: s.chord || DEFAULT_CHORD, retried: false };
      v.gain.gain.value = 0;
      v.gain.connect(master);
      if (src) {
        const el = new Audio();
        el.crossOrigin = "anonymous";
        el.loop = true;
        el.preload = "none";
        el.src = src;
        el.addEventListener("error", async () => {
          if (!v.retried && !s.track) {
            v.retried = true;
            const fresh = await freshPreview(s);
            if (fresh && fresh !== el.src) { el.src = fresh; if (v.active) el.play().catch(() => {}); return; }
          }
          v.broken = true;
          if (v.active && !v.synth) { synthStart(v, v.chord); ui(); }
        });
        try { actx.createMediaElementSource(el).connect(v.gain); v.el = el; } catch (e) { v.broken = true; }
      }
      voices.set(id, v);
      return v;
    }
    function fadeIn(id) {
      const v = voice(id);
      clearTimeout(v.stopT);
      v.active = true;
      if (v.broken) { if (!v.synth) synthStart(v, v.chord); }
      else if (v.el) v.el.play().then(ui).catch(() => {});
      v.gain.gain.cancelScheduledValues(actx.currentTime);
      v.gain.gain.setTargetAtTime(v.broken ? 1 : 0.85, actx.currentTime, 0.28);
    }
    function fadeOut(id) {
      const v = voices.get(id);
      if (!v) return;
      v.active = false;
      v.gain.gain.cancelScheduledValues(actx.currentTime);
      v.gain.gain.setTargetAtTime(0, actx.currentTime, 0.22);
      clearTimeout(v.stopT);
      v.stopT = setTimeout(() => {
        if (v.active) return;
        if (v.el) v.el.pause();
        if (v.synth) { v.synth.stop(); v.synth = null; }
      }, 1400);
    }
    function play(id) {
      if (!actx || id === playing) return;
      if (playing) fadeOut(playing);
      playing = id;
      if (id) fadeIn(id);
    }
    function ui() {
      soundBtn.setAttribute("aria-pressed", String(soundOn));
      label.textContent = soundOn ? "sound on" : "sound off";
      soundBtn.classList.toggle("live", soundOn);
      deckEl.classList.toggle("playing", soundOn);
    }
    function setSound(on) {
      if (on === soundOn) return;
      if (on && !ctx()) return;
      soundOn = on;
      play(on ? order[0].photo.song : null);
      ui();
      restart();
    }
    const press = () => setSound(!soundOn);
    soundBtn.addEventListener("click", press);
    document.addEventListener("ad:key", (e) => { if (e.detail === "m") press(); });

    layout(true);
  })();

  /* ---------- right now: a tiny spoken lesson, on loop ---------- */
  (function sensei() {
    const box = $("#sensei");
    if (!box) return;
    const who = $("#sensei-who"), jp = $("#sensei-jp"), ro = $("#sensei-ro"), en = $("#sensei-en");
    const bars = $$(".wave i", box);
    const LINES = [
      ["sensei", "今日は何をしましたか？", "kyō wa nani o shimashita ka?", "what did you do today?"],
      ["you", "山に登りました。", "yama ni noborimashita.", "i climbed a mountain."],
      ["sensei", "すごい！景色はどうでしたか？", "sugoi! keshiki wa dō deshita ka?", "nice! how was the view?"],
      ["you", "夕日がとてもきれいでした。", "yūhi ga totemo kirei deshita.", "the sunset was really beautiful."],
      ["sensei", "いいですね。発音も完璧です！", "ii desu ne. hatsuon mo kanpeki desu!", "lovely. your pronunciation is spot on!"],
    ];
    let talking = false;
    setInterval(() => {
      bars.forEach((b) => (b.style.height = talking ? 3 + Math.random() * 15 + "px" : "3px"));
    }, 90);
    const show = ([w, j, r, e]) => { who.textContent = w; box.classList.toggle("you", w === "you"); jp.textContent = j; ro.textContent = r; en.textContent = e; };
    if (reduced) return show(LINES[0]);

    let ctrl = null;
    async function play(signal) {
      try {
        for (let n = 0; ; n = (n + 1) % LINES.length) {
          const [w, j, r, e] = LINES[n];
          show([w, "", r, e]);
          ro.classList.add("hide"); en.classList.add("hide");
          talking = true;
          box.classList.add("talking");
          for (const ch of j) { jp.textContent += ch; await sleep(85, signal); }
          talking = false;
          box.classList.remove("talking");
          ro.classList.remove("hide");
          await sleep(350, signal);
          en.classList.remove("hide");
          await sleep(2300, signal);
        }
      } catch (err) { talking = false; box.classList.remove("talking"); }
    }
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !ctrl) { ctrl = new AbortController(); play(ctrl.signal); }
      else if (!e.isIntersecting && ctrl) { ctrl.abort(); ctrl = null; }
    }).observe(box);
  })();

  /* ---------- leetcode, live when the api answers ---------- */
  (async function leetcode() {
    const card = $("#lc");
    if (!card) return;
    const KEY = "lc-stats";
    const get = async (url, map) => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      try {
        const r = await fetch(url, { signal: ctrl.signal });
        if (!r.ok) throw 0;
        return map(await r.json());
      } finally { clearTimeout(t); }
    };
    let d = null;
    try { d = JSON.parse(store.get(KEY, sessionStorage) || "null"); } catch (e) {}
    if (!d) {
      try { d = await get("https://leetcode-api-faisalshohag.vercel.app/aarush_dhingra", (j) => ({ total: j.totalSolved, easy: j.easySolved, medium: j.mediumSolved, hard: j.hardSolved })); }
      catch (e) {
        try { d = await get("https://alfa-leetcode-api.onrender.com/aarush_dhingra/solved", (j) => ({ total: j.solvedProblem, easy: j.easySolved, medium: j.mediumSolved, hard: j.hardSolved })); }
        catch (e2) {}
      }
      if (d && d.total) store.set(KEY, JSON.stringify(d), sessionStorage);
    }
    if (!d || !d.total) d = { total: 229, easy: 119, medium: 98, hard: 12 }; // last known, Oct 2026
    $$(".lc-bar", card).forEach((b) => { $(".n", b).textContent = d[b.dataset.k]; });
    const total = $("#lc-total");
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      $$(".lc-bar", card).forEach((b) => $("i b", b).style.setProperty("--p", ((d[b.dataset.k] / d.total) * 100).toFixed(1)));
      const t0 = performance.now();
      (function step(now) {
        const k = clamp((now - t0) / 1200);
        total.textContent = Math.round(d.total * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      })(t0);
    }, { threshold: 0.4 }).observe(card);
  })();

  /* ---------- got an idea: pitch it, it lands in my inbox ---------- */
  (function pitch() {
    const form = $("#pitch"), input = $("#pitch-in");
    if (!form) return;
    const ideas = [
      "an agent that reads my inbox and only tells me the good news",
      "a dev tool that yells when a test is flaky",
      "an app that plans treks around the sunset",
      "a hackathon team that actually sleeps",
    ];
    $$(".seeds button", form).forEach((b) => b.addEventListener("click", () => {
      input.value = b.textContent.replace("…", " ").replace("something weird", "something weird: ");
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) {
        form.classList.remove("shake");
        void form.offsetWidth;
        form.classList.add("shake");
        input.focus();
        return;
      }
      const subject = encodeURIComponent("an idea we should build");
      const bodyText = encodeURIComponent(`${v}\n\n(sent from your portfolio)`);
      location.href = `mailto:aarushdhingra27@gmail.com?subject=${subject}&body=${bodyText}`;
    });
    if (reduced) return;
    // the placeholder types out a few ideas while the box is empty
    let k = 0, i = 0, del = false;
    (function tick() {
      if (document.activeElement === input || input.value) { input.placeholder = "an agent that..."; return setTimeout(tick, 700); }
      const full = ideas[k];
      let wait = del ? 16 : 42;
      if (!del) { i++; if (i > full.length) { del = true; wait = 1700; } }
      else { i -= 2; if (i <= 0) { i = 0; del = false; k = (k + 1) % ideas.length; wait = 400; } }
      input.placeholder = full.slice(0, i) + (i < full.length ? "▍" : "");
      setTimeout(tick, wait);
    })();
  })();
})();
