/**
 * Web address, file path, and Obsidian wiki-link speech verbalizer.
 * Ported from upstream PR #3332 / commit b80db302e for AIRI Universal Speech Transformer (UST).
 */

export interface TokenLocale {
  dot: string
  slash: string
  backslash: string
  colon: string
  tilde: string
  port: string
}

export const TOKEN_LOCALES: Readonly<Record<string, TokenLocale>> = {
  en: { dot: 'dot', slash: 'slash', backslash: 'backslash', colon: 'colon', tilde: 'tilde', port: 'port' },
  zh: { dot: '点', slash: '斜杠', backslash: '反斜杠', colon: '冒号', tilde: '波浪号', port: '端口' },
  ja: { dot: 'ドット', slash: 'スラッシュ', backslash: 'バックスラッシュ', colon: 'コロン', tilde: 'チルダ', port: 'ポート' },
  ko: { dot: '점', slash: '슬래시', backslash: '역슬래시', colon: '콜론', tilde: '물결', port: '포트' },
}

export function tokenLocale(language: string): TokenLocale {
  const primary = language.toLowerCase().split(/[-_]/)[0] ?? 'en'
  return TOKEN_LOCALES[primary] ?? TOKEN_LOCALES.en
}

type EmbedKind = 'image' | 'audio' | 'video' | 'pdf'

const embedKinds: Readonly<Record<string, EmbedKind>> = {
  avif: 'image',
  bmp: 'image',
  gif: 'image',
  jpeg: 'image',
  jpg: 'image',
  png: 'image',
  svg: 'image',
  webp: 'image',
  flac: 'audio',
  m4a: 'audio',
  mp3: 'audio',
  ogg: 'audio',
  wav: 'audio',
  webm: 'video',
  mkv: 'video',
  mov: 'video',
  mp4: 'video',
  pdf: 'pdf',
}

const embedWords: Readonly<Record<string, Record<EmbedKind, string>>> = {
  en: { image: 'image', audio: 'audio', video: 'video', pdf: 'PDF file' },
  zh: { image: '图片', audio: '音频', video: '视频', pdf: 'PDF 文件' },
  ja: { image: '画像', audio: '音声', video: '動画', pdf: 'PDF ファイル' },
  ko: { image: '이미지', audio: '오디오', video: '동영상', pdf: 'PDF 파일' },
}

export function embedWord(target: string, language: string): string | undefined {
  const ext = target.split(/[?#]/)[0]?.split('.').at(-1)?.toLowerCase() ?? ''
  const kind = embedKinds[ext]
  if (!kind)
    return undefined
  const primary = language.toLowerCase().split(/[-_]/)[0] ?? 'en'
  return (embedWords[primary] ?? embedWords.en)[kind]
}

/**
 * The words of a wiki link target, as Obsidian shows it: `Note#Heading` reads as `Note Heading`.
 * A block reference such as `Note#^a1b2` has no words after the note.
 */
export function speakWikiTarget(target: string): string {
  const [page = '', ...headings] = target.split('#')
  const validHeadings = headings.filter(h => !h.startsWith('^')).map(h => h.trim()).filter(Boolean)
  return [page.trim(), ...validHeadings].filter(Boolean).join(' ')
}

/**
 * Verbalizes Obsidian wiki-links `[[...]]` and embeds `![[...]]` into pronounceable text.
 */
export function verbalizeObsidianWikiLinks(text: string, language = 'en'): string {
  // 1. Embeds: ![[target]] or ![[target|alias]]
  let result = text.replace(/!\[\[([^\]]+)\]\]/g, (_, inner) => {
    const parts = inner.split('|')
    const target = parts[0]?.trim() ?? ''
    const alias = parts.slice(1).join('|').trim()
    const isDimension = /^\d+(?:x\d+)?$/.test(alias)
    if (alias && !isDimension) {
      return alias
    }
    const word = embedWord(target, language)
    if (word)
      return word
    return speakWikiTarget(target)
  })

  // 2. Standard wiki links: [[target]] or [[target|alias]]
  result = result.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
    const [target, ...aliases] = inner.split('|')
    const alias = aliases.join('|').trim()
    if (alias) {
      return alias
    }
    return speakWikiTarget(target?.trim() ?? '')
  })

  return result
}

const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:com|org|net|edu|gov|io|ai|moe|dev|app|me|co|xyz|info|biz|site|online|tech|club|top|vip|[a-z]{2,})$/i
const ipv4Regex = /^\d{1,3}(?:\.\d{1,3}){3}$/
const schemeRegex = /^([a-z][a-z0-9+.-]*):\/\//i

function isAddress(token: string): boolean {
  if (schemeRegex.test(token)) {
    try {
      // eslint-disable-next-line no-new
      new URL(token)
      return true
    }
    catch {
      return false
    }
  }

  try {
    const url = new URL(`https://${token}`)
    if (url.username)
      return false
    return domainRegex.test(url.hostname) || (ipv4Regex.test(url.hostname) && token.startsWith(url.hostname) && /[:/]/.test(token))
  }
  catch {
    return false
  }
}

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  }
  catch {
    return segment
  }
}

/**
 * Reads web addresses (e.g. `https://home.example.com:8123/config`) as words.
 */
export function speakAddress(token: string, language: string): string | undefined {
  if (!isAddress(token))
    return undefined

  const words = tokenLocale(language)
  const dotted = (part: string) => part.split('.').filter(Boolean).join(` ${words.dot} `)
  const schemeName = schemeRegex.exec(token)?.[1]
  const location = (schemeName ? token.slice(schemeName.length + 3) : token).split(/[?#]/)[0]!
  const slashIndex = location.indexOf('/')
  const authority = slashIndex === -1 ? location : location.slice(0, slashIndex)
  const hostAndPort = authority.slice(authority.lastIndexOf('@') + 1)
  const portMatch = /:(\d+)$/.exec(hostAndPort)
  const host = portMatch ? hostAndPort.slice(0, portMatch.index) : hostAndPort
  const segments = slashIndex === -1 ? [] : location.slice(slashIndex).split('/').filter(Boolean)

  return [
    ...(schemeName ? [schemeName] : []),
    ...(host ? [dotted(host)] : []),
    ...(portMatch ? [`${words.port} ${portMatch[1]}`] : []),
    ...segments.flatMap(segment => [words.slash, dotted(decodeSegment(segment))]),
  ].join(' ')
}

const rooted = /^(?:~|\.{1,2})?\/|^\.{1,2}\\|^[a-z]:\\/i
const proseFileName = /^[\w-]{2,}(?:\.[\w-]+)*\.[a-z][a-z0-9]+$/i
const dotFile = /^\.[a-z][\w.-]*$/i

function isPath(token: string, inCode = false): boolean {
  if (rooted.test(token) || (inCode && dotFile.test(token)))
    return true
  const name = token.split(/[/\\]/).at(-1)!
  return (inCode ? /^[\w-]+(?:\.[\w-]+)*\.[a-z][a-z0-9]*$/i : proseFileName).test(name)
}

function speakSegment(segment: string, words: TokenLocale): string {
  if (segment === '~')
    return words.tilde
  const drive = /^([a-z]):$/i.exec(segment)
  if (drive)
    return `${drive[1]} ${words.colon}`
  if (/^\.+$/.test(segment))
    return Array.from(segment, () => words.dot).join(' ')

  const spoken = segment.split('.').filter(Boolean).join(` ${words.dot} `)
  return segment.startsWith('.') ? `${words.dot} ${spoken}` : spoken
}

/**
 * Reads file paths (e.g. `./src/index.ts`, `C:\Users\user`) as words.
 */
export function speakPath(token: string, language: string, inCode = false): string | undefined {
  if (!isPath(token, inCode))
    return undefined

  const words = tokenLocale(language)
  const separators: Record<string, string> = { '/': words.slash, '\\': words.backslash }
  return token.split(/([/\\])/).filter(Boolean).map(part => separators[part] ?? speakSegment(part, words)).join(' ')
}

const tokensRegex = /[\w~.:/\\@%+?#=&[\]\p{Co}-]+/gu
const innerSymbol = /\w[.:/\\@].|^[.~/][\w/\\]/
const trailingPunctuation = /[.,:;!?)]+$/
const markers = /\p{Co}/gu

export function speakTokens(text: string, language: string, inCode = false): string {
  return text.replace(tokensRegex, (match) => {
    const rawClean = match.replace(markers, '')
    const punct = trailingPunctuation.exec(rawClean)?.[0] ?? ''
    const token = rawClean.slice(0, -punct.length || undefined)
    if (!innerSymbol.test(token))
      return match

    const spokenAddress = speakAddress(token, language)
    if (spokenAddress !== undefined) {
      return spokenAddress + (match.match(markers)?.join('') ?? '') + punct
    }

    const spokenPath = speakPath(token, language, inCode)
    if (spokenPath !== undefined) {
      return spokenPath + (match.match(markers)?.join('') ?? '') + punct
    }

    return match
  })
}

/**
 * Transforms web URLs, file paths, and Obsidian wiki-links into natural spoken words.
 */
export function verbalizeWebAddressesAndLinks(text: string, language = 'en'): string {
  // 1. Process Obsidian Wiki-Links & Embeds
  let processed = verbalizeObsidianWikiLinks(text, language)

  // 2. Process inline code blocks `...` with inCode=true (excluding multi-line/fenced code blocks)
  processed = processed.replace(/(?<!`)`([^`\r\n]+)`(?!`)/g, (_, codeContent) => {
    return speakTokens(codeContent, language, true)
  })

  // 3. Process URLs inside angle brackets <https://...>
  processed = processed.replace(/<([a-z][a-z0-9+.-]*:\/\/[^>]+)>/gi, (_, url) => {
    return speakTokens(url, language, false)
  })

  // 4. Process prose tokens
  processed = speakTokens(processed, language, false)

  return processed
}
