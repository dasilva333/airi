# Ming 3.0 browser-TTS RTF analysis

## Bottom line

**Threading is the only source-backed multi-fold implementation gap. No second multi-fold cause is visible in the current worker, loader, adapter, request, preset, or runtime artifacts.**

There is also a benchmark-comparison problem:

- AIRI warm quality vs demo quality: `7.41 / 1.70 = 4.36×`; Run 1 gives `4.39×`.
- AIRI quality vs demo fast: `7.47 / 0.85 = 8.79×`, but that compares different presets and is not a valid like-for-like gap.
- Upstream’s measured 1-thread → 8-thread speedup is `2.15 / 0.47 = 4.57×`.

Therefore, **if the demo’s 1.7 quality run used 8 threads**, upstream scaling projects:

```text
AIRI threaded RTF ≈ 7.47 / 4.57 = 1.63
```

That is essentially the demo’s 1.7. For the measured 3.198-second clip, it corresponds to roughly **5.2 seconds generation**, versus 23.89 seconds now.

This is a strong projection, not yet a controlled proof: the historical demo footer’s actual build/thread count was not supplied. The design doc’s separate **3-thread quality RTF 1.02** run is another configuration; comparing AIRI 1-thread against that produces 7.32× but does not establish a residual either.

## What is already aligned

| Area | Finding |
|---|---|
| Runtime build selection | AIRI’s `chooseBuild()` matches the reference ordering and relaxed-SIMD probe. The reported `web-single-relaxed · 1` is the fastest available non-isolated build. |
| Runtime bytes | The live demo and AIRI’s CDN URL serve byte-identical `web-single-relaxed` WASM: SHA-256 `6c448ff9…`, 3,003,190 bytes, commit `bdf46b4`. The local clone’s WASM is only a 132-byte Git LFS pointer, explaining the initial hash discrepancy. |
| Model/profile | Both use `fusorlabs/ming-3.0-tts-0.5b-web`, the `mix` bundle. |
| Generate request | Both send `{ text, voice: { builtin } \| { design }, preset }`. There is no demo-only `task`, `instruction`, normalization, sampling, or attention-backend field. |
| Optional runtime fields | The Rust request also accepts `seed`, `language`, and `max_frames`; neither page sends them. Default seed is 1895 in both. |
| Presets | AIRI forwards the selected preset unchanged. Rust confirms `quality` = 10 steps/CFG on all 10, `balanced` = 10 steps/CFG on 5, `fast` = 7 steps/CFG on 3. |
| Timed frame loop | Both perform `rt.step()` → `rt.take_audio()` → transferable PCM → frame message → `setTimeout(0)`. See AIRI `workers/ming3/worker.ts:86-109` versus reference `engine/worker.js:61-80`. |
| RTF metric | Both use worker generation time divided by accumulated PCM duration at 44.1 kHz. Frames are 80 ms, with silence trimming making exact duration slightly less than `frames × 0.08`. WAV assembly is outside the worker timestamp. |

Evidence: `libs/inference/adapters/ming3.ts:198-223,337-396`, upstream `app/web/app.js` `generate()`/`finish()`, `models/ming/model/src/session.rs` `Request`/`Engine::step()`, and `models/ming/model/src/preset.rs`.

## Contributors, ordered by expected RTF impact

### 1. Missing threaded-relaxed execution — expected ~4.6×

This is the dominant confirmed gap.

The reference enables isolation through COOP/COEP and normally selects `web-threaded-relaxed`. Its default thread count is up to `min(8, cores - 2)`; on this 10-core M4 that means 8 if the browser exposes all cores and no `?threads=` override is present.

AIRI currently runs `web-single-relaxed · 1`. Upstream measured:

- `web-single-relaxed`, 1 thread, quality: **RTF 2.15**
- `web-threaded-relaxed`, 8 threads, quality: **RTF 0.47**
- Difference: **4.57×**

Relaxation also matters: plain `web-threaded` was 1.6× slower than `web-threaded-relaxed`; switching to non-relaxed or `web-single` would move in the wrong direction.

### 2. Preset/configuration mismatch — up to 2× apparent gap, but not a quality-parity fix

The quoted 8.8× result compares AIRI `quality` against demo `fast`. That mixes two sampler schedules.

The historical inputs also differ:

- Reference benchmarks use US_James and S1–S3, generally 5–7 seconds.
- AIRI’s default playground text is the shorter “Welcome back…” text, and its first built-in voice is US_Emma.
- The design doc’s 1.02 result was explicitly a separate 3-thread run.

These differences prevent precise attribution. `fast` should be benchmarked only after quality parity, and its known word-drop/garbling risk remains.

### 3. Possible residual single-thread slowdown — unresolved, not proven

AIRI’s 7.41 versus upstream’s 2.15 single-thread RTF is a 3.45× difference, but those numbers come from:

- Apple M4 versus Apple M4 Pro
- Different utterances and durations
- Different browser/process conditions
- Different run dates and system load

No code difference inspected explains that residual. The required experiment is a **forced-single demo run in the same browser**, described below.

### 4. AIRI’s extra wrapper overhead — negligible; not a credible multi-fold cause

AIRI adds one unnecessary adapter-side PCM copy:

```ts
const samples = new Float32Array(data.samples)
```

That is approximately 14 KiB per full 80-ms frame, or about 0.6 MB over the measured run. It is worth simplifying eventually, but cannot credibly account for 17 extra seconds.

Other proposed overhead explanations do not hold:

- `JSON.parse(rt.step())` exists in both implementations.
- Both send audio and frame messages per step.
- AIRI’s frame handler only increments a plain counter; the reference additionally updates its Rust/UI state and playback scheduling.
- PCM concatenation and WAV encoding happen after the worker’s final `done.ms` timestamp.
- Blob glue import affects loading, not per-frame WASM execution.

**Do not prioritize overhead removal as the RTF fix.**

## Required threaded remediation

Adding headers alone is insufficient. Three blockers must be fixed together.

### 1. Enable cross-origin isolation on the top-level application document

Required response headers:

```text
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Relevant surfaces:

- `apps/stage-web/vite.config.ts`: development and preview servers.
- `apps/stage-web/public/_headers`: currently contains only asset caching rules; add document-wide headers for hosts that honor this file.
- Docker/Nginx: configure Nginx explicitly; `_headers` is not an Nginx configuration mechanism.
- Electron development: headers can be added to the HTTP renderer server.
- Packaged Electron currently loads `file://` through `loadFile()`. HTTP headers cannot simply be injected into that navigation; use a privileged application scheme serving renderer responses with these headers, or an equivalent HTTP-served renderer approach.

Verify `crossOriginIsolated === true` and `SharedArrayBuffer` availability **inside the Ming engine worker**, and audit cross-origin application resources for COEP compatibility.

### 2. Fix threaded module loading and URL lifetime

The current Blob loader works for the self-contained single-thread glue, but not the threaded module graph:

- `web-threaded-relaxed/ming_runtime.js:1` imports `./snippets/.../workerHelpers.no-bundler.js`.
- `workerHelpers` imports `./protocol.js`.
- Compute workers later execute `import(data.mainJS)`.
- AIRI currently revokes the glue Blob URL immediately after import, before `initThreadPool()`.

Two viable approaches:

1. **Preferred when server routing is available:** proxy the runtime `engine/dist` tree through a same-origin endpoint with correct JavaScript/WASM MIME types. This preserves relative imports and stable `import.meta.url` values without vendoring the runtime.
2. **Client-only:** construct a Blob module graph, rewrite relative imports to retained Blob URLs, and keep every glue/helper URL alive for the entire engine/compute-pool lifetime.

Simply retaining the current single glue Blob URL is not enough.

### 3. Wire the page-side compute pool and its `MessagePort` protocol

Reference `workerHelpers.startWorkers()` sends:

```text
fusor-ai-spawn-compute
```

and waits for the page to create `count` module workers, initialize them with the supplied `module`, `memory`, `receiver`, and `mainJS`, then answer through `port`.

AIRI’s adapter currently ignores that message. Consequently, threaded initialization can wait indefinitely rather than reliably reaching the loader’s fallback.

Port the reference `ComputePool` behavior into the adapter/host:

- Handle `fusor-ai-spawn-compute`.
- Spawn workers from the supplied `url`.
- Send `fusor-ai-rayon-init` with the supplied module/shared memory state.
- Wait for all `fusor-ai-rayon-ready` messages.
- Reply `{ ready: true }`, or `{ ready: false, error }` after failure.
- Terminate the entire pool on reload, engine failure, compute-thread crash, and adapter termination.

Only then does `startRuntime()`’s single-thread fallback have a real error to catch.

### 4. Select and verify actual threads

After wiring, the current explicit `1` setting will still force single-thread execution. Test `auto`, 3, 4, and 8.

Diagnostics should show:

```text
web-threaded-relaxed
threads > 1   // from rt.threads(), not merely the requested value
```

On this base M4, benchmark 3/4 threads as well as auto/8. The design doc’s 3-thread RTF 1.02 result is evidence that blindly assuming 8 is optimal on asymmetric performance/efficiency cores would be premature.

## The decisive control experiment

Before attributing any remaining slowdown to AIRI:

1. In the demo, use:

   ```text
   ?threads=1&build=web-single-relaxed
   ```

2. Select **US_James**, **quality**, and exactly the same sentence in both pages. The existing “Evening wind” AIRI sample matches upstream S2.
3. Keep both pages visible, avoid simultaneous inference, and record at least three warm runs.
4. Record actual build, actual threads, frames, audio seconds, generation time, first PCM, and RTF.
5. Separately reproduce the demo’s auto/3-thread configurations to determine which configuration produced 1.7 and 1.02.

Interpretation:

- If forced-single demo RTF approaches AIRI’s 7.4, there is no hidden integration slowdown.
- If the demo remains near 2 while AIRI remains near 7.4 under the same conditions, a real residual exists.

For that second case, instrument accumulated time around `rt.start()`, `rt.step()`, `take_audio()`, `postMessage()`, and the macrotask yield:

- Similar `step()` time but larger frame-period time → scheduling/throttling.
- Larger `step()` time itself → CPU contention or runtime/browser execution conditions, not adapter message overhead.

## Secondary issues worth fixing, but not causes of this RTF

- **First-audio metrics are not identical.** AIRI measures from before `postMessage(generate)` to the main-thread audio handler; the demo reports worker `frame.ms`, whose timer starts after `rt.start()`. Use a worker-stamped first-PCM value for exact comparisons. Both generation timers do include prefill because prefill occurs in the first `step()`.
- **Auto-thread fallback can reload before every provider synthesis.** `doLoadModel()` compares requested threads with `lastLoadParams`, but successful load stores actual runtime threads. Thus requested auto/8 with actual fallback 1 never matches (`adapters/ming3.ts:248-284`), and the registry calls `loadModel()` before every generation (`registry/speech.ts:929-938`). This adds model reload latency, though it does not inflate the reported worker `generationMs` or the explicit-1-thread settings measurement.
- The demo’s “first audio” is first available PCM, not necessarily audible streaming. Its player only starts early when generation exceeds 1.1× real time with at least one second buffered; at quality RTF 1.7 it waits until completion, like AIRI’s playground.

## Expected outcome

The defensible target is:

1. Wire `web-threaded-relaxed` correctly.
2. Validate preset-matched quality RTF against the same demo configuration.
3. Expect approximately **4.6× improvement** if upstream scaling transfers—**7.47 → ~1.63**, close to the cited 1.7.
4. Then tune 3/4/8 threads and benchmark `fast` independently rather than deriving a guaranteed 0.85 from a different run.

No source evidence currently justifies chasing request-shape changes, preset remapping, alternate attention options, OPFS changes, WAV changes, or JSON/transfer optimizations as the main fix.

---

I made no file edits, commits, builds, or test runs. The final `git status --short` changed concurrently during this read-only session and currently reports:

```text
 M .agents/skills/airi-local-inference-engines/SKILL.md
 M .agents/skills/airi-onboarding-v3/SKILL.md
 M docs/project-specialized-skills.md
 M docs/rosetta-stone.md
 M packages/stage-pages/src/pages/settings/providers/speech/ming3-local.vue
 M packages/stage-ui/src/libs/inference/adapters/ming3.ts
 M packages/stage-ui/src/workers/ming3/loader.ts
?? .agents/skills/airi-local-tts-engines/
```

The initial status contained a different set, including V-HACK files that no longer appear. I left all concurrent/pre-existing changes untouched.
