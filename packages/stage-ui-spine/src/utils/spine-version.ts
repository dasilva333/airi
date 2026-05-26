/**
 * Spine skeleton version detection and runtime routing.
 *
 * Use when:
 * - A ZIP is imported and we need to determine which spine-webgl runtime
 *   (4.0, 4.1, or 4.2) to use for loading and rendering.
 *
 * Expects:
 * - Raw skeleton data (Uint8Array for binary `.skel`, or string for `.json`).
 *
 * Returns:
 * - A `SpineVersion` ('4.0' | '4.1' | '4.2') or `undefined` if undetectable.
 */

export type SpineVersion = string

export function detectSpineVersionFromBinary(data: Uint8Array): SpineVersion | undefined {
  // 1. Try Spine 4.0+ format (8-byte non-varint hash followed by varint-prefixed version string)
  try {
    const offset = 8
    if (data.byteLength > offset) {
      const { value: verLenEncoded, bytesRead: verBytes } = readVarint(data, offset)
      const tempOffset = offset + verBytes
      if (verLenEncoded > 1) {
        const verLen = verLenEncoded - 1
        if (tempOffset + verLen <= data.byteLength) {
          const versionStr = new TextDecoder().decode(data.subarray(tempOffset, tempOffset + verLen))
          if (/^\d+\.\d+\.\d+/.test(versionStr)) {
            return parseSpineVersionString(versionStr)
          }
        }
      }
    }
  } catch {}

  // 2. Fallback to Spine 3.8 and below format (varint-prefixed hash string followed by varint-prefixed version string)
  try {
    let offset = 0
    const { value: hashLenEncoded, bytesRead: hashBytes } = readVarint(data, offset)
    offset += hashBytes

    if (hashLenEncoded > 1) {
      const hashLen = hashLenEncoded - 1
      offset += hashLen
    }

    const { value: verLenEncoded, bytesRead: verBytes } = readVarint(data, offset)
    offset += verBytes

    if (verLenEncoded > 1) {
      const verLen = verLenEncoded - 1
      if (offset + verLen <= data.byteLength) {
        const versionStr = new TextDecoder().decode(data.subarray(offset, offset + verLen))
        if (/^\d+\.\d+\.\d+/.test(versionStr)) {
          return parseSpineVersionString(versionStr)
        }
      }
    }
  } catch {}

  // 3. Robust regex fallback on first 200 bytes (matches python implementation exactly)
  try {
    const headerStr = new TextDecoder().decode(data.subarray(0, 200))
    const match = headerStr.match(/(\d+\.\d+\.\d+)/)
    if (match) {
      return parseSpineVersionString(match[1])
    }
  } catch {}

  return undefined
}

/**
 * Detects the Spine editor version from a JSON skeleton string.
 * Reads `root.skeleton.spine` which contains the version string.
 */
export function detectSpineVersionFromJson(json: string): SpineVersion | undefined {
  try {
    const root = JSON.parse(json)
    const versionStr = root?.skeleton?.spine
    if (typeof versionStr !== 'string') return undefined
    return parseSpineVersionString(versionStr)
  } catch {
    return undefined
  }
}

/**
 * Parses a version string like "4.2.18" or "4.0.64" into our supported
 * major.minor version bucket.
 */
function parseSpineVersionString(version: string): SpineVersion | undefined {
  const match = version.match(/^(\d+)\.(\d+)/)
  if (!match) return undefined
  return `${match[1]}.${match[2]}`
}

/**
 * Reads a Spine-format varint (variable-length int, 7 bits per byte,
 * high bit = continuation).
 */
function readVarint(data: Uint8Array, offset: number): { value: number; bytesRead: number } {
  let value = 0
  let shift = 0
  let bytesRead = 0
  while (offset < data.byteLength) {
    const b = data[offset++]
    bytesRead++
    value |= (b & 0x7f) << shift
    if ((b & 0x80) === 0) break
    shift += 7
  }
  return { bytesRead, value }
}
