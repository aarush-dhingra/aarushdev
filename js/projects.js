(() => {
  "use strict";
  const { $, $$, C, sleep, sizeCanvas } = window.AD;
  const demos = {};

  // run each card's demo only while it's on screen
  function mount() {
    $$("[data-demo]").forEach((card) => {
      const run = demos[card.dataset.demo];
      if (!run) return;
      let ctrl = null;
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting && !ctrl) { ctrl = new AbortController(); run(ctrl.signal); }
        else if (!e.isIntersecting && ctrl) { ctrl.abort(); ctrl = null; }
      }, { rootMargin: "60px" }).observe(card);
    });
  }

  function frames(signal, fn) {
    let raf = 0, last = 0;
    const step = (now) => {
      if (signal.aborted) return;
      fn(Math.min(64, now - (last || now)), now);
      last = now;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    signal.addEventListener("abort", () => cancelAnimationFrame(raf), { once: true });
  }

  /* prmpt: raw prompt in, hotkey, structured prompt streams out */
  demos.prmpt = async (signal) => {
    const inEl = $("#pm-in"), out = $("#pm-out"), keys = $(".pm-keys");
    const scripts = [
      ["fix the login bug", [
        ["role", "senior engineer on an Express + JWT auth service"],
        ["task", "find why valid logins return 401 after a token refresh"],
        ["look at", "auth middleware, the refresh route, clock skew"],
        ["return", "root cause → minimal patch → a regression test"],
      ]],
      ["make my dashboard faster", [
        ["role", "frontend performance engineer"],
        ["task", "cut time-to-interactive on a React + Recharts page"],
        ["check", "bundle size, wasted re-renders, unvirtualised lists"],
        ["return", "fixes ranked by expected gain"],
      ]],
      ["explain rag to me", [
        ["role", "patient teacher, assumes basic python"],
        ["task", "explain retrieval-augmented generation in 5 steps"],
        ["include", "one ascii diagram, one 20-line example"],
        ["avoid", "jargon without a one-line definition"],
      ]],
    ];
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    let k = 0;
    try {
      for (;;) {
        const [raw, lines] = scripts[k++ % scripts.length];
        inEl.textContent = ""; out.innerHTML = "";
        await sleep(400, signal);
        for (const ch of raw) { inEl.textContent += ch; await sleep(38 + Math.random() * 50, signal); }
        await sleep(450, signal);
        keys.classList.add("down"); await sleep(200, signal); keys.classList.remove("down");
        await sleep(300, signal);
        let html = "";
        for (const [key, val] of lines) {
          const words = val.split(" ");
          html += `<b>${key.padEnd(8, " ")}</b>`;
          for (let i = 0; i < words.length; i++) {
            html += esc((i ? " " : "") + words[i]);
            out.innerHTML = html;
            await sleep(30 + Math.random() * 40, signal);
          }
          html += "\n";
        }
        await sleep(2800, signal);
      }
    } catch (e) { /* stopped */ }
  };

  /* netshape: pick a profile, watch the throughput change */
  (function () {
    const group = $(".net-profiles");
    if (!group) return;
    const P = {
      fiber: { bw: 0.9, jit: 0.04, loss: 0, read: "100 Mbps · 5ms · 0% loss" },
      "4g": { bw: 0.6, jit: 0.12, loss: 0.01, read: "20 Mbps · 50ms · 0.5% loss" },
      "3g": { bw: 0.3, jit: 0.15, loss: 0.03, read: "1.6 Mbps · 150ms · 2% loss" },
      "2g": { bw: 0.09, jit: 0.07, loss: 0.08, read: "250 kbps · 400ms · 5% loss" },
    };
    const read = $("#net-read");
    const pill = document.createElement("span");
    pill.className = "net-pill";
    group.prepend(pill);
    let cur = "fiber";
    const place = () => {
      const b = $(`[data-p="${cur}"]`, group);
      pill.style.width = b.offsetWidth + "px";
      pill.style.transform = `translateX(${b.offsetLeft - 1}px)`;
    };
    function set(name) {
      cur = name;
      $$("button", group).forEach((b) => b.setAttribute("aria-checked", String(b.dataset.p === name)));
      read.textContent = P[name].read;
      place();
    }
    group.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) set(b.dataset.p); });
    group.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const keys = Object.keys(P);
      const i = (keys.indexOf(cur) + (e.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length;
      set(keys[i]);
      $(`[data-p="${keys[i]}"]`, group).focus();
    });
    set("fiber");
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(place);

    demos.netshape = (signal) => {
      const c = $("#net-canvas");
      let ctx, w, h, n, bars, level = P[cur].bw, acc = 0;
      const BAR = 4;
      const fill = () => Array.from({ length: n }, () => Math.max(0.02, level + (Math.random() - 0.5) * 2 * P[cur].jit));
      const resize = () => { ({ ctx, w, h } = sizeCanvas(c)); n = Math.ceil(w / BAR); bars = fill(); place(); };
      resize();
      addEventListener("resize", resize);
      signal.addEventListener("abort", () => removeEventListener("resize", resize), { once: true });
      frames(signal, (dt) => {
        acc += dt;
        while (acc > 50) {
          acc -= 50;
          const p = P[cur];
          level += (p.bw - level) * 0.12;
          const lost = Math.random() < p.loss;
          bars.push(lost ? -1 : Math.max(0.02, level + (Math.random() - 0.5) * 2 * p.jit + Math.sin(performance.now() / 700) * p.jit * 0.5));
          bars.shift();
        }
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < n; i++) {
          const v = bars[i], x = i * BAR;
          if (v < 0) { ctx.globalAlpha = 1; ctx.fillStyle = C.sun; ctx.fillRect(x, h - 3, 2, 3); continue; }
          const bh = Math.max(1, v * (h - 6));
          ctx.globalAlpha = 0.18 + 0.6 * (i / n);
          ctx.fillStyle = C.fg;
          ctx.fillRect(x, h - bh, 2, bh);
        }
        ctx.globalAlpha = 1;
      });
    };
  })();

  /* devpulse: an activity grid that keeps filling in */
  demos.pulse = (signal) => {
    const grid = $("#pulse-grid");
    const cols = grid.clientWidth < 360 ? 22 : 28;
    if (grid.dataset.cols !== String(cols)) {
      grid.innerHTML = "";
      grid.dataset.cols = cols;
      let s = 7;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let c = 0; c < cols; c++) for (let r = 0; r < 7; r++) {
        const ramp = 0.35 + (c / cols) * 0.65;
        let lv = rnd() * ramp * (r === 0 || r === 6 ? 0.6 : 1);
        lv = lv < 0.18 ? 0 : lv < 0.4 ? 1 : lv < 0.6 ? 2 : lv < 0.8 ? 3 : 4;
        const i = document.createElement("i");
        i.dataset.l = lv;
        grid.appendChild(i);
      }
    }
    const cells = $$("i", grid);
    cells.forEach((el) => (el.className = ""));
    cells.forEach((el, k) => setTimeout(() => { if (!signal.aborted) el.className = "l" + el.dataset.l; }, 100 + Math.floor(k / 7) * 26 + (k % 7) * 10));
    (async () => {
      try {
        await sleep(1400, signal);
        for (;;) {
          const el = cells[Math.floor(cells.length * (0.6 + Math.random() * 0.4))];
          const l = Math.min(4, +el.dataset.l + 1);
          el.dataset.l = l;
          el.className = "l" + l + " hit";
          await sleep(650 + Math.random() * 900, signal);
        }
      } catch (e) {}
    })();
  };

  /* jev vs laya: an italian game on loop */
  (function () {
    const board = $("#board");
    if (!board) return;
    const G = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
    const paint = (s, piece) => {
      s.textContent = piece ? G[piece.toLowerCase()] + "︎" : "";
      s.classList.toggle("pw", !!piece && piece === piece.toUpperCase());
      s.classList.toggle("pb", !!piece && piece === piece.toLowerCase());
    };
    const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
    const MOVES = ["e2e4 e4", "e7e5 e5", "g1f3 Nf3", "b8c6 Nc6", "f1c4 Bc4", "f8c5 Bc5", "c2c3 c3", "g8f6 Nf6", "d2d4 d4", "e5d4 exd4", "c3d4 cxd4", "c5b4 Bb4+", "c1d2 Bd2", "b4d2 Bxd2+", "b1d2 Nbxd2", "d7d5 d5"];
    const sqs = [];
    for (let i = 0; i < 64; i++) {
      const s = document.createElement("span");
      if (((i >> 3) + i) % 2) s.classList.add("d");
      board.appendChild(s);
      sqs.push(s);
    }
    let pos;
    const idx = (sq) => (8 - +sq[1]) * 8 + (sq.charCodeAt(0) - 97);
    function reset() {
      pos = [];
      START.split("/").forEach((row) => { for (const ch of row) /\d/.test(ch) ? pos.push(...Array(+ch).fill("")) : pos.push(ch); });
      sqs.forEach((s, i) => { paint(s, pos[i]); s.classList.remove("from", "to", "pop"); });
    }
    const side = { w: $('[data-side="w"]'), b: $('[data-side="b"]') };
    const moveEl = $("#chess-move");
    const turn = (c) => { side.w.classList.toggle("turn", c === "w"); side.b.classList.toggle("turn", c === "b"); };
    reset();
    demos.chess = async (signal) => {
      try {
        for (;;) {
          reset(); turn("w"); moveEl.textContent = "—";
          await sleep(900, signal);
          for (let m = 0; m < MOVES.length; m++) {
            const [uci, san] = MOVES[m].split(" ");
            const a = idx(uci.slice(0, 2)), b = idx(uci.slice(2, 4));
            pos[b] = pos[a]; pos[a] = "";
            sqs.forEach((s) => s.classList.remove("from", "to", "pop"));
            paint(sqs[a], "");
            paint(sqs[b], pos[b]);
            sqs[a].classList.add("from");
            void sqs[b].offsetWidth;
            sqs[b].classList.add("to", "pop");
            moveEl.textContent = `${Math.floor(m / 2) + 1}.${m % 2 ? ".." : ""} ${san}`;
            turn(m % 2 ? "w" : "b");
            await sleep(1100 + Math.random() * 500, signal);
          }
          turn("");
          await sleep(2600, signal);
        }
      } catch (e) {}
    };
  })();

  /* vidnova: a player that buffers ahead and lets you seek */
  (function () {
    const bar = $("#vid-bar");
    if (!bar) return;
    const DUR = 204, SPEED = 6;
    const pos = $("#vid-pos"), buf = $("#vid-buf"), tip = $("#vid-tip");
    const play = $("#vid-play"), screen = $("#vid-screen"), time = $("#vid-time");
    let t = 0, b = 0, playing = false, stall = 0;
    const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
    function render() {
      pos.style.width = (t / DUR) * 100 + "%";
      buf.style.width = (b / DUR) * 100 + "%";
      time.textContent = `${mmss(t)} / ${mmss(DUR)}`;
      screen.classList.toggle("loading", stall > 0 && playing);
    }
    function setPlaying(v) {
      playing = v;
      play.classList.toggle("on", v);
      screen.classList.toggle("playing", v);
      play.setAttribute("aria-label", v ? "Pause demo" : "Play demo");
    }
    play.addEventListener("click", () => setPlaying(!playing));
    bar.addEventListener("pointermove", (e) => {
      const r = bar.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      tip.style.left = f * 100 + "%";
      tip.textContent = mmss(f * DUR);
    });
    bar.addEventListener("click", (e) => {
      const r = bar.getBoundingClientRect();
      t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * DUR;
      if (t > b) { b = t; stall = 700; }
      render();
    });
    render();
    demos.vid = (signal) => {
      stall = 600;
      setPlaying(true);
      signal.addEventListener("abort", () => setPlaying(false), { once: true });
      frames(signal, (dt) => {
        if (!playing) return;
        b = Math.min(DUR, b + (dt / 1000) * SPEED * 1.8 * (0.5 + Math.random()));
        if (stall > 0) stall -= dt;
        else if (t < b) t = Math.min(DUR, t + (dt / 1000) * SPEED);
        else stall = 500;
        if (t >= DUR) { t = 0; b = 0; stall = 500; }
        render();
      });
    };
  })();

  /* wh-bot: messages come in, the laptop answers */
  demos.chat = async (signal) => {
    const box = $("#chat");
    const convos = [
      ["bro you up? need help with the dsa assignment", "in a meeting rn, will call you back in an hour"],
      ["did you push the fix or not 😭", "pushing in 10, tests are running"],
      ["trek this weekend?? sunrise at the peak", "obviously. i'm in, send the plan"],
    ];
    const add = (cls, html) => { const b = document.createElement("div"); b.className = "bub " + cls; b.innerHTML = html; box.appendChild(b); while (box.children.length > 5) box.firstChild.remove(); return b; };
    const esc = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    box.innerHTML = "";
    let k = 0;
    try {
      for (;;) {
        const [them, me] = convos[k++ % convos.length];
        await sleep(700, signal);
        add("them", esc(them));
        await sleep(600, signal);
        const typing = add("me typing", "<i></i><i></i><i></i>");
        await sleep(1300, signal);
        typing.remove();
        add("me", `${esc(me)}<small>auto-reply · phi-3 · local</small>`);
        await sleep(2200, signal);
      }
    } catch (e) {}
  };

  /* live repo count + what they're written in */
  fetch("https://api.github.com/users/aarush-dhingra/repos?per_page=100")
    .then((r) => (r.ok ? r.json() : null))
    .then((repos) => {
      if (!Array.isArray(repos) || !repos.length) return;
      const own = repos.filter((r) => !r.fork);
      $("#repo-count").textContent = `${own.length} repos`;
      const count = {};
      own.forEach((r) => { if (r.language) count[r.language] = (count[r.language] || 0) + 1; });
      const list = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 5);
      const total = list.reduce((s, [, n]) => s + n, 0);
      if (!total) return;
      const shades = ["var(--sun)", "var(--dusk)", "color-mix(in srgb, var(--sun) 55%, var(--line))", "color-mix(in srgb, var(--dusk) 45%, var(--line))", "var(--faint)"];
      const box = $("#langs");
      $(".lang-bar", box).innerHTML = list.map(([, n], i) => `<i style="flex:${n};background:${shades[i]}"></i>`).join("");
      $(".lang-key", box).innerHTML = list.map(([l, n], i) => `<span><b style="background:${shades[i]}"></b>${l.toLowerCase()} ${Math.round((n / total) * 100)}%</span>`).join("");
      box.hidden = false;
    })
    .catch(() => {});

  mount();
})();
