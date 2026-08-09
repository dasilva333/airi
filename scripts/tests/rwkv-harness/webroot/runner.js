/**
 * Persistent WebGPU RWKV inference engine for the cleanroom harness.
 *
 * Loads the base safetensors model, builds a real `Session` via production
 * safetensors/format/stop logic, then exposes `window.__rwkvGenerate(opts)` so
 * the Node driver can run many prompts against one warm session (no reload).
 *
 * Fidelity: the load + sampler loop mirror production
 * `packages/stage-ui/src/workers/web-rwkv/worker.ts`; prompt construction uses
 * production `buildRwkvPrompt` (RWKV-7 G1 `Assistant: <think></think` prefill)
 * and output passes through production `createThinkPrefixStripper`.
 *
 * One-shot vs. production `buildReader` differences (acceptable for a local-file
 * harness, NOT for HF fetching): single whole-file Range fetch from the local
 * static server, no retry/backoff, no OPFS cache, no HF-redirect resolution.
 */

const MODEL_URL = '/models/model.safetensors'
const VOCAB_URL = '/rwkv_vocab_v20230424.json'

let __engine = null

async function fetchRange(url, start, end) {
  const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, cache: 'no-store' })
  if (res.status !== 206 && res.status !== 200)
    throw new Error(`range ${start}-${end} -> HTTP ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

async function boot() {
  const ST = await import('/vendor/stage-ui-web-rwkv/safetensors.js')
  const STOP = await import('/vendor/stage-ui-web-rwkv/stop.js')
  const FMT = await import('/vendor/stage-ui-web-rwkv/format.js')
  const wasm = await import('/vendor/web-rwkv-wasm/web_rwkv_wasm.js')
  await wasm.default({ module_or_path: '/vendor/web-rwkv-wasm/web_rwkv_wasm_bg.wasm' })
  const { Session, SessionType, Tensor, TensorReader, Tokenizer, NucleusSampler } = wasm

  const probe = await fetch(MODEL_URL, { headers: { Range: 'bytes=0-7' }, cache: 'no-store' })
  const head8 = new Uint8Array(await probe.arrayBuffer())
  const headerLen = Number(new DataView(head8.buffer, head8.byteOffset, head8.byteLength).getBigUint64(0, true))
  const headBytes = await fetchRange(MODEL_URL, 0, 8 + headerLen - 1)
  const { tensors, dataStart } = ST.readSafetensorsHeader(headBytes)
  const names = Object.keys(tensors)
  const numEmb = tensors['emb.weight']?.shape[1] ?? Number.NaN
  const dataEnd = Math.max(...names.map(n => tensors[n].data_offsets[1]))
  const fileBytes = await fetchRange(MODEL_URL, dataStart, dataStart + dataEnd - 1)

  const built = []
  for (const nm of names) {
    const info = tensors[nm]
    const [s, e] = info.data_offsets
    const raw = fileBytes.subarray(s, e)
    const f16 = ST.toF16Bytes(raw, info.dtype)
    const o = ST.orientAdapterMatrix(nm, f16, info.shape, numEmb)
    built.push(new Tensor(nm, Uint32Array.from(o.shape), o.data.buffer.slice(o.data.byteOffset, o.data.byteOffset + o.data.byteLength)))
  }
  const reader = new TensorReader(built)
  const session = await Session.from_reader(reader, 0, 0, 0, SessionType.Chat)
  const vocab = await (await fetch(VOCAB_URL)).text()
  const tokenizer = new Tokenizer(vocab)
  const info = session.info()

  __engine = { ST, STOP, FMT, session, tokenizer, info, numEmb, numTensors: built.length }

  /**
   * Shared sampler loop over an already-built prompt string. Returns raw text.
   *
   * Grammar constraint (opts.constrainEnum): { key: '"type"', values: ['mood','flavor','journal_candidate'] }.
   * A string-prefix DFA detects when emitted text reaches a `"<key>": "` value slot and
   * masks sampling to only tokens that keep at least one enum value a live prefix.
   * Multi-token enum strings are handled by the prefix check (not a single forced ID).
   * Report labels constrained runs distinctly: type-agreement under constraint is not
   * the model's unconstrained capability.
   */
  async function runSampler(prompt, opts, stopSeqs) {
    const { session, tokenizer, info, STOP } = __engine
    session.load(new Float32Array(session.state_len())) // stateless per request
    const sampler = new NucleusSampler(
      info,
      opts.temperature ?? 0.7,
      opts.topP ?? 0.9,
      opts.presencePenalty ?? 0.0,
      opts.countPenalty ?? 0.0,
      opts.penaltyDecay ?? 0.996,
    )
    const enc = new TextEncoder()

    // --- Grammar constraint setup ---
    const constraint = opts.constrainEnum || null
    let enumDefs = null // [{str, toks:number[]}]
    let triggerRe = null
    let keyStr = null
    if (constraint) {
      enumDefs = constraint.values.map(v => ({ str: v, toks: Array.from(tokenizer.encode(enc.encode(v))) }))
      keyStr = constraint.key
      const k = constraint.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      triggerRe = new RegExp(`${k}\\s*:\\s*"?$`)
    }

    const output = new Float32Array(info.num_vocab)
    const probs = new Float32Array(info.num_vocab)
    const promptTokens = tokenizer.encode(enc.encode(prompt)).length
    let tokens = tokenizer.encode(enc.encode(prompt))
    const decoder = new TextDecoder()
    const stopScanner = STOP.createStopScanner(stopSeqs)
    const maxTokens = opts.maxTokens ?? 512
    let raw = ''

    // DFA state for the value slot.
    let inSlot = false
    let slotText = '' // text emitted inside the current enum value slot (after the trigger)

    for (let i = 0; i < maxTokens; i++) {
      if (tokens.length > 0)
        await session.run(tokens, output)
      sampler.transform(output)
      await session.softmax(output, probs)

      // Determine allowed next tokens under the constraint.
      let allowed = null
      if (constraint) {
        if (!inSlot && triggerRe.test(raw)) { inSlot = true; slotText = '' }
        if (inSlot) {
          // Live enums = those whose full string still starts with what we've emitted in the slot.
          const live = enumDefs.filter(e => e.str !== slotText && e.str.startsWith(slotText))
          const completed = enumDefs.some(e => e.str === slotText)
          if (completed || live.length === 0) {
            // Slot value is a complete enum (or no longer constrainable); free sampling resumes.
            inSlot = false
            slotText = ''
          }
          else {
            // For each live enum, the next allowed token is the first token whose decoded
            // form extends slotText. Walk its token list, decoding cumulatively, to find it.
            allowed = new Set()
            for (const e of live) {
              let acc = ''
              for (const tid of e.toks) {
                const piece = new TextDecoder().decode(tokenizer.decode(Uint32Array.of([tid])))
                const next = acc + piece
                if (slotText.startsWith(next)) { acc = next; continue } // token fully consumed
                if (next.startsWith(slotText)) { allowed.add(tid); break } // this token advances slot
                break
              }
            }
            if (allowed.size === 0) { inSlot = false; slotText = ''; allowed = null }
          }
        }
      }

      // Sample (masked to `allowed` if active).
      let token
      if (allowed && allowed.size > 0) {
        let sum = 0
        for (const t of allowed) sum += probs[t]
        if (sum <= 0) {
          let best = -1; let bestP = -1
          for (const t of allowed) { if (probs[t] > bestP) { bestP = probs[t]; best = t } }
          token = best
        }
        else {
          let r = Math.random() * sum
          token = -1
          for (const t of allowed) { r -= probs[t]; if (r <= 0) { token = t; break } }
          if (token === -1)
            token = [...allowed][0]
        }
      }
      else {
        token = sampler.sample(probs)
      }
      if (token === 0)
        break

      sampler.update(Uint32Array.of(token))
      tokens = Uint32Array.of(token)
      const dec = decoder.decode(tokenizer.decode(tokens), { stream: true })
      if (dec) {
        const t = stopScanner.push(dec)
        if (t) {
          raw += t
          if (inSlot)
            slotText += t
        }
        if (stopScanner.stopped)
          break
      }
    }
    return { raw, promptTokens }
  }

  /**
   * Chat-shaped generation (production path): buildRwkvPrompt + G1 prefill +
   * think-prefix stripping, role-marker stops.
   */
  window.__rwkvGenerate = async (opts) => {
    const { FMT } = __engine
    const messages = []
    if (opts.system)
      messages.push({ role: 'system', content: opts.system })
    messages.push({ role: 'user', content: opts.prompt })
    const prompt = FMT.buildRwkvPrompt(messages, { enableG1Prefill: opts.g1Prefill !== false })
    const { raw, promptTokens } = await runSampler(prompt, opts, [
      '\n\nUser:',
      '\nUser:',
      '\n\nSystem:',
      '\nSystem:',
      '\n\nAssistant:',
      '\nAssistant:',
    ])
    const stripper = FMT.createThinkPrefixStripper()
    const text = stripper(raw)
    const completionTokens = (await __engine.tokenizer.encode(new TextEncoder().encode(raw))).length
    return { text, raw, promptTokens, completionTokens }
  }

  /**
   * Lever A: completion-mode generation. The prompt ALREADY ends with an exact
   * structural scaffold (e.g. `...Output:\n{"pills":[{"content":"`); the model is
   * fed that verbatim and only generates the continuation. We do NOT prepend the
   * scaffold again server-side (the caller composes prompt+completion), and we
   * stop at the natural array/object close `]}` so the scaffolded prefix can be
   * reassembled into valid JSON. No chat wrapping, no think-prefill.
   */
  window.__rwkvGenerateRaw = async (opts) => {
    const { raw, promptTokens } = await runSampler(opts.prompt, opts, [']}', ']}', '\n}\n', '\n\n'])
    const completionTokens = (await __engine.tokenizer.encode(new TextEncoder().encode(raw))).length
    return { text: raw, raw, promptTokens, completionTokens }
  }

  /**
   * Phase 4b: feed text by INGEST ONLY (no sampling), then read back the recurrent
   * hidden state via session.back() and compute Δh = cosine + L2 against the
   * previous snapshot — all in-browser so only scalars cross the CDP bridge
   * (state_len ≈ 608256 floats ≫ CDP-friendly per turn).
   *
   * window.__rwkvStateDelta(turns) where turns = string[] (raw user/assistant text).
   * Keeps a persistent __prevRwkvState across calls so a whole conversation is one
   * evolving chain (matching Toggle-4 'active session' semantics).
   */
  let __prevRwkvState = null
  window.__rwkvResetState = () => { __prevRwkvState = null }
  window.__rwkvStateDelta = async (turns) => {
    const { session, tokenizer } = __engine
    const enc = new TextEncoder()
    // Start each experiment run from a clean slate unless caller says continue.
    if (!__prevRwkvState)
      session.load(new Float32Array(session.state_len()))
    const cur = new Float32Array(session.state_len())
    const out = []
    const scratch = new Float32Array(__engine.info.num_vocab)
    for (let idx = 0; idx < turns.length; idx++) {
      const tokens = tokenizer.encode(enc.encode(turns[idx]))
      if (tokens.length > 0)
        await session.run(tokens, scratch)
      await session.back(cur) // h_t for this turn
      let cos = 0
      let l2 = 0
      let dot = 0
      let na = 0
      let nb = 0
      if (__prevRwkvState) {
        for (let i = 0; i < cur.length; i++) {
          const d = cur[i] - __prevRwkvState[i]
          l2 += d * d
          dot += cur[i] * __prevRwkvState[i]
          na += cur[i] * cur[i]
          nb += __prevRwkvState[i] * __prevRwkvState[i]
        }
        l2 = Math.sqrt(l2)
        cos = 1 - (dot / ((Math.sqrt(na) * Math.sqrt(nb)) + 1e-9))
      }
      out.push({ turn: idx, deltaCosine: cos, deltaL2: l2 })
      __prevRwkvState = cur.slice() // snapshot for next turn's delta
    }
    return out
  }

  return {
    ok: true,
    numTensors: __engine.numTensors,
    numEmb: __engine.numEmb,
    numVocab: info.num_vocab,
    stateLen: session.state_len(),
  }
}

window.__RWkvRunnerReady = false
boot()
  .then((r) => { window.__RWkvBootResult = r; window.__RWkvRunnerReady = true })
  .catch((e) => { window.__RWkvBootResult = { ok: false, error: String((e && e.stack) || e).slice(0, 1500) } })
