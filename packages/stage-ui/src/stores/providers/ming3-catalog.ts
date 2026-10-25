/**
 * Ming 3.0 TTS catalog: model definition, built-in voices, paralinguistic
 * expression tags, and voice-design persistence.
 *
 * Built-in voice identities are verified against the browser runtime binary
 * (`ming_runtime_bg.wasm` string table): US_Emma, US_James, US_Stella,
 * UK_George, UK_Charlotte. Descriptions follow the upstream task cookbook
 * (`inclusionAI/Ming-3.0-tts` cookbooks/instructions.md).
 *
 * Voice-design persistence mirrors the Pocket/MOSS voice-clone tuple
 * (`{id, name, createdAt, ...}` content-hash id + editable name), except the
 * "reference" is the design prompt text itself — no blob store is needed.
 */

export const MING3_PROVIDER_ID = 'ming3-local'

export const MING3_MODEL_ID = 'ming-3.0-tts-0.5b-mix'
export const MING3_MODEL_NAME = 'Ming 3.0 0.5B (Mix)'
export const MING3_MODEL_DESCRIPTION = '850 MB download · 4-bit LM+VAE, 7-bit flow head · ~1.2–1.4 GB memory while running'

export const MING3_ENGINE_DIST_BASE = 'https://huggingface.co/spaces/fusorlabs/ming-wasm/resolve/main/engine/dist'
export const MING3_BUNDLE_BASE = 'https://huggingface.co/fusorlabs/ming-3.0-tts-0.5b-web/resolve/main/'
/**
 * Same-origin mirror of the runtime threaded builds (flattened out of the
 * upstream `engine/dist/` layout so no path segment is named `dist`,
 * which this repo gitignores as build output).
 * The threaded glue has relative sub-imports (`./snippets/...`) that cannot
 * resolve against a Blob base URL, and HF serves them as text/plain — so the
 * threaded builds must load from hierarchical same-origin URLs. Served from
 * `apps/stage-web/public/ming3-runtime/` (mirrors the Space layout).
 * Single-threaded builds stay on the CDN + Blob-import path (proven working).
 */
export const MING3_ENGINE_LOCAL_BASE = '/ming3-runtime/'

export type Ming3Preset = 'quality' | 'balanced' | 'fast'
export const MING3_PRESETS: Ming3Preset[] = ['quality', 'balanced', 'fast']

export interface Ming3BuiltinVoice {
  id: string
  name: string
  description: string
  gender: 'female' | 'male'
  languageCode: string
  languageTitle: string
}

export const MING3_BUILTIN_VOICES: Ming3BuiltinVoice[] = [
  {
    id: 'US_Emma',
    name: 'US Emma',
    description: 'American female voice for assistants, narration, and product dialogue.',
    gender: 'female',
    languageCode: 'en-US',
    languageTitle: 'English (US)',
  },
  {
    id: 'US_James',
    name: 'US James',
    description: 'American male narrator for exposition and documentary reading.',
    gender: 'male',
    languageCode: 'en-US',
    languageTitle: 'English (US)',
  },
  {
    id: 'US_Stella',
    name: 'US Stella',
    description: 'Warm, young American female voice for narration and natural dialogue.',
    gender: 'female',
    languageCode: 'en-US',
    languageTitle: 'English (US)',
  },
  {
    id: 'UK_George',
    name: 'UK George',
    description: 'British male voice for audiobooks and formal broadcast.',
    gender: 'male',
    languageCode: 'en-GB',
    languageTitle: 'English (UK)',
  },
  {
    id: 'UK_Charlotte',
    name: 'UK Charlotte',
    description: 'British female voice for audiobooks and unhurried narration.',
    gender: 'female',
    languageCode: 'en-GB',
    languageTitle: 'English (UK)',
  },
]

export interface Ming3ExpressionTag {
  tag: string
  category: string
  description: string
}

/**
 * The 14 inline paralinguistic tags supported by Ming-3.0-tts-0.5B.
 * Case-sensitive, brackets required — `[laughter]` (lowercase) is NOT a tag.
 * Source: upstream `cookbooks/instructions.md` (副语言标签).
 */
export const MING3_EXPRESSION_TAGS: Ming3ExpressionTag[] = [
  { tag: '[Breathing]', category: 'sound', description: 'Audible breathing' },
  { tag: '[Cough]', category: 'sound', description: 'Coughing' },
  { tag: '[Sigh]', category: 'sound', description: 'Sighing' },
  { tag: '[Laughter]', category: 'sound', description: 'Laughter' },
  { tag: '[Uhm]', category: 'sound', description: 'Hesitant filler sound' },
  { tag: '[Surprise-ah]', category: 'emotion', description: 'Surprised “ah”' },
  { tag: '[Surprise-oh]', category: 'emotion', description: 'Surprised “oh”' },
  { tag: '[Dissatisfaction-hnn]', category: 'emotion', description: 'Dissatisfied “hnn”' },
  { tag: '[Confirmation-en]', category: 'confirmation', description: 'Affirming “en”' },
  { tag: '[Question-ei]', category: 'question', description: 'Questioning “ei”' },
  { tag: '[Question-ah]', category: 'question', description: 'Questioning “ah”' },
  { tag: '[Question-en]', category: 'question', description: 'Questioning “en”' },
  { tag: '[Question-oh]', category: 'question', description: 'Questioning “oh”' },
  { tag: '[Question-huh]', category: 'question', description: 'Questioning “huh”' },
]

export interface MingDesignVoice {
  /** `ming-design-${sha256(designPrompt).slice(0,16)}` — content-derived, dedups identical prompts. */
  id: string
  /** User title. Fully open-ended (CJK-safe); the id carries the charset burden. Editable. */
  name: string
  createdAt: number
  /** Verbatim design description. Never passes through UST — only speech text is transformed. */
  designPrompt: string
  /** Reserved. Populated if/when the fusor Runtime exposes a design-conditioning precompute/cache entry point. */
  conditionedEmbedding?: unknown
  /** Bundle/profile identifier for invalidating `conditionedEmbedding` on bundle change. */
  artifactVersion?: string
}

export const MING_DESIGNS_STORE_NAME = 'ming-design-voices-metadata'

export function mingDesignIdForPrompt(prompt: string, sha256Hex: string): string {
  void prompt
  return `ming-design-${sha256Hex.slice(0, 16)}`
}

export function isMingDesignVoiceId(voiceId: string): boolean {
  return voiceId.startsWith('ming-design-')
}

async function getDesignsStore() {
  const { default: localforage } = await import('localforage')
  return localforage.createInstance({ name: MING_DESIGNS_STORE_NAME })
}

export async function listMingDesignVoices(): Promise<MingDesignVoice[]> {
  try {
    const store = await getDesignsStore()
    const designs: MingDesignVoice[] = []
    await store.iterate((value: unknown) => {
      const v = value as MingDesignVoice
      if (v && typeof v.id === 'string' && typeof v.designPrompt === 'string')
        designs.push(v)
    })
    designs.sort((a, b) => b.createdAt - a.createdAt)
    return designs
  }
  catch {
    return []
  }
}

export async function getMingDesignVoice(id: string): Promise<MingDesignVoice | null> {
  try {
    const store = await getDesignsStore()
    const value = await store.getItem<MingDesignVoice>(id)
    return value ?? null
  }
  catch {
    return null
  }
}

export async function deleteMingDesignVoice(id: string): Promise<void> {
  const store = await getDesignsStore()
  await store.removeItem(id)
}

export async function saveMingDesignVoice(name: string, designPrompt: string): Promise<MingDesignVoice> {
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(designPrompt))
  const sha256Hex = Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('')
  const id = mingDesignIdForPrompt(designPrompt, sha256Hex)
  const store = await getDesignsStore()
  const existing = await store.getItem<MingDesignVoice>(id)
  const record: MingDesignVoice = {
    id,
    name: name.trim() || designPrompt.slice(0, 24),
    createdAt: existing?.createdAt ?? Date.now(),
    designPrompt,
  }
  await store.setItem(id, record)
  return record
}
