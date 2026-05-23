/** VTube Studio .vtube.json uses several shapes for persisted ArtMesh multiply/screen colors. */

const COLOR_PAIR_RE = /^[0-9A-F]{8}\|[0-9A-F]{8}$/i
const HEX8_RE = /^[0-9A-F]{8}$/i

function isColorPair(value: unknown): value is string {
  return typeof value === 'string' && COLOR_PAIR_RE.test(value)
}

function joinMultiplyScreen(multiply: unknown, screen: unknown): string | undefined {
  const m = typeof multiply === 'string' ? multiply.replace('#', '') : ''
  const s = typeof screen === 'string' ? screen.replace('#', '') : ''
  if (HEX8_RE.test(m) && HEX8_RE.test(s))
    return `${m}|${s}`
  return undefined
}

function normalizeColorMap(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object')
    return {}

  if (Array.isArray(raw)) {
    const result: Record<string, string> = {}
    for (const item of raw) {
      if (!item || typeof item !== 'object')
        continue
      const entry = item as Record<string, unknown>
      const id = entry.ID ?? entry.Id ?? entry.id ?? entry.Name ?? entry.name
      if (typeof id !== 'string')
        continue

      const direct = entry.Value ?? entry.value
      if (isColorPair(direct)) {
        result[id] = direct
        continue
      }

      const joined = joinMultiplyScreen(
        entry.Multiply ?? entry.multiply ?? entry.MultiplyColor ?? entry.multiplyColor,
        entry.Screen ?? entry.screen ?? entry.ScreenColor ?? entry.screenColor,
      )
      if (joined)
        result[id] = joined
    }
    return result
  }

  const record = raw as Record<string, unknown>
  const result: Record<string, string> = {}

  for (const [key, value] of Object.entries(record)) {
    if (isColorPair(value)) {
      result[key] = value
      continue
    }
    if (value && typeof value === 'object') {
      const nested = value as Record<string, unknown>
      const direct = nested.Value ?? nested.value
      if (isColorPair(direct)) {
        result[key] = direct
        continue
      }
      const joined = joinMultiplyScreen(
        nested.Multiply ?? nested.multiply ?? nested.MultiplyColor ?? nested.multiplyColor,
        nested.Screen ?? nested.screen ?? nested.ScreenColor ?? nested.screenColor,
      )
      if (joined)
        result[key] = joined
    }
  }

  return result
}

/** Deep-search .vtube.json for any object that looks like an ArtMesh color table. */
function findNestedColorMaps(root: unknown, depth = 0): Record<string, string>[] {
  if (depth > 10 || root == null)
    return []

  const found: Record<string, string>[] = []

  if (typeof root === 'object') {
    if (Array.isArray(root)) {
      const fromArray = normalizeColorMap(root)
      if (Object.keys(fromArray).length > 0)
        found.push(fromArray)
      for (const item of root)
        found.push(...findNestedColorMaps(item, depth + 1))
    }
    else {
      const record = root as Record<string, unknown>
      const direct = normalizeColorMap(record)
      if (Object.keys(direct).length > 0)
        found.push(direct)
      for (const value of Object.values(record))
        found.push(...findNestedColorMaps(value, depth + 1))
    }
  }

  return found
}

function pickLargestMap(maps: Record<string, string>[]): Record<string, string> {
  return maps.reduce((best, current) =>
    Object.keys(current).length > Object.keys(best).length ? current : best, {})
}

function resolvePresetColors(vtubeData: Record<string, unknown>): Record<string, string> {
  const presetRoot = vtubeData.ColorScreenMultiplyPreset
  const fromRoot = normalizeColorMap(presetRoot)
  if (Object.keys(fromRoot).length > 0)
    return fromRoot

  const nested = (presetRoot as { ArtMeshMultiplyAndScreenColors?: unknown } | undefined)
    ?.ArtMeshMultiplyAndScreenColors
  const fromNested = normalizeColorMap(nested)
  if (Object.keys(fromNested).length > 0)
    return fromNested

  const presetsList = vtubeData.ColorScreenMultiplyPresets
    ?? vtubeData.ColorScreenMultiplyPresetList
    ?? (vtubeData.ColorScreenMultiplyPreset as { Presets?: unknown } | undefined)?.Presets

  if (!Array.isArray(presetsList))
    return {}

  const activeName = vtubeData.ColorScreenMultiplyPresetName
    ?? vtubeData.ActiveColorScreenMultiplyPresetName
    ?? (vtubeData.ColorScreenMultiplyPreset as { Name?: string } | undefined)?.Name

  const presets = presetsList as Record<string, unknown>[]
  const active = typeof activeName === 'string'
    ? presets.find(p => (p.Name ?? p.name) === activeName)
    : undefined

  for (const candidate of [active, ...presets]) {
    if (!candidate)
      continue
    const colors = normalizeColorMap(
      candidate.ArtMeshMultiplyAndScreenColors
      ?? candidate.artMeshMultiplyAndScreenColors
      ?? candidate,
    )
    if (Object.keys(colors).length > 0)
      return colors
  }

  return {}
}

export function extractArtMeshColorsFromVTube(vtubeData: Record<string, unknown>): Record<string, string> {
  const explicitPaths: unknown[] = [
    (vtubeData.ArtMeshDetails as { ArtMeshMultiplyAndScreenColors?: unknown } | undefined)
      ?.ArtMeshMultiplyAndScreenColors,
    vtubeData.ArtMeshMultiplyAndScreenColors,
    (vtubeData.ArtMeshDetails as { MultiplyAndScreenColors?: unknown } | undefined)?.MultiplyAndScreenColors,
    resolvePresetColors(vtubeData),
  ]

  for (const candidate of explicitPaths) {
    const map = normalizeColorMap(candidate)
    if (Object.keys(map).length > 0)
      return map
  }

  const nested = pickLargestMap(findNestedColorMaps(vtubeData))
  return nested
}

export function listVTubeColorRelatedKeys(vtubeData: Record<string, unknown>): string[] {
  return Object.keys(vtubeData).filter(key => /art|color|mesh|screen|multiply/i.test(key))
}
