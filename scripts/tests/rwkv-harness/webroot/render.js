/**
 * Phase 7 canvas render harness (page side).
 *
 * Runs one generated p5.js / p5.brush sketch inside a same-origin iframe
 * (isolated per sketch), waits until the painting settles, then captures a
 * PNG + deterministic pixel stats (ink coverage, color diversity). Only the
 * small base64 PNG and scalars cross the CDP bridge back to Node.
 *
 * WebGL capture: a getContext() monkeypatch forces preserveDrawingBuffer on
 * WEBGL contexts (p5.brush requires WEBGL), and a redraw()+drawImage ladder
 * covers cases where the attribute did not stick.
 */

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/** Ink/color analysis: draw the sketch canvas into a 2D canvas and sample it. */
function captureAndAnalyze(srcCanvas, size) {
  const c2 = document.createElement('canvas')
  c2.width = size
  c2.height = size
  const ctx = c2.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(srcCanvas, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  // Quantized histogram (12-bit buckets) over sampled pixels — noise-tolerant.
  const buckets = new Map() // key -> { count, r, g, b }
  let sampled = 0
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const i = (y * size + x) * 4
      const r = data[i]; const g = data[i + 1]; const b = data[i + 2]
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const e = buckets.get(key)
      if (e) { e.count++; e.r += r; e.g += g; e.b += b }
      else {
        buckets.set(key, { count: 1, r, g, b })
      }
      sampled++
    }
  }

  // Background = MODAL bucket (the dominant region), NOT a corner average.
  // Corner averaging fabricates a mid-tone reference when the artwork paints
  // dark washes near some corners and paper near others; soft watercolor
  // pixels then cluster near that fake midpoint and fail the delta threshold,
  // falsely scoring a painted canvas as blank (user-identified, 2026-08-24).
  let mode = null
  for (const e of buckets.values()) {
    if (!mode || e.count > mode.count)
      mode = e
  }
  const bg = [mode.r / mode.count, mode.g / mode.count, mode.b / mode.count]

  // Ink = samples deviating from the modal color; structure = 1 - modal
  // frequency (0.0 = perfectly uniform canvas regardless of color).
  let ink = 0
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const i = (y * size + x) * 4
      if (Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > 42)
        ink++
    }
  }

  return {
    dataUrl: c2.toDataURL('image/png'),
    inkCoverage: sampled ? ink / sampled : 0,
    uniqueColors: buckets.size,
    structureScore: sampled ? 1 - mode.count / sampled : 0,
  }
}

window.__renderReady = false

/**
 * Render one sketch. Returns metrics + base64 PNG (null on total failure).
 * `settleMs`: grace window after canvas appearance (noLoop paintings finish in
 * setup(); looping sketches paint into this window); `timeoutMs`: hard cap.
 * `frames`: reserved for a future per-frame budget (currently unused).
 */
window.__renderSketch = async ({ code, size = 600, frames = 150, settleMs = 2000, timeoutMs = 30000 }) => {
  const t0 = Date.now()
  const outcome = {
    ok: false,
    blank: true,
    error: null,
    sketchError: null,
    framesRendered: 0,
    inkCoverage: 0,
    structureScore: 0,
    uniqueColors: 0,
    captureStrategy: 'none',
    brushLoaded: false,
    ms: 0,
    dataUrl: null,
  }

  const frame = document.createElement('iframe')
  frame.style.cssText = `position:fixed;left:0;top:0;width:${size + 20}px;height:${size + 20}px;border:1px solid #888;background:#fff;`
  document.body.appendChild(frame)

  try {
    const win = frame.contentWindow
    const doc = frame.contentDocument
    // Generated code must not be able to terminate our injected script block.
    const safeCode = String(code).replace(/<\/script/gi, '<\\/script')

    doc.open()
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0}canvas{display:block}</style></head><body>
<script>
// Force deterministic WebGL canvas capture for p5.brush WEBGL sketches.
(function () {
  var orig = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, attrs) {
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
      attrs = Object.assign({}, attrs || {}, { preserveDrawingBuffer: true });
    }
    return orig.call(this, type, attrs);
  };
})();
window.__sketchError = null;
window.onerror = function (m) { if (!window.__sketchError) window.__sketchError = String(m); return true; };
</script>
<script src="/vendor/p5/p5.min.js"></script>
<script src="/vendor/p5/p5.brush.min.js"></script>
<script>
try {
${safeCode}
} catch (e) { window.__sketchError = String((e && e.stack) || e); }
</script>
</body></html>`)
    doc.close()

    // Wait for the sketch to run: a canvas appears (setup executed) or the
    // sketch errors out before creating one.
    const deadline = Date.now() + timeoutMs
    let sawCanvas = null
    while (Date.now() < deadline) {
      await sleep(100)
      sawCanvas = doc.querySelector('canvas')
      if (sawCanvas)
        break
      if (win.__sketchError)
        break
    }

    // Settle grace: noLoop() paintings finish inside setup(), so a short grace
    // after canvas appearance suffices; looping sketches paint into the grace
    // window. Bounded by what the timeout budget still allows.
    const grace = Math.max(500, Math.min(settleMs, deadline - Date.now() - 500))
    await sleep(Math.max(0, grace))

    outcome.brushLoaded = typeof win.brush !== 'undefined'
    outcome.framesRendered = Number(win.frameCount ?? 0)

    const canvas = doc.querySelector('canvas')
    if (!canvas) {
      outcome.error = win.__sketchError ? `sketch error before canvas: ${win.__sketchError}` : 'no canvas created (missing setup/createCanvas?)'
    }
    else {
      outcome.sketchError = win.__sketchError ? String(win.__sketchError).slice(0, 500) : null

      const first = captureAndAnalyze(canvas, size)
      outcome.inkCoverage = first.inkCoverage
      outcome.structureScore = first.structureScore
      outcome.uniqueColors = first.uniqueColors
      outcome.dataUrl = first.dataUrl
      outcome.captureStrategy = 'toDataURL'

      if (first.inkCoverage <= 0.005 && typeof win.redraw === 'function') {
        // Buffer may have been composited away — force one draw and re-capture
        // synchronously in this task.
        try { win.redraw() }
        catch { /* non-fatal */ }
        const second = captureAndAnalyze(canvas, size)
        if (second.inkCoverage > outcome.inkCoverage) {
          outcome.inkCoverage = second.inkCoverage
          outcome.structureScore = second.structureScore
          outcome.uniqueColors = second.uniqueColors
          outcome.dataUrl = second.dataUrl
          outcome.captureStrategy = 'redraw+drawImage'
        }
      }
      // Blank = no ink AND no spatial structure. A full-bleed wash scores low
      // ink but nonzero structure; only a truly uniform canvas is blank.
      outcome.blank = outcome.inkCoverage <= 0.005 && outcome.structureScore <= 0.02
      outcome.ok = !outcome.blank
      if (outcome.blank && !outcome.error)
        outcome.error = outcome.sketchError || 'canvas rendered but appears blank'
    }
  }
  catch (e) {
    outcome.error = String((e && e.stack) || e).slice(0, 500)
  }
  finally {
    outcome.ms = Date.now() - t0
    frame.remove()
  }
  return outcome
}

window.__renderReady = true
