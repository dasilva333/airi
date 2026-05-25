/**
 * NOTICE: CJK characters tokenize roughly 1:1 (one char ≈ one token) while ASCII/Latin
 * text tokenizes at ~4 chars per token. Counts are summed separately so estimates remain
 * accurate for the multilingual (Japanese/Chinese/Korean) content this project targets.
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 1

  let cjkCount = 0
  for (const char of trimmed) {
    const cp = char.codePointAt(0) ?? 0
    if (
      (cp >= 0x4e00 && cp <= 0x9fff) || // CJK Unified Ideographs
      (cp >= 0x3400 && cp <= 0x4dbf) || // CJK Ext-A
      (cp >= 0x20000 && cp <= 0x2a6df) || // CJK Ext-B
      (cp >= 0xf900 && cp <= 0xfaff) || // CJK Compatibility Ideographs
      (cp >= 0x3000 && cp <= 0x303f) || // CJK Symbols and Punctuation
      (cp >= 0x3040 && cp <= 0x309f) || // Hiragana
      (cp >= 0x30a0 && cp <= 0x30ff) || // Katakana
      (cp >= 0xac00 && cp <= 0xd7af) // Hangul Syllables
    ) {
      cjkCount++
    }
  }

  const nonCjkCount = trimmed.length - cjkCount
  return Math.max(1, cjkCount + Math.ceil(nonCjkCount / 4))
}

/**
 * Mapping of Windows-1252 specific high-range Unicode characters back to their original byte values.
 * This is used to "un-mismatch" encoding when a UTF-8 stream was misinterpreted as Windows-1252.
 */
const WIN1252_TO_BYTE: Record<number, number> = {
  338: 0x8c, // Œ
  339: 0x9c, // œ
  352: 0x8a, // Š
  353: 0x9a, // š
  376: 0x9f, // Ÿ
  381: 0x8e, // Ž
  382: 0x9e, // ž
  402: 0x83, // ƒ
  710: 0x88, // ˆ
  732: 0x98, // ˜
  8211: 0x96, // –
  8212: 0x97, // —
  8216: 0x91, // ‘
  8217: 0x92, // ’
  8218: 0x82, // ‚
  8220: 0x93, // “
  8221: 0x94, // ”
  8222: 0x84, // „
  8224: 0x86, // †
  8225: 0x87, // ‡
  8226: 0x95, // •
  8230: 0x85, // …
  8240: 0x89, // ‰
  8249: 0x8b, // ‹
  8250: 0x9b, // ›
  8364: 0x80, // €
  8482: 0x99, // ™
}

/**
 * Heals "Mozibake" (character scramble) where UTF-8 bytes were interpreted as Windows-1252/Latin-1.
 * Matches common mangled Kaomoji fragments like 'Ê·' -> 'ʷ' by identifying sequences of
 * misinterpreted characters and restoring them while leaving valid Unicode symbols untouched.
 */
export function healMozibake(text: string): string {
  if (!text || !/[^\u0000-\u007F]/.test(text)) return text

  // Literal mappings for common fragments that are hard to recover via bit-shifting
  const commonScrambles: Record<string, string> = {
    'Â¬': '¬',
    'Ê"': 'ʔ',
    Ê·: 'ʷ',
    'Ê•': 'ʕ',
    'á´¥': 'ᴥ',
    'â¬½': '⬽',
    'â–½': '▽',
    'â—´': '◴',
    'â—•': '•',
    'â‰¦': '≦',
    'â‰§': '≧',
    'ãƒ˜': 'ヘ',
    'ï¿£': '￣',
  }

  let healed = text
  for (const [key, val] of Object.entries(commonScrambles)) {
    healed = healed.replaceAll(key, val)
  }

  // Selective healing of remaining misinterpreted byte sequences
  // We scan the string for "suspicious" sequences that are likely UTF-8 start/cont bytes
  try {
    const bytes: number[] = []
    let changed = false

    for (const char of healed) {
      const code = char.codePointAt(0) ?? 0

      // If it's a single-unit character that COULD be a mis-decoded byte (0x80-0xFF or mapping)
      if (char.length === 1 && (code <= 0xff || WIN1252_TO_BYTE[code] !== undefined)) {
        const byte = code <= 0xff ? code : WIN1252_TO_BYTE[code]
        bytes.push(byte)
        if (code !== byte) changed = true
      } else {
        // It's a high-range character or a surrogate pair (multiple code units).
        // To preserve it, we'll encode the whole code point back to its UTF-8 bytes and push those.
        // This keeps the byte stream consistent for the final TextDecoder.
        const encoded = new TextEncoder().encode(char)
        for (const b of encoded) bytes.push(b)
      }
    }

    if (changed || bytes.length !== healed.length) {
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(bytes))
      if (decoded && decoded !== healed) return decoded
    }
  } catch {
    // If selective byte-reconstruction fails, stick with the literal replacements.
  }

  return healed
}
