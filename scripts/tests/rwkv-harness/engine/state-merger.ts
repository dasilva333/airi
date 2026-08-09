/**
 * Tensor disk caching + corpus windowing helpers for the RWKV-7 cleanroom harness.
 *
 * ## On the removed `.state` overlay (read me)
 *
 * This module previously exported a `mergeStateWithBaseModel(base, state)` stub
 * that "merged" a roleplay `.state` file into the base safetensors — but it was
 * a passthrough that returned `baseBuffer` unchanged, and *no such 0.1B `.state`
 * asset exists*: `huggingface.co/shoumenchougou/RWKV-7-G1-RolePlay-State` ships
 * only `.pth` checkpoints (full 1.5B/2.9B `g1c`, and 10 MB RWKV-PEFT StateFFT
 * files for `g1a-2.9B`). There is no `.state` for the `g1d-0.1B` base we cache,
 * and web-rwkv has no StateFFT mount path — the README's own guidance is an
 * offline `state-merge` Python step producing a *new* merged model.
 *
 * Decision (user-approved): Phase 3 uses the **0.1B base model + prompt-only**
 * persona/context. There is no weight overlay. This module's job is therefore
 * (1) disk caching of the base model and (2) replicating the production Echo
 * Chips windowing/sanitization so the eval matches `echo-chips.ts` semantics.
 */

import fs from 'node:fs'
import path from 'node:path'

export const DEFAULT_BASE_MODEL_URL
  = 'https://huggingface.co/DanielClough/rwkv7-g1-safetensors/resolve/main/rwkv7-g1d-0.1b-20260129-ctx8192.safetensors'

const CACHE_DIR = path.resolve(process.cwd(), '.cache')

export async function fetchTensorBinary(url: string): Promise<ArrayBuffer> {
  if (!fs.existsSync(CACHE_DIR))
    fs.mkdirSync(CACHE_DIR, { recursive: true })

  const fileName = path.basename(new URL(url).pathname)
  const cachedFilePath = path.join(CACHE_DIR, fileName)

  if (fs.existsSync(cachedFilePath)) {
    console.info(`[RWKV-Cache] Loading model from local disk cache: ${cachedFilePath}`)
    const buffer = fs.readFileSync(cachedFilePath)
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  }

  console.info(`[RWKV-Harness] Disk cache miss. Downloading tensor binary from: ${url}`)
  const response = await fetch(url)
  if (!response.ok)
    throw new Error(`Failed to fetch tensor asset ${url} -> HTTP ${response.status}`)

  const arrayBuffer = await response.arrayBuffer()
  fs.writeFileSync(cachedFilePath, Buffer.from(arrayBuffer))
  console.info(`[RWKV-Cache] Saved tensor binary to local disk cache: ${cachedFilePath} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`)
  return arrayBuffer
}

/** Resolve the on-disk cached path for a model URL (no download if absent). */
export function cachedModelPath(url: string = DEFAULT_BASE_MODEL_URL): string {
  return path.join(CACHE_DIR, path.basename(new URL(url).pathname))
}

/* ------------------------------------------------------------------------- */
/* Production-mirrored Echo Chips windowing (from echo-chips.ts)             */
/* ------------------------------------------------------------------------- */

export const DEFAULT_FIRST_DREAM_LOOKBACK_MS = 24 * 60 * 60 * 1000
export const DEFAULT_MAX_WINDOW_MESSAGES = 80

export interface CorpusMessage {
  role: string
  /** Plain string, or OpenAI multimodal content-parts array (some real AIRI turns). */
  content: string | Array<Record<string, unknown>> | null
  createdAt: number
}

/**
 * Sanitize raw chat text exactly as production `sanitizeChatContent`
 * (packages/stage-ui/src/stores/echo-chips.ts) does before building the evidence
 * window: strips `<|ACT:…|>` / `<|…|>` action tags, `[bracket]` markers, CRs,
 * and collapses whitespace. Verbatim copy so harness prompts match production.
 */
export function sanitizeChatContent(text: string): string {
  return text
    .replace(/<\|ACT:[^>]*\|>/g, ' ')
    .replace(/<\|[^>]+\|>/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface WindowMessage {
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

/** Mirror production `extractPartText` (echo-chips.ts): pull text out of one content part. */
function extractPartText(part: unknown): string {
  if (!part)
    return ''
  if (typeof part === 'string')
    return part
  if (typeof part === 'object') {
    const p = part as Record<string, unknown>
    for (const k of ['text', 'input', 'output']) {
      if (typeof p[k] === 'string')
        return p[k] as string
    }
  }
  return ''
}

/** Mirror production `extractMessageText`: flatten string or content-parts to a string, then sanitize. */
function extractMessageText(content: CorpusMessage['content']): string {
  if (typeof content === 'string')
    return sanitizeChatContent(content)
  if (Array.isArray(content))
    return sanitizeChatContent(content.map(extractPartText).join(' '))
  return ''
}

/**
 * Replicate production `collectWindowMessages`: keep user/assistant turns (drop
 * `system`), flatten + sanitize content, drop empties, sort by timestamp, cap to
 * the most recent `maxMessages`. Window by count (prod default 80).
 */
export function buildWindowMessages(
  transcript: CorpusMessage[],
  maxMessages: number = DEFAULT_MAX_WINDOW_MESSAGES,
): WindowMessage[] {
  const out: WindowMessage[] = []
  for (const m of transcript) {
    if (m.role !== 'user' && m.role !== 'assistant')
      continue
    const content = extractMessageText(m.content)
    if (!content)
      continue
    out.push({ role: m.role, content, createdAt: m.createdAt })
  }
  return out
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-maxMessages)
}

/**
 * The base model is ctx8192. Rough token estimate for English roleplay text is
 * ~3.5 chars/token; we reserve ~1216 tokens for the instruction block + output
 * headroom, leaving ~6976*3.5 ≈ 24000 chars of evidence as the hard budget.
 * buildEvidenceWindow() truncates the OLDEST lines first (keeping maxMessages
 * tail), mirroring how collectWindowMessages slices the most recent window.
 */
export const EVIDENCE_CHAR_BUDGET = 24000

/**
 * Build the indexed evidence-window string exactly as production
 * `synthesizeForCharacter` does (`${index}: [${iso}] ${speaker}: ${content}`),
 * then wrap it in the production Echo Chips instruction block verbatim.
 */
export function buildEvidenceWindow(windowMessages: WindowMessage[], charName: string, charBudget: number = EVIDENCE_CHAR_BUDGET): string {
  // Keep the most recent lines that fit the char budget; oldest lines drop first.
  const lines: string[] = []
  let used = 0
  for (let i = windowMessages.length - 1; i >= 0; i--) {
    const m = windowMessages[i]
    const iso = new Date(m.createdAt).toISOString()
    const speaker = m.role === 'user' ? 'User' : charName
    const line = `${i}: [${iso}] ${speaker}: ${m.content}`
    if (used + line.length + 1 > charBudget)
      break
    lines.unshift(line)
    used += line.length + 1
  }
  return lines.join('\n')
}

/** Production instruction block (echo-chips.ts lines 256–271), verbatim. */
export function buildEchoChipsPrompt(evidenceWindow: string, charName: string): string {
  return `
Extract 3-5 semantic Echo Chips from the following raw conversation evidence window.
These are for a character memory-stream; avoid clinical labels and generic chatter.

Requirements:
1. CONTENT: Use 2-5 word evocative bursts (e.g. "Dogs know tricks", "Gaming as stress relief").
2. TYPE: Identify whether each chip is a "mood", "flavor" (trait/fact), or "journal_candidate" (noteworthy moment worth preserving).
3. RELEVANCE: Provide a relevanceScore from 0.0 to 1.0.
4. EVIDENCE: Use evidence_indices to point at the most relevant lines from the evidence window.
5. FOCUS: Prefer durable motifs, emotional shifts, distinctive rituals, or memorable turns. Ignore pure greetings, microphone tests, or generic filler.

Evidence Window:
${evidenceWindow}

Output a JSON object with a "pills" array.
`
}
