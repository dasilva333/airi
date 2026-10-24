import type { WidgetExportManifest } from '../export'

/**
 * Glyph's Audio Works — a listening room with an oven.
 *
 * The character queues job ids into `state.pending` (via `setState`, or by
 * editing `/workspace/glyphs_audio_works.json`, which the sandbox syncs back
 * into the widget). The widget polls the audio server *only* while something is
 * pending, folds finished renders into its library, and plays them. An empty
 * oven means no timers at all.
 *
 * Ships with empty state on purpose: the library backfills from the server's
 * `music { action: "list" }` on mount, so a fresh install is never a dead panel.
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
  sourceCode: `// Glyph's Audio Works — a listening room with an oven.
//
// Flow: the agent queues job ids into \`state.pending\` (via setState or by editing
// /workspace/glyphs_audio_works.json). This widget polls the audio server only
// while something is pending, moves finished tracks into the library, and plays
// them. It never polls when the oven is empty.

type OrderRequest = {
  prompt?: string
  lyrics?: string
  title?: string
  durationSeconds?: number
  cot?: string
}

type PendingOrder = {
  jobId: string
  title?: string
  requestedAt?: number
  durationSeconds?: number
  request?: OrderRequest
}

type TrackStatus = 'ready' | 'failed' | 'expired' | 'cancelled'

type Track = {
  jobId: string
  title: string
  audioUrl: string
  durationMs: number
  model?: string
  completedAt: number
  status: TrackStatus
  isNew?: boolean
  error?: string
  request?: OrderRequest
}

const DEFAULT_TOOL = 'airi-audio-server::music'
const POLL_MS = 15000
const MAX_POLL_MS = 60000
const SHELF_LIMIT = 50
// Measured YuE 2 throughput is 10-15x real time on an 8GB laptop GPU; the midpoint
// turns a 20 minute wait into an honest ETA instead of a mystery.
const REALTIME_FACTOR = 12.5

const KAO = ['(￣▽￣)ノ', '(≧▽≦)ﾉ', '(◕‿◕✿)', '(￣ω￣)', '(｀・ω・´)', '(╯°□°)╯︵ ┻━┻']

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return \`\${m}:\${String(s).padStart(2, '0')}\`
}

function esc(value: any): string {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Only http(s)/blob/data URLs may reach an href. */
function safeUrl(value: any): string {
  const url = String(value || '')
  return /^(https?:|blob:|data:)/i.test(url) ? url : ''
}

function slugTail(jobId: string): string {
  const parts = String(jobId || '').split('-').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

function fmtEta(ms: number): string {
  if (ms <= 0)
    return 'any moment'
  const mins = Math.ceil(ms / 60000)
  return mins <= 1 ? 'under a minute' : \`~\${mins} min left\`
}

export default function mount(ctx: any) {
  const { container, state, setState, onStateChange, callMcpTool } = ctx

  // ---- state -------------------------------------------------------------
  const s: any = Object.assign({
    pending: [],
    finished: [],
    current: { url: '', title: '' },
    volume: 0.9,
    loops: 0,
    chime: true,
    toolName: DEFAULT_TOOL,
  }, state || {})

  if (!Array.isArray(s.pending))
    s.pending = []
  if (!Array.isArray(s.finished))
    s.finished = []
  if (!s.current)
    s.current = { url: '', title: '' }

  let pollTimer: any = null
  let inFlight = false
  let backoffMs = POLL_MS
  let aclBlocked = false
  let offline = false
  let disposed = false

  // ---- dom helpers -------------------------------------------------------
  function el(tag: string, cls = '', html = ''): HTMLElement {
    const node = document.createElement(tag)
    if (cls)
      node.className = cls
    if (html)
      node.innerHTML = html
    return node
  }

  const root = el(
    'div',
    'w-full h-full overflow-y-auto bg-[#FFF8F1] dark:bg-[#141414] text-[#6b4a33] dark:text-[#FAD2B8] p-3 sm:p-4 font-mono text-[13px] space-y-3',
  )
  container.innerHTML = ''
  container.appendChild(root)

  // header
  const head = el('div', 'flex items-start justify-between gap-2')
  head.innerHTML = \`
    <div class="min-w-0">
      <div class="text-[15px] font-bold tracking-tight text-[#8A5A3B] dark:text-[#FAD2B8]">♫ Glyph's Audio Works ♫</div>
      <div class="text-[11px] opacity-60">listening room・12 second wonders・orders welcome</div>
    </div>
  \`
  const headActions = el('div', 'flex shrink-0 items-center gap-1')
  const chimeBtn = el('button', 'px-1.5 py-0.5 rounded border border-[#EAD9C7] dark:border-neutral-700 text-[11px]')
  const refreshBtn = el('button', 'px-1.5 py-0.5 rounded border border-[#EAD9C7] dark:border-neutral-700 text-[11px]', '↻')
  refreshBtn.title = 'Refresh library'
  headActions.appendChild(chimeBtn)
  headActions.appendChild(refreshBtn)
  head.appendChild(headActions)
  root.appendChild(head)

  const banner = el('div', 'hidden')
  root.appendChild(banner)

  // now playing
  const player = el('div', 'p-2.5 rounded-xl border border-[#EAD9C7] dark:border-neutral-700 bg-[#FFFDF8] dark:bg-[#1b1b1b] space-y-2')
  player.innerHTML = \`
    <div class="flex items-center justify-between text-[10px] uppercase tracking-wider opacity-60">Now playing</div>
    <div class="flex items-baseline gap-2">
      <span class="truncate text-[13px] font-bold" data-role="np-title">nothing loaded yet</span>
      <span class="shrink-0 text-[10px] opacity-60" data-role="np-meta"></span>
    </div>
    <div class="flex items-center gap-2">
      <button data-role="play" class="px-2 py-0.5 rounded bg-[#E8B78E] dark:bg-[#B98D6E] text-[#3b2415] font-bold text-[11px]">▶ play</button>
      <span class="text-[10px] tabular-nums opacity-70" data-role="np-time">0:00 / 0:00</span>
    </div>
    <input data-role="seek" type="range" min="0" max="1000" value="0" class="w-full accent-[#E8B78E] dark:accent-[#B98D6E] cursor-pointer" />
    <div class="flex items-center gap-2 text-[11px]">
      <span>🔈</span>
      <input data-role="vol" type="range" min="0" max="100" value="90" class="flex-1 accent-[#E8B78E] dark:accent-[#B98D6E] cursor-pointer" />
      <button data-role="loop" class="px-1.5 py-0.5 rounded border border-[#EAD9C7] dark:border-neutral-700 text-[10px]">loop</button>
    </div>
    <div class="text-[10px] opacity-60" data-role="np-source"></div>
  \`
  root.appendChild(player)

  // in the oven
  const oven = el('div', 'space-y-1.5')
  root.appendChild(oven)

  // library
  const library = el('div', 'space-y-1.5')
  root.appendChild(library)

  const foot = el('div', 'text-[10px] opacity-50 text-center pt-1')
  root.appendChild(foot)

  // audio
  const audio = document.createElement('audio') as HTMLAudioElement
  audio.preload = 'metadata'
  audio.volume = typeof s.volume === 'number' ? s.volume : 0.9
  audio.loop = !!s.loops

  const npTitle = player.querySelector('[data-role="np-title"]') as HTMLElement
  const npMeta = player.querySelector('[data-role="np-meta"]') as HTMLElement
  const npTime = player.querySelector('[data-role="np-time"]') as HTMLElement
  const npSource = player.querySelector('[data-role="np-source"]') as HTMLElement
  const playBtn = player.querySelector('[data-role="play"]') as HTMLButtonElement
  const seek = player.querySelector('[data-role="seek"]') as HTMLInputElement
  const vol = player.querySelector('[data-role="vol"]') as HTMLInputElement
  const loopBtn = player.querySelector('[data-role="loop"]') as HTMLButtonElement

  // ---- helpers -----------------------------------------------------------
  function pending(): PendingOrder[] {
    return Array.isArray(s.pending) ? s.pending : []
  }

  function finished(): Track[] {
    return Array.isArray(s.finished) ? s.finished : []
  }

  function toolName(): string {
    return s.toolName || DEFAULT_TOOL
  }

  async function callMusic(action: string, extra: Record<string, any> = {}): Promise<any> {
    return await callMcpTool(toolName(), Object.assign({ action }, extra))
  }

  function errorText(err: any): string {
    return String((err && err.message) || err || '')
  }

  function classify(err: any): 'acl' | 'expired' | 'offline' {
    const msg = errorText(err)
    if (/not permitted|not enabled|disabled|allow/i.test(msg))
      return 'acl'
    if (/No music job with id/i.test(msg))
      return 'expired'
    return 'offline'
  }

  function setBanner(text: string, tone: 'warn' | 'error' | ''): void {
    if (!text) {
      banner.className = 'hidden'
      banner.innerHTML = ''
      return
    }
    const palette = tone === 'error'
      ? 'border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300'
      : tone === 'warn'
        ? 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-[#EAD9C7] dark:border-neutral-700 bg-black/5 dark:bg-white/5'
    banner.className = \`px-2.5 py-1.5 rounded-lg border text-[11px] \${palette}\`
    banner.textContent = text
  }

  function chime(): void {
    if (!s.chime)
      return
    try {
      const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext
      if (!Ctor)
        return
      const actx = new Ctor()
      const start = actx.currentTime
      const notes = [880, 1174.66]
      notes.forEach((freq, i) => {
        const osc = actx.createOscillator()
        const gain = actx.createGain()
        const at = start + i * 0.13
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, at)
        gain.gain.exponentialRampToValueAtTime(0.11, at + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34)
        osc.connect(gain)
        gain.connect(actx.destination)
        osc.start(at)
        osc.stop(at + 0.38)
      })
      setTimeout(() => {
        try {
          actx.close()
        }
        catch (e) {}
      }, 900)
    }
    catch (e) {
      // Autoplay/audio unavailable — the "new" badge still tells the story.
    }
  }

  // ---- polling -----------------------------------------------------------
  function schedulePoll(delay: number): void {
    if (disposed)
      return
    if (pollTimer)
      clearTimeout(pollTimer)
    pollTimer = setTimeout(tick, delay)
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  /** Only ever runs while something is pending; stops itself when the oven empties. */
  function ensurePolling(): void {
    if (disposed || aclBlocked)
      return
    if (!pending().length) {
      stopPolling()
      return
    }
    if (pollTimer || inFlight)
      return
    schedulePoll(500)
  }

  async function tick(): Promise<void> {
    pollTimer = null
    if (disposed || inFlight)
      return
    const jobs = pending().slice()
    if (!jobs.length)
      return

    inFlight = true
    let sawError = false
    try {
      for (const job of jobs) {
        const ok = await checkOne(job)
        if (!ok)
          sawError = true
        if (aclBlocked)
          break
      }
    }
    finally {
      inFlight = false
    }

    if (aclBlocked)
      return

    if (sawError) {
      backoffMs = Math.min(MAX_POLL_MS, Math.round(backoffMs * 1.5))
    }
    else {
      backoffMs = POLL_MS
      if (offline) {
        offline = false
        render()
      }
    }

    if (pending().length)
      schedulePoll(backoffMs)
  }

  /** Returns false when the check could not reach the server. */
  async function checkOne(job: PendingOrder): Promise<boolean> {
    let res: any
    try {
      res = await callMusic('status', { jobId: job.jobId })
    }
    catch (err) {
      const kind = classify(err)
      if (kind === 'acl') {
        aclBlocked = true
        setBanner('Music Creation is disabled for this character — enable it in the card tools tab to track orders.', 'warn')
        return true
      }
      if (kind === 'expired') {
        // Server restarted: job records are in-memory and gone.
        moveToFinished(job, { status: 'expired', error: 'The server restarted before this finished.' })
        return true
      }
      if (!offline) {
        offline = true
        setBanner('Cannot reach the audio server — retrying quietly. Tracks already rendered stay in the library.', 'warn')
        render()
      }
      return false
    }

    if (!res)
      return true

    if (res.state === 'done' && res.track) {
      complete(job, res.track)
      return true
    }
    if (res.state === 'failed') {
      moveToFinished(job, { status: 'failed', error: res.error || 'Render failed.' })
      return true
    }
    if (res.state === 'cancelled') {
      moveToFinished(job, { status: 'cancelled', error: 'Cancelled.' })
      return true
    }
    return true
  }

  // ---- state transitions -------------------------------------------------
  function persist(): void {
    setState({
      pending: pending(),
      finished: finished().slice(0, SHELF_LIMIT),
      current: s.current,
      volume: s.volume,
      loops: s.loops,
      chime: s.chime,
    })
  }

  function complete(job: PendingOrder, track: any): void {
    const entry: Track = {
      jobId: job.jobId,
      title: track.title || job.title || 'Untitled',
      audioUrl: track.audioUrl,
      durationMs: track.durationMs || 0,
      model: track.model || '',
      completedAt: Date.now(),
      status: 'ready',
      isNew: true,
    }
    s.pending = pending().filter(j => j.jobId !== job.jobId)
    s.finished = [entry, ...finished().filter(t => t.jobId !== entry.jobId)].slice(0, SHELF_LIMIT)
    persist()
    chime()
    render()
    if (pending().length)
      schedulePoll(POLL_MS)
  }

  function moveToFinished(job: PendingOrder, patch: { status: TrackStatus, error?: string }): void {
    const entry: Track = {
      jobId: job.jobId,
      title: job.title || job.request?.title || 'Untitled',
      audioUrl: '',
      durationMs: Math.round((job.durationSeconds || 60) * 1000),
      completedAt: Date.now(),
      status: patch.status,
      error: patch.error,
      request: job.request,
    }
    s.pending = pending().filter(j => j.jobId !== job.jobId)
    s.finished = [entry, ...finished().filter(t => t.jobId !== entry.jobId)].slice(0, SHELF_LIMIT)
    persist()
    render()
  }

  // ---- actions -----------------------------------------------------------
  async function cancelOrder(job: PendingOrder): Promise<void> {
    try {
      await callMusic('cancel', { jobId: job.jobId })
    }
    catch (err) {
      // Cancelling a finished job is harmless; drop it from the oven either way.
    }
    s.pending = pending().filter(j => j.jobId !== job.jobId)
    persist()
    render()
    if (pending().length)
      ensurePolling()
  }

  async function reorder(track: Track): Promise<void> {
    const request = track.request
    if (!request) {
      setBanner('This order has no stored brief — ask your character to re-order it.', 'warn')
      return
    }
    try {
      const receipt = await callMusic('generate', {
        prompt: request.prompt,
        lyrics: request.lyrics,
        title: request.title,
        durationSeconds: request.durationSeconds,
        cot: request.cot,
      })
      if (receipt && receipt.jobId) {
        s.pending = [...pending(), {
          jobId: receipt.jobId,
          title: request.title || track.title,
          requestedAt: Date.now(),
          durationSeconds: request.durationSeconds,
          request,
        }]
        s.finished = finished().filter(t => t.jobId !== track.jobId)
        persist()
        render()
        ensurePolling()
      }
    }
    catch (err) {
      setBanner(\`Could not re-order: \${errorText(err)}\`, 'error')
    }
  }

  async function backfill(): Promise<void> {
    try {
      const res = await callMusic('list', { limit: SHELF_LIMIT })
      const remote: any[] = (res && res.tracks) || []
      const byId = new Map<string, Track>()
      for (const track of finished())
        byId.set(track.jobId, track)
      for (const track of remote) {
        if (!track || !track.id)
          continue
        if (byId.has(track.id))
          continue
        byId.set(track.id, {
          jobId: track.id,
          title: track.title || 'Untitled',
          audioUrl: track.audioUrl,
          durationMs: track.durationMs || 0,
          model: track.model || '',
          completedAt: track.createdAt ? Date.parse(track.createdAt) || 0 : 0,
          status: 'ready',
        })
      }
      const merged = [...byId.values()].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      s.finished = merged.slice(0, SHELF_LIMIT)
      persist()
      render()
    }
    catch (err) {
      const kind = classify(err)
      if (kind === 'acl')
        setBanner('Music Creation is disabled for this character — enable it in the card tools tab.', 'warn')
      else if (!pending().length)
        setBanner('Library unavailable — the audio server is not answering.', 'warn')
    }
  }

  function load(track: Track): void {
    if (!track || !track.audioUrl)
      return
    s.current = { url: track.audioUrl, title: track.title }
    track.isNew = false
    audio.src = track.audioUrl
    audio.loop = !!s.loops
    npTitle.textContent = track.title
    npMeta.textContent = [track.model, track.durationMs ? fmtClock(track.durationMs) : ''].filter(Boolean).join(' · ')
    npSource.innerHTML = \`source: <a href="\${esc(safeUrl(track.audioUrl))}" target="_blank" rel="noopener" class="underline opacity-80">open in browser ↗</a>\`
    persist()
    render()
    void audio.play().catch(() => {})
  }

  // ---- render ------------------------------------------------------------
  function renderOven(): void {
    oven.innerHTML = ''
    const jobs = pending()
    if (!jobs.length) {
      oven.appendChild(el('div', 'text-[11px] opacity-50 px-1', 'oven empty — ask your character for a tune'))
      return
    }
    oven.appendChild(el('div', 'text-[10px] uppercase tracking-wider opacity-60 px-1', \`in the oven · \${jobs.length}\`))
    for (const job of jobs) {
      const requestedAt = job.requestedAt || Date.now()
      const elapsed = Date.now() - requestedAt
      const expected = (job.durationSeconds || 60) * 1000 * REALTIME_FACTOR
      const remaining = expected - elapsed
      const late = elapsed > expected * 1.5
      const row = el('div', 'flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[#EAD9C7] dark:border-neutral-700 bg-[#FFFDF8] dark:bg-[#1b1b1b]')
      row.innerHTML = \`
        <span class="shrink-0 animate-pulse">◌</span>
        <span class="min-w-0 flex-1 truncate text-[12px]">\${esc(job.title || job.jobId)}</span>
        <span class="shrink-0 text-[10px] tabular-nums opacity-60">\${fmtClock(elapsed)}</span>
        <span class="shrink-0 text-[10px] \${late ? 'text-amber-600 dark:text-amber-400' : 'opacity-60'}">\${late ? 'slower than usual' : fmtEta(remaining)}</span>
      \`
      const cancelBtn = el('button', 'shrink-0 px-1 rounded border border-[#EAD9C7] dark:border-neutral-700 text-[10px]', '✕')
      cancelBtn.title = 'Cancel this order'
      cancelBtn.onclick = () => void cancelOrder(job)
      row.appendChild(cancelBtn)
      oven.appendChild(row)
    }
  }

  function renderLibrary(): void {
    library.innerHTML = ''
    const tracks = finished()
    if (!tracks.length) {
      library.appendChild(el('div', 'text-[11px] opacity-50 px-1', 'library empty — rendered tracks land here'))
      return
    }
    library.appendChild(el('div', 'text-[10px] uppercase tracking-wider opacity-60 px-1', 'library'))

    // Repeated titles are common when a character re-orders the same brief; tag
    // duplicates with the tail of their job slug so the shelf stays scannable.
    const counts = new Map<string, number>()
    for (const track of tracks)
      counts.set(track.title, (counts.get(track.title) || 0) + 1)

    for (const track of tracks) {
      const duplicated = (counts.get(track.title) || 0) > 1
      const label = duplicated ? \`\${track.title} · \${slugTail(track.jobId)}\` : track.title
      const row = el('div', 'flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[#EAD9C7] dark:border-neutral-700')
      const icon = track.status === 'ready' ? '♫' : track.status === 'expired' ? '⌛' : '⚠'
      row.innerHTML = \`
        <span class="shrink-0 opacity-70">\${icon}</span>
        <span class="min-w-0 flex-1 truncate text-[12px] \${track.isNew ? 'font-bold' : ''}">\${esc(label)}</span>
        \${track.isNew ? '<span class="shrink-0 rounded px-1 text-[9px] bg-[#E8B78E]/30">new</span>' : ''}
        <span class="shrink-0 text-[10px] tabular-nums opacity-60">\${track.durationMs ? fmtClock(track.durationMs) : ''}</span>
      \`
      if (track.status === 'ready') {
        const play = el('button', 'shrink-0 px-1.5 rounded bg-[#E8B78E] dark:bg-[#B98D6E] text-[#3b2415] text-[10px] font-bold', '▶')
        play.onclick = () => load(track)
        row.appendChild(play)
      }
      else {
        if (track.request) {
          const again = el('button', 'shrink-0 px-1 rounded border border-[#EAD9C7] dark:border-neutral-700 text-[10px]', '↻')
          again.title = 'Order this again'
          again.onclick = () => void reorder(track)
          row.appendChild(again)
        }
        if (track.error)
          row.title = track.error
      }
      library.appendChild(row)
    }
  }

  function renderPlayer(): void {
    const hasTrack = !!s.current.url
    npTitle.textContent = s.current.title || 'nothing loaded yet'
    if (!hasTrack)
      npMeta.textContent = ''
    playBtn.textContent = audio.paused ? '▶ play' : '⏸ pause'
    loopBtn.className = \`px-1.5 py-0.5 rounded border text-[10px] \${audio.loop
      ? 'bg-[#E8B78E] dark:bg-[#B98D6E] text-[#3b2415] border-transparent'
      : 'border-[#EAD9C7] dark:border-neutral-700'}\`
    vol.value = String(Math.round((audio.volume || 0) * 100))
    chimeBtn.textContent = s.chime ? '🔔 chime' : '🔕 chime'
    foot.textContent = KAO[Math.min(KAO.length - 1, finished().length % KAO.length)]
  }

  function render(): void {
    renderPlayer()
    renderOven()
    renderLibrary()
  }

  // ---- wiring ------------------------------------------------------------
  playBtn.onclick = () => {
    if (!s.current.url)
      return
    if (audio.paused)
      void audio.play().catch(() => {})
    else
      audio.pause()
  }

  seek.oninput = () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
    if (!duration)
      return
    audio.currentTime = (Number(seek.value) / 1000) * duration
  }

  vol.oninput = () => {
    const next = Number(vol.value) / 100
    audio.volume = next
    s.volume = next
    setState({ volume: next })
  }

  loopBtn.onclick = () => {
    audio.loop = !audio.loop
    s.loops = audio.loop ? 1 : 0
    setState({ loops: s.loops })
    renderPlayer()
  }

  chimeBtn.onclick = () => {
    s.chime = !s.chime
    setState({ chime: s.chime })
    if (s.chime)
      chime()
    renderPlayer()
  }

  refreshBtn.onclick = () => {
    void backfill()
    ensurePolling()
  }

  audio.addEventListener('timeupdate', () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
    const cur = audio.currentTime || 0
    npTime.textContent = \`\${fmtClock(cur * 1000)} / \${duration ? fmtClock(duration * 1000) : '0:00'}\`
    if (duration)
      seek.value = String(Math.round((cur / duration) * 1000))
  })
  audio.addEventListener('play', () => renderPlayer())
  audio.addEventListener('pause', () => renderPlayer())
  audio.addEventListener('ended', () => renderPlayer())
  audio.addEventListener('loadedmetadata', () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
    if (duration)
      npTime.textContent = \`\${fmtClock((audio.currentTime || 0) * 1000)} / \${fmtClock(duration * 1000)}\`
  })

  const onVisible = () => {
    if (!document.hidden) {
      // Background windows clamp timers; catch up as soon as we are seen again.
      if (pending().length)
        ensurePolling()
      render()
    }
  }
  document.addEventListener('visibilitychange', onVisible)

  // Refresh the ETA/elapsed labels even while a poll is pending.
  const ticker = setInterval(() => {
    if (!disposed && pending().length)
      renderOven()
  }, 5000)

  const unsub = typeof onStateChange === 'function'
    ? onStateChange((next: any) => {
        if (disposed || !next)
          return
        s.pending = Array.isArray(next.pending) ? next.pending : []
        s.finished = Array.isArray(next.finished) ? next.finished : []
        if (next.current)
          s.current = next.current
        if (typeof next.chime === 'boolean')
          s.chime = next.chime
        if (typeof next.loops === 'number')
          s.loops = next.loops
        render()
        if (pending().length)
          ensurePolling()
      })
    : null

  // ---- boot --------------------------------------------------------------
  if (s.current.url) {
    audio.src = s.current.url
    npSource.innerHTML = \`source: <a href="\${esc(safeUrl(s.current.url))}" target="_blank" rel="noopener" class="underline opacity-80">open in browser ↗</a>\`
    npMeta.textContent = s.current.title || ''
  }

  render()
  void backfill()
  ensurePolling()

  return () => {
    disposed = true
    stopPolling()
    clearInterval(ticker)
    document.removeEventListener('visibilitychange', onVisible)
    audio.pause()
    audio.src = ''
    if (unsub)
      unsub()
    container.innerHTML = ''
  }
}
`,
  code: ` function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }// Glyph's Audio Works — a listening room with an oven.
//
// Flow: the agent queues job ids into \`state.pending\` (via setState or by editing
// /workspace/glyphs_audio_works.json). This widget polls the audio server only
// while something is pending, moves finished tracks into the library, and plays
// them. It never polls when the oven is empty.
































const DEFAULT_TOOL = 'airi-audio-server::music'
const POLL_MS = 15000
const MAX_POLL_MS = 60000
const SHELF_LIMIT = 50
// Measured YuE 2 throughput is 10-15x real time on an 8GB laptop GPU; the midpoint
// turns a 20 minute wait into an honest ETA instead of a mystery.
const REALTIME_FACTOR = 12.5

const KAO = ['(￣▽￣)ノ', '(≧▽≦)ﾉ', '(◕‿◕✿)', '(￣ω￣)', '(｀・ω・´)', '(╯°□°)╯︵ ┻━┻']

function fmtClock(ms) {
  const total = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return \`\${m}:\${String(s).padStart(2, '0')}\`
}

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Only http(s)/blob/data URLs may reach an href. */
function safeUrl(value) {
  const url = String(value || '')
  return /^(https?:|blob:|data:)/i.test(url) ? url : ''
}

function slugTail(jobId) {
  const parts = String(jobId || '').split('-').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

function fmtEta(ms) {
  if (ms <= 0)
    return 'any moment'
  const mins = Math.ceil(ms / 60000)
  return mins <= 1 ? 'under a minute' : \`~\${mins} min left\`
}

export default function mount(ctx) {
  const { container, state, setState, onStateChange, callMcpTool } = ctx

  // ---- state -------------------------------------------------------------
  const s = Object.assign({
    pending: [],
    finished: [],
    current: { url: '', title: '' },
    volume: 0.9,
    loops: 0,
    chime: true,
    toolName: DEFAULT_TOOL,
  }, state || {})

  if (!Array.isArray(s.pending))
    s.pending = []
  if (!Array.isArray(s.finished))
    s.finished = []
  if (!s.current)
    s.current = { url: '', title: '' }

  let pollTimer = null
  let inFlight = false
  let backoffMs = POLL_MS
  let aclBlocked = false
  let offline = false
  let disposed = false

  // ---- dom helpers -------------------------------------------------------
  function el(tag, cls = '', html = '') {
    const node = document.createElement(tag)
    if (cls)
      node.className = cls
    if (html)
      node.innerHTML = html
    return node
  }

  const root = el(
    'div',
    'w-full h-full overflow-y-auto bg-[#FFF8F1] dark:bg-[#141414] text-[#6b4a33] dark:text-[#FAD2B8] p-3 sm:p-4 font-mono text-[13px] space-y-3',
  )
  container.innerHTML = ''
  container.appendChild(root)

  // header
  const head = el('div', 'flex items-start justify-between gap-2')
  head.innerHTML = \`
    <div class="min-w-0">
      <div class="text-[15px] font-bold tracking-tight text-[#8A5A3B] dark:text-[#FAD2B8]">♫ Glyph's Audio Works ♫</div>
      <div class="text-[11px] opacity-60">listening room・12 second wonders・orders welcome</div>
    </div>
  \`
  const headActions = el('div', 'flex shrink-0 items-center gap-1')
  const chimeBtn = el('button', 'px-1.5 py-0.5 rounded border border-[#EAD9C7] dark:border-neutral-700 text-[11px]')
  const refreshBtn = el('button', 'px-1.5 py-0.5 rounded border border-[#EAD9C7] dark:border-neutral-700 text-[11px]', '↻')
  refreshBtn.title = 'Refresh library'
  headActions.appendChild(chimeBtn)
  headActions.appendChild(refreshBtn)
  head.appendChild(headActions)
  root.appendChild(head)

  const banner = el('div', 'hidden')
  root.appendChild(banner)

  // now playing
  const player = el('div', 'p-2.5 rounded-xl border border-[#EAD9C7] dark:border-neutral-700 bg-[#FFFDF8] dark:bg-[#1b1b1b] space-y-2')
  player.innerHTML = \`
    <div class="flex items-center justify-between text-[10px] uppercase tracking-wider opacity-60">Now playing</div>
    <div class="flex items-baseline gap-2">
      <span class="truncate text-[13px] font-bold" data-role="np-title">nothing loaded yet</span>
      <span class="shrink-0 text-[10px] opacity-60" data-role="np-meta"></span>
    </div>
    <div class="flex items-center gap-2">
      <button data-role="play" class="px-2 py-0.5 rounded bg-[#E8B78E] dark:bg-[#B98D6E] text-[#3b2415] font-bold text-[11px]">▶ play</button>
      <span class="text-[10px] tabular-nums opacity-70" data-role="np-time">0:00 / 0:00</span>
    </div>
    <input data-role="seek" type="range" min="0" max="1000" value="0" class="w-full accent-[#E8B78E] dark:accent-[#B98D6E] cursor-pointer" />
    <div class="flex items-center gap-2 text-[11px]">
      <span>🔈</span>
      <input data-role="vol" type="range" min="0" max="100" value="90" class="flex-1 accent-[#E8B78E] dark:accent-[#B98D6E] cursor-pointer" />
      <button data-role="loop" class="px-1.5 py-0.5 rounded border border-[#EAD9C7] dark:border-neutral-700 text-[10px]">loop</button>
    </div>
    <div class="text-[10px] opacity-60" data-role="np-source"></div>
  \`
  root.appendChild(player)

  // in the oven
  const oven = el('div', 'space-y-1.5')
  root.appendChild(oven)

  // library
  const library = el('div', 'space-y-1.5')
  root.appendChild(library)

  const foot = el('div', 'text-[10px] opacity-50 text-center pt-1')
  root.appendChild(foot)

  // audio
  const audio = document.createElement('audio') 
  audio.preload = 'metadata'
  audio.volume = typeof s.volume === 'number' ? s.volume : 0.9
  audio.loop = !!s.loops

  const npTitle = player.querySelector('[data-role="np-title"]') 
  const npMeta = player.querySelector('[data-role="np-meta"]') 
  const npTime = player.querySelector('[data-role="np-time"]') 
  const npSource = player.querySelector('[data-role="np-source"]') 
  const playBtn = player.querySelector('[data-role="play"]') 
  const seek = player.querySelector('[data-role="seek"]') 
  const vol = player.querySelector('[data-role="vol"]') 
  const loopBtn = player.querySelector('[data-role="loop"]') 

  // ---- helpers -----------------------------------------------------------
  function pending() {
    return Array.isArray(s.pending) ? s.pending : []
  }

  function finished() {
    return Array.isArray(s.finished) ? s.finished : []
  }

  function toolName() {
    return s.toolName || DEFAULT_TOOL
  }

  async function callMusic(action, extra = {}) {
    return await callMcpTool(toolName(), Object.assign({ action }, extra))
  }

  function errorText(err) {
    return String((err && err.message) || err || '')
  }

  function classify(err) {
    const msg = errorText(err)
    if (/not permitted|not enabled|disabled|allow/i.test(msg))
      return 'acl'
    if (/No music job with id/i.test(msg))
      return 'expired'
    return 'offline'
  }

  function setBanner(text, tone) {
    if (!text) {
      banner.className = 'hidden'
      banner.innerHTML = ''
      return
    }
    const palette = tone === 'error'
      ? 'border-rose-400/40 bg-rose-500/10 text-rose-600 dark:text-rose-300'
      : tone === 'warn'
        ? 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
        : 'border-[#EAD9C7] dark:border-neutral-700 bg-black/5 dark:bg-white/5'
    banner.className = \`px-2.5 py-1.5 rounded-lg border text-[11px] \${palette}\`
    banner.textContent = text
  }

  function chime() {
    if (!s.chime)
      return
    try {
      const Ctor = (window ).AudioContext || (window ).webkitAudioContext
      if (!Ctor)
        return
      const actx = new Ctor()
      const start = actx.currentTime
      const notes = [880, 1174.66]
      notes.forEach((freq, i) => {
        const osc = actx.createOscillator()
        const gain = actx.createGain()
        const at = start + i * 0.13
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, at)
        gain.gain.exponentialRampToValueAtTime(0.11, at + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.34)
        osc.connect(gain)
        gain.connect(actx.destination)
        osc.start(at)
        osc.stop(at + 0.38)
      })
      setTimeout(() => {
        try {
          actx.close()
        }
        catch (e) {}
      }, 900)
    }
    catch (e) {
      // Autoplay/audio unavailable — the "new" badge still tells the story.
    }
  }

  // ---- polling -----------------------------------------------------------
  function schedulePoll(delay) {
    if (disposed)
      return
    if (pollTimer)
      clearTimeout(pollTimer)
    pollTimer = setTimeout(tick, delay)
  }

  function stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
  }

  /** Only ever runs while something is pending; stops itself when the oven empties. */
  function ensurePolling() {
    if (disposed || aclBlocked)
      return
    if (!pending().length) {
      stopPolling()
      return
    }
    if (pollTimer || inFlight)
      return
    schedulePoll(500)
  }

  async function tick() {
    pollTimer = null
    if (disposed || inFlight)
      return
    const jobs = pending().slice()
    if (!jobs.length)
      return

    inFlight = true
    let sawError = false
    try {
      for (const job of jobs) {
        const ok = await checkOne(job)
        if (!ok)
          sawError = true
        if (aclBlocked)
          break
      }
    }
    finally {
      inFlight = false
    }

    if (aclBlocked)
      return

    if (sawError) {
      backoffMs = Math.min(MAX_POLL_MS, Math.round(backoffMs * 1.5))
    }
    else {
      backoffMs = POLL_MS
      if (offline) {
        offline = false
        render()
      }
    }

    if (pending().length)
      schedulePoll(backoffMs)
  }

  /** Returns false when the check could not reach the server. */
  async function checkOne(job) {
    let res
    try {
      res = await callMusic('status', { jobId: job.jobId })
    }
    catch (err) {
      const kind = classify(err)
      if (kind === 'acl') {
        aclBlocked = true
        setBanner('Music Creation is disabled for this character — enable it in the card tools tab to track orders.', 'warn')
        return true
      }
      if (kind === 'expired') {
        // Server restarted: job records are in-memory and gone.
        moveToFinished(job, { status: 'expired', error: 'The server restarted before this finished.' })
        return true
      }
      if (!offline) {
        offline = true
        setBanner('Cannot reach the audio server — retrying quietly. Tracks already rendered stay in the library.', 'warn')
        render()
      }
      return false
    }

    if (!res)
      return true

    if (res.state === 'done' && res.track) {
      complete(job, res.track)
      return true
    }
    if (res.state === 'failed') {
      moveToFinished(job, { status: 'failed', error: res.error || 'Render failed.' })
      return true
    }
    if (res.state === 'cancelled') {
      moveToFinished(job, { status: 'cancelled', error: 'Cancelled.' })
      return true
    }
    return true
  }

  // ---- state transitions -------------------------------------------------
  function persist() {
    setState({
      pending: pending(),
      finished: finished().slice(0, SHELF_LIMIT),
      current: s.current,
      volume: s.volume,
      loops: s.loops,
      chime: s.chime,
    })
  }

  function complete(job, track) {
    const entry = {
      jobId: job.jobId,
      title: track.title || job.title || 'Untitled',
      audioUrl: track.audioUrl,
      durationMs: track.durationMs || 0,
      model: track.model || '',
      completedAt: Date.now(),
      status: 'ready',
      isNew: true,
    }
    s.pending = pending().filter(j => j.jobId !== job.jobId)
    s.finished = [entry, ...finished().filter(t => t.jobId !== entry.jobId)].slice(0, SHELF_LIMIT)
    persist()
    chime()
    render()
    if (pending().length)
      schedulePoll(POLL_MS)
  }

  function moveToFinished(job, patch) {
    const entry = {
      jobId: job.jobId,
      title: job.title || _optionalChain([job, 'access', _ => _.request, 'optionalAccess', _2 => _2.title]) || 'Untitled',
      audioUrl: '',
      durationMs: Math.round((job.durationSeconds || 60) * 1000),
      completedAt: Date.now(),
      status: patch.status,
      error: patch.error,
      request: job.request,
    }
    s.pending = pending().filter(j => j.jobId !== job.jobId)
    s.finished = [entry, ...finished().filter(t => t.jobId !== entry.jobId)].slice(0, SHELF_LIMIT)
    persist()
    render()
  }

  // ---- actions -----------------------------------------------------------
  async function cancelOrder(job) {
    try {
      await callMusic('cancel', { jobId: job.jobId })
    }
    catch (err) {
      // Cancelling a finished job is harmless; drop it from the oven either way.
    }
    s.pending = pending().filter(j => j.jobId !== job.jobId)
    persist()
    render()
    if (pending().length)
      ensurePolling()
  }

  async function reorder(track) {
    const request = track.request
    if (!request) {
      setBanner('This order has no stored brief — ask your character to re-order it.', 'warn')
      return
    }
    try {
      const receipt = await callMusic('generate', {
        prompt: request.prompt,
        lyrics: request.lyrics,
        title: request.title,
        durationSeconds: request.durationSeconds,
        cot: request.cot,
      })
      if (receipt && receipt.jobId) {
        s.pending = [...pending(), {
          jobId: receipt.jobId,
          title: request.title || track.title,
          requestedAt: Date.now(),
          durationSeconds: request.durationSeconds,
          request,
        }]
        s.finished = finished().filter(t => t.jobId !== track.jobId)
        persist()
        render()
        ensurePolling()
      }
    }
    catch (err) {
      setBanner(\`Could not re-order: \${errorText(err)}\`, 'error')
    }
  }

  async function backfill() {
    try {
      const res = await callMusic('list', { limit: SHELF_LIMIT })
      const remote = (res && res.tracks) || []
      const byId = new Map()
      for (const track of finished())
        byId.set(track.jobId, track)
      for (const track of remote) {
        if (!track || !track.id)
          continue
        if (byId.has(track.id))
          continue
        byId.set(track.id, {
          jobId: track.id,
          title: track.title || 'Untitled',
          audioUrl: track.audioUrl,
          durationMs: track.durationMs || 0,
          model: track.model || '',
          completedAt: track.createdAt ? Date.parse(track.createdAt) || 0 : 0,
          status: 'ready',
        })
      }
      const merged = [...byId.values()].sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      s.finished = merged.slice(0, SHELF_LIMIT)
      persist()
      render()
    }
    catch (err) {
      const kind = classify(err)
      if (kind === 'acl')
        setBanner('Music Creation is disabled for this character — enable it in the card tools tab.', 'warn')
      else if (!pending().length)
        setBanner('Library unavailable — the audio server is not answering.', 'warn')
    }
  }

  function load(track) {
    if (!track || !track.audioUrl)
      return
    s.current = { url: track.audioUrl, title: track.title }
    track.isNew = false
    audio.src = track.audioUrl
    audio.loop = !!s.loops
    npTitle.textContent = track.title
    npMeta.textContent = [track.model, track.durationMs ? fmtClock(track.durationMs) : ''].filter(Boolean).join(' · ')
    npSource.innerHTML = \`source: <a href="\${esc(safeUrl(track.audioUrl))}" target="_blank" rel="noopener" class="underline opacity-80">open in browser ↗</a>\`
    persist()
    render()
    void audio.play().catch(() => {})
  }

  // ---- render ------------------------------------------------------------
  function renderOven() {
    oven.innerHTML = ''
    const jobs = pending()
    if (!jobs.length) {
      oven.appendChild(el('div', 'text-[11px] opacity-50 px-1', 'oven empty — ask your character for a tune'))
      return
    }
    oven.appendChild(el('div', 'text-[10px] uppercase tracking-wider opacity-60 px-1', \`in the oven · \${jobs.length}\`))
    for (const job of jobs) {
      const requestedAt = job.requestedAt || Date.now()
      const elapsed = Date.now() - requestedAt
      const expected = (job.durationSeconds || 60) * 1000 * REALTIME_FACTOR
      const remaining = expected - elapsed
      const late = elapsed > expected * 1.5
      const row = el('div', 'flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[#EAD9C7] dark:border-neutral-700 bg-[#FFFDF8] dark:bg-[#1b1b1b]')
      row.innerHTML = \`
        <span class="shrink-0 animate-pulse">◌</span>
        <span class="min-w-0 flex-1 truncate text-[12px]">\${esc(job.title || job.jobId)}</span>
        <span class="shrink-0 text-[10px] tabular-nums opacity-60">\${fmtClock(elapsed)}</span>
        <span class="shrink-0 text-[10px] \${late ? 'text-amber-600 dark:text-amber-400' : 'opacity-60'}">\${late ? 'slower than usual' : fmtEta(remaining)}</span>
      \`
      const cancelBtn = el('button', 'shrink-0 px-1 rounded border border-[#EAD9C7] dark:border-neutral-700 text-[10px]', '✕')
      cancelBtn.title = 'Cancel this order'
      cancelBtn.onclick = () => void cancelOrder(job)
      row.appendChild(cancelBtn)
      oven.appendChild(row)
    }
  }

  function renderLibrary() {
    library.innerHTML = ''
    const tracks = finished()
    if (!tracks.length) {
      library.appendChild(el('div', 'text-[11px] opacity-50 px-1', 'library empty — rendered tracks land here'))
      return
    }
    library.appendChild(el('div', 'text-[10px] uppercase tracking-wider opacity-60 px-1', 'library'))

    // Repeated titles are common when a character re-orders the same brief; tag
    // duplicates with the tail of their job slug so the shelf stays scannable.
    const counts = new Map()
    for (const track of tracks)
      counts.set(track.title, (counts.get(track.title) || 0) + 1)

    for (const track of tracks) {
      const duplicated = (counts.get(track.title) || 0) > 1
      const label = duplicated ? \`\${track.title} · \${slugTail(track.jobId)}\` : track.title
      const row = el('div', 'flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[#EAD9C7] dark:border-neutral-700')
      const icon = track.status === 'ready' ? '♫' : track.status === 'expired' ? '⌛' : '⚠'
      row.innerHTML = \`
        <span class="shrink-0 opacity-70">\${icon}</span>
        <span class="min-w-0 flex-1 truncate text-[12px] \${track.isNew ? 'font-bold' : ''}">\${esc(label)}</span>
        \${track.isNew ? '<span class="shrink-0 rounded px-1 text-[9px] bg-[#E8B78E]/30">new</span>' : ''}
        <span class="shrink-0 text-[10px] tabular-nums opacity-60">\${track.durationMs ? fmtClock(track.durationMs) : ''}</span>
      \`
      if (track.status === 'ready') {
        const play = el('button', 'shrink-0 px-1.5 rounded bg-[#E8B78E] dark:bg-[#B98D6E] text-[#3b2415] text-[10px] font-bold', '▶')
        play.onclick = () => load(track)
        row.appendChild(play)
      }
      else {
        if (track.request) {
          const again = el('button', 'shrink-0 px-1 rounded border border-[#EAD9C7] dark:border-neutral-700 text-[10px]', '↻')
          again.title = 'Order this again'
          again.onclick = () => void reorder(track)
          row.appendChild(again)
        }
        if (track.error)
          row.title = track.error
      }
      library.appendChild(row)
    }
  }

  function renderPlayer() {
    const hasTrack = !!s.current.url
    npTitle.textContent = s.current.title || 'nothing loaded yet'
    if (!hasTrack)
      npMeta.textContent = ''
    playBtn.textContent = audio.paused ? '▶ play' : '⏸ pause'
    loopBtn.className = \`px-1.5 py-0.5 rounded border text-[10px] \${audio.loop
      ? 'bg-[#E8B78E] dark:bg-[#B98D6E] text-[#3b2415] border-transparent'
      : 'border-[#EAD9C7] dark:border-neutral-700'}\`
    vol.value = String(Math.round((audio.volume || 0) * 100))
    chimeBtn.textContent = s.chime ? '🔔 chime' : '🔕 chime'
    foot.textContent = KAO[Math.min(KAO.length - 1, finished().length % KAO.length)]
  }

  function render() {
    renderPlayer()
    renderOven()
    renderLibrary()
  }

  // ---- wiring ------------------------------------------------------------
  playBtn.onclick = () => {
    if (!s.current.url)
      return
    if (audio.paused)
      void audio.play().catch(() => {})
    else
      audio.pause()
  }

  seek.oninput = () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
    if (!duration)
      return
    audio.currentTime = (Number(seek.value) / 1000) * duration
  }

  vol.oninput = () => {
    const next = Number(vol.value) / 100
    audio.volume = next
    s.volume = next
    setState({ volume: next })
  }

  loopBtn.onclick = () => {
    audio.loop = !audio.loop
    s.loops = audio.loop ? 1 : 0
    setState({ loops: s.loops })
    renderPlayer()
  }

  chimeBtn.onclick = () => {
    s.chime = !s.chime
    setState({ chime: s.chime })
    if (s.chime)
      chime()
    renderPlayer()
  }

  refreshBtn.onclick = () => {
    void backfill()
    ensurePolling()
  }

  audio.addEventListener('timeupdate', () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
    const cur = audio.currentTime || 0
    npTime.textContent = \`\${fmtClock(cur * 1000)} / \${duration ? fmtClock(duration * 1000) : '0:00'}\`
    if (duration)
      seek.value = String(Math.round((cur / duration) * 1000))
  })
  audio.addEventListener('play', () => renderPlayer())
  audio.addEventListener('pause', () => renderPlayer())
  audio.addEventListener('ended', () => renderPlayer())
  audio.addEventListener('loadedmetadata', () => {
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0
    if (duration)
      npTime.textContent = \`\${fmtClock((audio.currentTime || 0) * 1000)} / \${fmtClock(duration * 1000)}\`
  })

  const onVisible = () => {
    if (!document.hidden) {
      // Background windows clamp timers; catch up as soon as we are seen again.
      if (pending().length)
        ensurePolling()
      render()
    }
  }
  document.addEventListener('visibilitychange', onVisible)

  // Refresh the ETA/elapsed labels even while a poll is pending.
  const ticker = setInterval(() => {
    if (!disposed && pending().length)
      renderOven()
  }, 5000)

  const unsub = typeof onStateChange === 'function'
    ? onStateChange((next) => {
        if (disposed || !next)
          return
        s.pending = Array.isArray(next.pending) ? next.pending : []
        s.finished = Array.isArray(next.finished) ? next.finished : []
        if (next.current)
          s.current = next.current
        if (typeof next.chime === 'boolean')
          s.chime = next.chime
        if (typeof next.loops === 'number')
          s.loops = next.loops
        render()
        if (pending().length)
          ensurePolling()
      })
    : null

  // ---- boot --------------------------------------------------------------
  if (s.current.url) {
    audio.src = s.current.url
    npSource.innerHTML = \`source: <a href="\${esc(safeUrl(s.current.url))}" target="_blank" rel="noopener" class="underline opacity-80">open in browser ↗</a>\`
    npMeta.textContent = s.current.title || ''
  }

  render()
  void backfill()
  ensurePolling()

  return () => {
    disposed = true
    stopPolling()
    clearInterval(ticker)
    document.removeEventListener('visibilitychange', onVisible)
    audio.pause()
    audio.src = ''
    if (unsub)
      unsub()
    container.innerHTML = ''
  }
}
`,
  exportedAt: 1792817481348,
}
