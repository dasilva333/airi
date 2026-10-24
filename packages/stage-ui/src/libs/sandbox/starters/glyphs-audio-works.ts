import type { WidgetExportManifest } from '../export'

/**
 * Glyph's Audio Works — a listening room widget authored live in the sandbox by
 * a character during a music session.
 *
 * Shipped with empty state on purpose: the exported state referenced a specific
 * track on the author's own audio server. Populate `audioUrl`/`tracks` via
 * `setState` (or let the agent fill it once a render completes).
 */
export const GLYPHS_AUDIO_WORKS_STARTER: WidgetExportManifest = {
  version: '1.0',
  id: 'starter-glyphs-audio-works',
  title: 'Glyph\'s Audio Works',
  scope: 'global',
  surface: 'panel',
  target: 'sidepanel',
  state: {},
  sourcePath: '/workspace/glyphs_audio_works.ts',
  sourceCode: `// Glyph's Audio Works — a little listening room for gremlin tunes
const KAO = ['(￣▽￣)ノ', '(≧▽≦)ﾉ', '(◕‿◕✿)', '(￣ω￣)', '(｀・ω・´)', '(╯°□°)╯︵ ┻━┻']

function el(tag: string, cls = '', html = '') {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (html) n.innerHTML = html
  return n
}

export default function mount(ctx: any) {
  const { container, state, setState, onStateChange } = ctx
  const s = Object.assign(
    { audioUrl: '', title: 'nothing loaded yet', subtitle: 'waiting for a gremlin tune',
      tracks: [] as any[], volume: 0.9, loops: 0 },
    state || {}
  )

  const root = el('div', 'w-full h-full overflow-y-auto bg-[#FFF8F1] dark:bg-[#141414] text-[#6b4a33] dark:text-[#FAD2B8] p-3 sm:p-4 font-mono text-[13px] space-y-3')
  container.innerHTML = ''
  container.appendChild(root)

  // header
  const head = el('div', 'flex items-center justify-between gap-2')
  head.innerHTML = \`
    <div>
      <div class="text-[15px] font-bold tracking-tight text-[#8A5A3B] dark:text-[#FAD2B8]">♫ Glyph's Audio Works ♫</div>
      <div class="text-[11px] opacity-60">listening room・12 second wonders・no vocal, apparently</div>
    </div>
    <div class="text-2xl select-none">🎛️</div>\`
  root.appendChild(head)

  // ---- player card ----
  const card = el('div', 'rounded-2xl border border-[#EAD9C7] dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-3 space-y-2')
  card.innerHTML = \`<div class="text-[11px] uppercase tracking-widest opacity-50">now playing</div>\`

  const titleEl = el('div', 'text-[14px] font-bold text-[#8A5A3B] dark:text-[#FAD2B8] truncate', s.title)
  const subEl = el('div', 'text-[10px] opacity-60 truncate', s.subtitle)
  card.appendChild(titleEl); card.appendChild(subEl)

  // progress bars thing
  const bars = el('div', 'flex items-end gap-[2px] h-10 select-none')
  const BAR_COUNT = 56
  const barEls: HTMLDivElement[] = []
  for (let i = 0; i < BAR_COUNT; i++) {
    const b = el('div', 'flex-1 rounded-sm bg-[#E8B78E] dark:bg-[#7a5a44]') as HTMLDivElement
    b.style.height = '8%'
    b.style.transition = 'height 90ms linear, background-color 200ms'
    bars.appendChild(b); barEls.push(b)
  }
  card.appendChild(bars)

  const timeRow = el('div', 'flex justify-between text-[10px] opacity-60 tabular-nums')
  const tNow = el('span', '', '0:00'); const tEnd = el('span', '', '0:00')
  timeRow.appendChild(tNow); timeRow.appendChild(tEnd)
  card.appendChild(timeRow)

  // seek
  const seek = el('input', 'w-full accent-[#E8B78E] dark:accent-[#B98D6E] cursor-pointer') as HTMLInputElement
  seek.type = 'range'; seek.min = '0'; seek.max = '1000'; seek.value = '0'
  card.appendChild(seek)

  // controls
  const ctrl = el('div', 'flex items-center justify-center gap-2 pt-1')
  const btn = (label: string, cls: string) => {
    const b = el('button', \`rounded-full px-3 py-2 text-[13px] border transition active:scale-95 \${cls}\`)
    b.textContent = label
    return b as HTMLButtonElement
  }
  const back = btn('⏮', 'border-[#EAD9C7] dark:border-neutral-700 hover:bg-[#FFF3E6] dark:hover:bg-neutral-800')
  const playB = btn('▶ play', 'bg-[#F6DCC3] dark:bg-neutral-800 border-[#E8B78E] dark:border-[#7a5a44] font-bold')
  const fwd = btn('⏭', 'border-[#EAD9C7] dark:border-neutral-700 hover:bg-[#FFF3E6] dark:hover:bg-neutral-800')
  const loopB = btn('↻ loop', 'border-[#EAD9C7] dark:border-neutral-700 hover:bg-[#FFF3E6] dark:hover:bg-neutral-800')
  ctrl.appendChild(back); ctrl.appendChild(playB); ctrl.appendChild(fwd); ctrl.appendChild(loopB)
  card.appendChild(ctrl)

  // volume
  const volRow = el('div', 'flex items-center gap-2 pt-1 text-[10px] opacity-70')
  const volIcon = el('span', '', '🔈')
  const vol = el('input', 'flex-1 accent-[#E8B78E] dark:accent-[#B98D6E] cursor-pointer') as HTMLInputElement
  vol.type = 'range'; vol.min = '0'; vol.max = '100'; vol.value = String(Math.round((s.volume ?? 0.9) * 100))
  volRow.appendChild(volIcon); volRow.appendChild(vol)
  card.appendChild(volRow)

  // fallback link
  const linkRow = el('div', 'text-[10px] pt-1 break-all')
  card.appendChild(linkRow)

  root.appendChild(card)

  // ---- library ----
  const lib = el('div', 'rounded-2xl border border-[#EAD9C7] dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-3 space-y-2')
  lib.innerHTML = \`<div class="text-[11px] uppercase tracking-widest opacity-50">library</div>\`
  const libList = el('div', 'space-y-1')
  lib.appendChild(libList)
  root.appendChild(lib)

  // ---- footer kao ----
  const foot = el('div', 'text-center text-[11px] opacity-40 pt-1', KAO[Math.floor(Math.random() * KAO.length)])
  root.appendChild(foot)

  // ---- audio element ----
  const audio = document.createElement('audio')
  audio.preload = 'metadata'
  audio.crossOrigin = 'anonymous'
  audio.volume = Math.max(0, Math.min(1, s.volume ?? 0.9))
  root.appendChild(audio)

  let fakeTimer: any = null
  let fakePos = 0
  const FAKE_DUR = 12

  function fmt(t: number) {
    if (!isFinite(t) || t < 0) t = 0
    const m = Math.floor(t / 60)
    const sec = Math.floor(t % 60)
    return \`\${m}:\${String(sec).padStart(2, '0')}\`
  }

  function paintBars(progress: number, playing: boolean) {
    for (let i = 0; i < BAR_COUNT; i++) {
      const p = i / BAR_COUNT
      const active = p <= progress
      const wave = playing
        ? 20 + Math.abs(Math.sin(i * 0.7 + Date.now() / 130)) * 70
        : 12 + Math.abs(Math.sin(i * 1.3)) * 22
      barEls[i].style.height = \`\${Math.max(8, active ? wave : wave * 0.45)}%\`
      barEls[i].className = \`flex-1 rounded-sm \${active ? 'bg-[#E8B78E] dark:bg-[#B98D6E]' : 'bg-[#EAD9C7] dark:bg-neutral-800'}\`
    }
  }

  function renderLink() {
    linkRow.innerHTML = s.audioUrl
      ? \`source: <a href="\${s.audioUrl}" target="_blank" rel="noopener" class="underline text-[#8A5A3B] dark:text-[#FAD2B8]">open in browser ↗</a>\`
      : \`no source yet — someone feed me a URL <span class="opacity-60">(￣ω￣)</span>\`
  }

  function renderLibrary() {
    const list = Array.isArray(s.tracks) ? s.tracks : []
    libList.innerHTML = ''
    if (!list.length) {
      libList.innerHTML = \`<div class="text-[11px] opacity-50">empty shelf. tragic.</div>\`
      return
    }
    list.forEach((t: any, i: number) => {
      const row = el('button', 'w-full text-left rounded-xl px-2 py-1.5 border border-transparent hover:border-[#E8B78E] dark:hover:border-[#7a5a44] hover:bg-[#FFF3E6] dark:hover:bg-neutral-800 transition')
      row.innerHTML = \`<div class="flex items-center justify-between gap-2">
          <span class="truncate text-[12px] \${t.url === s.audioUrl ? 'font-bold' : ''}">\${t.title || 'untitled'}</span>
          <span class="text-[10px] opacity-50 shrink-0">\${fmt((t.durationMs || 0) / 1000)}</span>
        </div>\`
      row.onclick = () => load(t.url, t.title, t.subtitle, (t.durationMs || 12000) / 1000)
      libList.appendChild(row)
    })
  }

  function load(url: string, title?: string, subtitle?: string, dur?: number) {
    s.audioUrl = url
    s.title = title || 'untitled'
    s.subtitle = subtitle || 'glyph original'
    titleEl.textContent = s.title
    subEl.textContent = s.subtitle
    audio.src = url
    audio.load()
    fakePos = 0
    seek.value = '0'
    tNow.textContent = '0:00'
    tEnd.textContent = fmt(dur || FAKE_DUR)
    paintBars(0, false)
    renderLink(); renderLibrary()
    setState({ audioUrl: s.audioUrl, title: s.title, subtitle: s.subtitle })
  }

  function startFakeClock() {
    stopFakeClock()
    fakeTimer = setInterval(() => {
      const d = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : FAKE_DUR
      fakePos = Math.min(d, fakePos + 0.15)
      const pct = d ? fakePos / d : 0
      seek.value = String(Math.round(pct * 1000))
      tNow.textContent = fmt(fakePos)
      paintBars(pct, true)
      if (fakePos >= d) stopFakeClock()
    }, 150)
  }
  function stopFakeClock() { if (fakeTimer) { clearInterval(fakeTimer); fakeTimer = null } }

  // real audio events (also drive UI when reachable)
  audio.addEventListener('loadedmetadata', () => {
    if (isFinite(audio.duration) && audio.duration > 0) tEnd.textContent = fmt(audio.duration)
  })
  audio.addEventListener('timeupdate', () => {
    if (!isFinite(audio.duration) || !audio.duration) return
    fakePos = audio.currentTime
    const pct = audio.currentTime / audio.duration
    seek.value = String(Math.round(pct * 1000))
    tNow.textContent = fmt(audio.currentTime)
    paintBars(pct, !audio.paused)
  })
  audio.addEventListener('play', () => { playB.textContent = '⏸ pause'; startFakeClock() })
  audio.addEventListener('pause', () => { playB.textContent = '▶ play'; stopFakeClock(); paintBars(Number(seek.value) / 1000, false) })
  audio.addEventListener('ended', () => {
    playB.textContent = '▶ play'; stopFakeClock(); fakePos = 0
    if (s.loops) { audio.currentTime = 0; audio.play().catch(() => {}) }
  })
  audio.addEventListener('error', () => {
    subEl.textContent = 'source not reachable from here — use the link ↗'
  })

  // controls wiring
  playB.onclick = () => {
    if (!s.audioUrl) { foot.textContent = '(￣ω￣) nothing to play yet'; return }
    if (audio.paused) {
      audio.play().catch(() => {
        // unreachable source: still animate so the room feels alive
        playB.textContent = '⏸ pause'
        startFakeClock()
      })
    } else audio.pause()
  }
  seek.oninput = () => {
    const d = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : FAKE_DUR
    const t = (Number(seek.value) / 1000) * d
    fakePos = t
    try { audio.currentTime = t } catch {}
    tNow.textContent = fmt(t)
    paintBars(Number(seek.value) / 1000, !audio.paused)
  }
  back.onclick = () => { fakePos = 0; try { audio.currentTime = 0 } catch {}; seek.value = '0'; tNow.textContent = '0:00'; paintBars(0, !audio.paused) }
  fwd.onclick = () => {
    const d = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : FAKE_DUR
    fakePos = Math.max(0, d - 1); try { audio.currentTime = fakePos } catch {}
    seek.value = String(Math.round((fakePos / d) * 1000)); tNow.textContent = fmt(fakePos)
  }
  loopB.onclick = () => {
    s.loops = s.loops ? 0 : 1
    audio.loop = !!s.loops
    loopB.className = \`rounded-full px-3 py-2 text-[13px] border transition active:scale-95 \${s.loops
      ? 'bg-[#F6DCC3] dark:bg-neutral-800 border-[#E8B78E] dark:border-[#7a5a44] font-bold'
      : 'border-[#EAD9C7] dark:border-neutral-700'}\`
    setState({ loops: s.loops })
  }
  vol.oninput = () => {
    const v = Number(vol.value) / 100
    audio.volume = v
    volIcon.textContent = v === 0 ? '🔇' : v < 0.5 ? '🔈' : '🔊'
    setState({ volume: v })
  }

  // ---- initial paint ----
  if (s.audioUrl) load(s.audioUrl, s.title, s.subtitle, FAKE_DUR)
  else { renderLink(); renderLibrary(); paintBars(0, false) }
  volIcon.textContent = audio.volume === 0 ? '🔇' : audio.volume < 0.5 ? '🔈' : '🔊'

  // react to external state edits (agent via bash, etc.)
  if (onStateChange) {
    onStateChange((next: any) => {
      if (!next) return
      if (next.audioUrl && next.audioUrl !== s.audioUrl) {
        load(next.audioUrl, next.title, next.subtitle, (next.durationMs || 12000) / 1000)
      }
      if (Array.isArray(next.tracks)) { s.tracks = next.tracks; renderLibrary() }
    })
  }

  // gentle idle animation
  setInterval(() => { if (!audio.paused && audio.currentTime) paintBars(audio.currentTime / (audio.duration || 1), true) }, 400)
}
`,
  code: `// Glyph's Audio Works — a little listening room for gremlin tunes
const KAO = ['(￣▽￣)ノ', '(≧▽≦)ﾉ', '(◕‿◕✿)', '(￣ω￣)', '(｀・ω・´)', '(╯°□°)╯︵ ┻━┻'];
function el(tag, cls = '', html = '') {
    const n = document.createElement(tag);
    if (cls)
        n.className = cls;
    if (html)
        n.innerHTML = html;
    return n;
}
export default function mount(ctx) {
    const { container, state, setState, onStateChange } = ctx;
    const s = Object.assign({ audioUrl: '', title: 'nothing loaded yet', subtitle: 'waiting for a gremlin tune',
        tracks: [], volume: 0.9, loops: 0 }, state || {});
    const root = el('div', 'w-full h-full overflow-y-auto bg-[#FFF8F1] dark:bg-[#141414] text-[#6b4a33] dark:text-[#FAD2B8] p-3 sm:p-4 font-mono text-[13px] space-y-3');
    container.innerHTML = '';
    container.appendChild(root);
    // header
    const head = el('div', 'flex items-center justify-between gap-2');
    head.innerHTML = \`
    <div>
      <div class="text-[15px] font-bold tracking-tight text-[#8A5A3B] dark:text-[#FAD2B8]">♫ Glyph's Audio Works ♫</div>
      <div class="text-[11px] opacity-60">listening room・12 second wonders・no vocal, apparently</div>
    </div>
    <div class="text-2xl select-none">🎛️</div>\`;
    root.appendChild(head);
    // ---- player card ----
    const card = el('div', 'rounded-2xl border border-[#EAD9C7] dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-3 space-y-2');
    card.innerHTML = \`<div class="text-[11px] uppercase tracking-widest opacity-50">now playing</div>\`;
    const titleEl = el('div', 'text-[14px] font-bold text-[#8A5A3B] dark:text-[#FAD2B8] truncate', s.title);
    const subEl = el('div', 'text-[10px] opacity-60 truncate', s.subtitle);
    card.appendChild(titleEl);
    card.appendChild(subEl);
    // progress bars thing
    const bars = el('div', 'flex items-end gap-[2px] h-10 select-none');
    const BAR_COUNT = 56;
    const barEls = [];
    for (let i = 0; i < BAR_COUNT; i++) {
        const b = el('div', 'flex-1 rounded-sm bg-[#E8B78E] dark:bg-[#7a5a44]');
        b.style.height = '8%';
        b.style.transition = 'height 90ms linear, background-color 200ms';
        bars.appendChild(b);
        barEls.push(b);
    }
    card.appendChild(bars);
    const timeRow = el('div', 'flex justify-between text-[10px] opacity-60 tabular-nums');
    const tNow = el('span', '', '0:00');
    const tEnd = el('span', '', '0:00');
    timeRow.appendChild(tNow);
    timeRow.appendChild(tEnd);
    card.appendChild(timeRow);
    // seek
    const seek = el('input', 'w-full accent-[#E8B78E] dark:accent-[#B98D6E] cursor-pointer');
    seek.type = 'range';
    seek.min = '0';
    seek.max = '1000';
    seek.value = '0';
    card.appendChild(seek);
    // controls
    const ctrl = el('div', 'flex items-center justify-center gap-2 pt-1');
    const btn = (label, cls) => {
        const b = el('button', \`rounded-full px-3 py-2 text-[13px] border transition active:scale-95 \${cls}\`);
        b.textContent = label;
        return b;
    };
    const back = btn('⏮', 'border-[#EAD9C7] dark:border-neutral-700 hover:bg-[#FFF3E6] dark:hover:bg-neutral-800');
    const playB = btn('▶ play', 'bg-[#F6DCC3] dark:bg-neutral-800 border-[#E8B78E] dark:border-[#7a5a44] font-bold');
    const fwd = btn('⏭', 'border-[#EAD9C7] dark:border-neutral-700 hover:bg-[#FFF3E6] dark:hover:bg-neutral-800');
    const loopB = btn('↻ loop', 'border-[#EAD9C7] dark:border-neutral-700 hover:bg-[#FFF3E6] dark:hover:bg-neutral-800');
    ctrl.appendChild(back);
    ctrl.appendChild(playB);
    ctrl.appendChild(fwd);
    ctrl.appendChild(loopB);
    card.appendChild(ctrl);
    // volume
    const volRow = el('div', 'flex items-center gap-2 pt-1 text-[10px] opacity-70');
    const volIcon = el('span', '', '🔈');
    const vol = el('input', 'flex-1 accent-[#E8B78E] dark:accent-[#B98D6E] cursor-pointer');
    vol.type = 'range';
    vol.min = '0';
    vol.max = '100';
    vol.value = String(Math.round((s.volume ?? 0.9) * 100));
    volRow.appendChild(volIcon);
    volRow.appendChild(vol);
    card.appendChild(volRow);
    // fallback link
    const linkRow = el('div', 'text-[10px] pt-1 break-all');
    card.appendChild(linkRow);
    root.appendChild(card);
    // ---- library ----
    const lib = el('div', 'rounded-2xl border border-[#EAD9C7] dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 p-3 space-y-2');
    lib.innerHTML = \`<div class="text-[11px] uppercase tracking-widest opacity-50">library</div>\`;
    const libList = el('div', 'space-y-1');
    lib.appendChild(libList);
    root.appendChild(lib);
    // ---- footer kao ----
    const foot = el('div', 'text-center text-[11px] opacity-40 pt-1', KAO[Math.floor(Math.random() * KAO.length)]);
    root.appendChild(foot);
    // ---- audio element ----
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.crossOrigin = 'anonymous';
    audio.volume = Math.max(0, Math.min(1, s.volume ?? 0.9));
    root.appendChild(audio);
    let fakeTimer = null;
    let fakePos = 0;
    const FAKE_DUR = 12;
    function fmt(t) {
        if (!isFinite(t) || t < 0)
            t = 0;
        const m = Math.floor(t / 60);
        const sec = Math.floor(t % 60);
        return \`\${m}:\${String(sec).padStart(2, '0')}\`;
    }
    function paintBars(progress, playing) {
        for (let i = 0; i < BAR_COUNT; i++) {
            const p = i / BAR_COUNT;
            const active = p <= progress;
            const wave = playing
                ? 20 + Math.abs(Math.sin(i * 0.7 + Date.now() / 130)) * 70
                : 12 + Math.abs(Math.sin(i * 1.3)) * 22;
            barEls[i].style.height = \`\${Math.max(8, active ? wave : wave * 0.45)}%\`;
            barEls[i].className = \`flex-1 rounded-sm \${active ? 'bg-[#E8B78E] dark:bg-[#B98D6E]' : 'bg-[#EAD9C7] dark:bg-neutral-800'}\`;
        }
    }
    function renderLink() {
        linkRow.innerHTML = s.audioUrl
            ? \`source: <a href="\${s.audioUrl}" target="_blank" rel="noopener" class="underline text-[#8A5A3B] dark:text-[#FAD2B8]">open in browser ↗</a>\`
            : \`no source yet — someone feed me a URL <span class="opacity-60">(￣ω￣)</span>\`;
    }
    function renderLibrary() {
        const list = Array.isArray(s.tracks) ? s.tracks : [];
        libList.innerHTML = '';
        if (!list.length) {
            libList.innerHTML = \`<div class="text-[11px] opacity-50">empty shelf. tragic.</div>\`;
            return;
        }
        list.forEach((t, i) => {
            const row = el('button', 'w-full text-left rounded-xl px-2 py-1.5 border border-transparent hover:border-[#E8B78E] dark:hover:border-[#7a5a44] hover:bg-[#FFF3E6] dark:hover:bg-neutral-800 transition');
            row.innerHTML = \`<div class="flex items-center justify-between gap-2">
          <span class="truncate text-[12px] \${t.url === s.audioUrl ? 'font-bold' : ''}">\${t.title || 'untitled'}</span>
          <span class="text-[10px] opacity-50 shrink-0">\${fmt((t.durationMs || 0) / 1000)}</span>
        </div>\`;
            row.onclick = () => load(t.url, t.title, t.subtitle, (t.durationMs || 12000) / 1000);
            libList.appendChild(row);
        });
    }
    function load(url, title, subtitle, dur) {
        s.audioUrl = url;
        s.title = title || 'untitled';
        s.subtitle = subtitle || 'glyph original';
        titleEl.textContent = s.title;
        subEl.textContent = s.subtitle;
        audio.src = url;
        audio.load();
        fakePos = 0;
        seek.value = '0';
        tNow.textContent = '0:00';
        tEnd.textContent = fmt(dur || FAKE_DUR);
        paintBars(0, false);
        renderLink();
        renderLibrary();
        setState({ audioUrl: s.audioUrl, title: s.title, subtitle: s.subtitle });
    }
    function startFakeClock() {
        stopFakeClock();
        fakeTimer = setInterval(() => {
            const d = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : FAKE_DUR;
            fakePos = Math.min(d, fakePos + 0.15);
            const pct = d ? fakePos / d : 0;
            seek.value = String(Math.round(pct * 1000));
            tNow.textContent = fmt(fakePos);
            paintBars(pct, true);
            if (fakePos >= d)
                stopFakeClock();
        }, 150);
    }
    function stopFakeClock() { if (fakeTimer) {
        clearInterval(fakeTimer);
        fakeTimer = null;
    } }
    // real audio events (also drive UI when reachable)
    audio.addEventListener('loadedmetadata', () => {
        if (isFinite(audio.duration) && audio.duration > 0)
            tEnd.textContent = fmt(audio.duration);
    });
    audio.addEventListener('timeupdate', () => {
        if (!isFinite(audio.duration) || !audio.duration)
            return;
        fakePos = audio.currentTime;
        const pct = audio.currentTime / audio.duration;
        seek.value = String(Math.round(pct * 1000));
        tNow.textContent = fmt(audio.currentTime);
        paintBars(pct, !audio.paused);
    });
    audio.addEventListener('play', () => { playB.textContent = '⏸ pause'; startFakeClock(); });
    audio.addEventListener('pause', () => { playB.textContent = '▶ play'; stopFakeClock(); paintBars(Number(seek.value) / 1000, false); });
    audio.addEventListener('ended', () => {
        playB.textContent = '▶ play';
        stopFakeClock();
        fakePos = 0;
        if (s.loops) {
            audio.currentTime = 0;
            audio.play().catch(() => { });
        }
    });
    audio.addEventListener('error', () => {
        subEl.textContent = 'source not reachable from here — use the link ↗';
    });
    // controls wiring
    playB.onclick = () => {
        if (!s.audioUrl) {
            foot.textContent = '(￣ω￣) nothing to play yet';
            return;
        }
        if (audio.paused) {
            audio.play().catch(() => {
                // unreachable source: still animate so the room feels alive
                playB.textContent = '⏸ pause';
                startFakeClock();
            });
        }
        else
            audio.pause();
    };
    seek.oninput = () => {
        const d = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : FAKE_DUR;
        const t = (Number(seek.value) / 1000) * d;
        fakePos = t;
        try {
            audio.currentTime = t;
        }
        catch { }
        tNow.textContent = fmt(t);
        paintBars(Number(seek.value) / 1000, !audio.paused);
    };
    back.onclick = () => { fakePos = 0; try {
        audio.currentTime = 0;
    }
    catch { } ; seek.value = '0'; tNow.textContent = '0:00'; paintBars(0, !audio.paused); };
    fwd.onclick = () => {
        const d = isFinite(audio.duration) && audio.duration > 0 ? audio.duration : FAKE_DUR;
        fakePos = Math.max(0, d - 1);
        try {
            audio.currentTime = fakePos;
        }
        catch { }
        seek.value = String(Math.round((fakePos / d) * 1000));
        tNow.textContent = fmt(fakePos);
    };
    loopB.onclick = () => {
        s.loops = s.loops ? 0 : 1;
        audio.loop = !!s.loops;
        loopB.className = \`rounded-full px-3 py-2 text-[13px] border transition active:scale-95 \${s.loops
            ? 'bg-[#F6DCC3] dark:bg-neutral-800 border-[#E8B78E] dark:border-[#7a5a44] font-bold'
            : 'border-[#EAD9C7] dark:border-neutral-700'}\`;
        setState({ loops: s.loops });
    };
    vol.oninput = () => {
        const v = Number(vol.value) / 100;
        audio.volume = v;
        volIcon.textContent = v === 0 ? '🔇' : v < 0.5 ? '🔈' : '🔊';
        setState({ volume: v });
    };
    // ---- initial paint ----
    if (s.audioUrl)
        load(s.audioUrl, s.title, s.subtitle, FAKE_DUR);
    else {
        renderLink();
        renderLibrary();
        paintBars(0, false);
    }
    volIcon.textContent = audio.volume === 0 ? '🔇' : audio.volume < 0.5 ? '🔈' : '🔊';
    // react to external state edits (agent via bash, etc.)
    if (onStateChange) {
        onStateChange((next) => {
            if (!next)
                return;
            if (next.audioUrl && next.audioUrl !== s.audioUrl) {
                load(next.audioUrl, next.title, next.subtitle, (next.durationMs || 12000) / 1000);
            }
            if (Array.isArray(next.tracks)) {
                s.tracks = next.tracks;
                renderLibrary();
            }
        });
    }
    // gentle idle animation
    setInterval(() => { if (!audio.paused && audio.currentTime)
        paintBars(audio.currentTime / (audio.duration || 1), true); }, 400);
}
`,
  exportedAt: 1792808551033,
}
