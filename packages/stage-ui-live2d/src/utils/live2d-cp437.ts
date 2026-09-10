// CP437 table mapping byte 0..255 to Unicode character
const CP437 = '\u0000\u0001\u0002\u0003\u0004\u0005\u0006\u0007\b\t\n\u000B\f\r\u000E\u000F\u0010\u0011\u0012\u0013\u0014\u0015\u0016\u0017\u0018\u0019\u001A\u001B\u001C\u001D\u001E\u001F !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u007F\u00C7\u00FC\u00E9\u00E2\u00E4\u00E0\u00E5\u00E7\u00EA\u00EB\u00E8\u00EF\u00EE\u00EC\u00C4\u00C5\u00C9\u00E6\u00C6\u00F4\u00F6\u00F2\u00FB\u00F9\u00FF\u00D6\u00DC\u00A2\u00A3\u00A5\u20A7\u0192\u00E1\u00ED\u00F3\u00FA\u00F1\u00D1\u00AA\u00BA\u00BF\u2310\u00AC\u00BD\u00BC\u00A1\u00AB\u00BB\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255D\u255C\u255B\u2510\u2514\u2534\u252C\u251C\u2500\u253C\u255E\u255F\u255A\u2554\u2569\u2566\u2560\u2550\u256C\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256B\u256A\u2518\u250C\u2588\u2584\u258C\u2590\u2580\u03B1\u00DF\u0393\u03C0\u03A3\u03C3\u00B5\u03C4\u03A6\u0398\u03A9\u03B4\u221E\u03C6\u03B5\u2229\u2261\u00B1\u2265\u2264\u2320\u2321\u00F7\u2248\u00B0\u2219\u00B7\u221A\u207F\u00B2\u25A0\u00A0'

const charToByte = new Map<string, number>()
for (let i = 0; i < 256; i++) {
  charToByte.set(CP437[i], i)
}

/**
 * Reverses CP437 mojibake where raw UTF-8 bytes were interpreted as DOS CP437.
 * Common in Japanese Live2D packages from Nizima/Booth/DLsite packaged without ZIP Bit 11.
 * Example: "πâòπâ½πâ╝πâäσñºτªÅπüíπéâπéô" -> "フルーツ大福ちゃん"
 */
export function decodeCp437Mojibake(str: string): string | null {
  if (!str)
    return null

  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    const b = charToByte.get(str[i])
    if (b === undefined)
      return null
    bytes[i] = b
  }

  try {
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return decoded !== str ? decoded : null
  }
  catch {
    return null
  }
}

/**
 * Encodes a UTF-8 string into its CP437 mojibake representation.
 * Example: "フルーツ大福ちゃん" -> "πâòπâ½πâ╝πâäσñºτªÅπüíπéâπéô"
 */
export function encodeUtf8ToCp437(str: string): string | null {
  if (!str)
    return null

  try {
    const bytes = new TextEncoder().encode(str)
    let res = ''
    for (let i = 0; i < bytes.length; i++) {
      res += CP437[bytes[i]]
    }
    return res !== str ? res : null
  }
  catch {
    return null
  }
}

/**
 * Checks if a candidate path in a ZIP archive corresponds to an expected path
 * via CP437 mojibake decoding in either direction.
 */
export function isMojibakeMatch(candidatePath: string, expectedPath: string): boolean {
  if (!candidatePath || !expectedPath)
    return false

  const candBase = candidatePath.split(/[\\/]/).pop()!
  const expBase = expectedPath.split(/[\\/]/).pop()!

  // Check full path decoded
  const decodedFull = decodeCp437Mojibake(candidatePath)
  if (decodedFull && (decodedFull === expectedPath || decodedFull.toLowerCase() === expectedPath.toLowerCase()))
    return true

  // Check basename decoded
  const decodedBase = decodeCp437Mojibake(candBase)
  if (decodedBase && (decodedBase === expBase || decodedBase.toLowerCase() === expBase.toLowerCase()))
    return true

  // Check expected encoded to CP437
  const encodedExpBase = encodeUtf8ToCp437(expBase)
  if (encodedExpBase && (encodedExpBase === candBase || encodedExpBase.toLowerCase() === candBase.toLowerCase()))
    return true

  return false
}
