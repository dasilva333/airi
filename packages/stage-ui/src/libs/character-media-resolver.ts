import { useBackgroundStore } from '../stores/background'
import { useDisplayModelsStore } from '../stores/display-models'

// Global memory caches to avoid duplicate zip parsing or canvas computation
export const iconCache = new Map<string, string>()
export const colorCache = new Map<string, { light: string, dark: string }>()

export function getLatestSelfie(cardId: string): string | null {
  try {
    const backgroundStore = useBackgroundStore()
    const entries = backgroundStore.getCharacterJournalEntries(cardId)
    const selfies = entries.filter(e => e.type === 'selfie')
    if (selfies.length === 0)
      return null
    const sorted = [...selfies].sort((a, b) => b.createdAt - a.createdAt)
    return backgroundStore.getBackgroundUrl(sorted[0].id)
  }
  catch {
    return null
  }
}

export async function extractModelIcon(displayModelId: string): Promise<string | null> {
  if (iconCache.has(displayModelId)) {
    return iconCache.get(displayModelId) || null
  }

  const displayModelsStore = useDisplayModelsStore()
  const model = await displayModelsStore.getDisplayModel(displayModelId)
  if (!model)
    return null

  try {
    let zipData: Blob | File | null = null
    if (model.type === 'file') {
      zipData = model.file || null
    }
    else if (model.type === 'url') {
      const res = await fetch(model.url)
      zipData = await res.blob()
    }

    if (zipData) {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(zipData)
      const iconFileName = Object.keys(zip.files).find((name) => {
        const lower = name.toLowerCase()
        return lower.endsWith('icon.png') || lower.endsWith('icon.jpg')
      })
      if (iconFileName) {
        const fileData = await zip.files[iconFileName].async('blob')
        const url = URL.createObjectURL(fileData)
        iconCache.set(displayModelId, url)
        return url
      }
    }
    iconCache.set(displayModelId, '')
    return null
  }
  catch (e) {
    console.error('[CharacterMediaResolver] Failed to extract icon:', e)
    iconCache.set(displayModelId, '')
    return null
  }
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const v = max

  const d = max - min
  s = max === 0 ? 0 : d / max

  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break
      case g: h = (b - r) / d + 2; break
      case b: h = (r - g) / d + 4; break
    }
    h /= 6
  }
  return [h, s, v]
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  let r = 0
  let g = 0
  let b = 0
  const i = Math.floor(h * 6)
  const f = h * 6 - i
  const p = v * (1 - s)
  const q = v * (1 - f * s)
  const t = v * (1 - (1 - f) * s)

  switch (i % 6) {
    case 0: r = v; g = t; b = p; break
    case 1: r = q; g = v; b = p; break
    case 2: r = p; g = v; b = t; break
    case 3: r = p; g = q; b = v; break
    case 4: r = t; g = p; b = v; break
    case 5: r = v; g = p; b = q; break
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export function getContrastingComplementaryColor(
  r: number,
  g: number,
  b: number,
  _threshold = 0.5,
  darkValue = 0.15, // 15% brightness for dark mode
  brightValue = 0.94, // 94% brightness for light mode
  saturation = 0.18, // Moderate saturation (18%) for soft but colored pastel cards
): { light: string, dark: string } {
  const [h] = rgbToHsv(r, g, b)
  const compH = (h + 0.5) % 1.0

  const lightRgb = hsvToRgb(compH, saturation, brightValue)
  const lightHex = `#${lightRgb.map(x => x.toString(16).padStart(2, '0')).join('')}`

  const darkRgb = hsvToRgb(compH, saturation, darkValue)
  const darkHex = `#${darkRgb.map(x => x.toString(16).padStart(2, '0')).join('')}`

  return {
    light: lightHex,
    dark: darkHex,
  }
}

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0 // Convert to 32bit integer
  }
  return hash.toString(36)
}

export async function extractComplementaryColors(imageUrl: string): Promise<{ light: string, dark: string } | null> {
  if (colorCache.has(imageUrl)) {
    return colorCache.get(imageUrl) || null
  }

  // Check localStorage first
  const cacheKey = `airi_cc_${hashString(imageUrl)}`
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(cacheKey) : null
  if (saved) {
    try {
      const parsed = JSON.parse(saved)
      colorCache.set(imageUrl, parsed)
      return parsed
    }
    catch {}
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = imageUrl
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const size = 32 // small size is extremely fast
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, size, size)
        const imgData = ctx.getImageData(0, 0, size, size)

        let sumR = 0
        let sumG = 0
        let sumB = 0
        let count = 0
        for (let i = 0; i < imgData.data.length; i += 4) {
          const r = imgData.data[i]
          const g = imgData.data[i + 1]
          const b = imgData.data[i + 2]
          const a = imgData.data[i + 3]

          // Only average non-transparent, non-white, non-black pixels
          if (a > 50 && (r <= 245 || g <= 245 || b <= 245) && (r >= 15 || g >= 15 || b >= 15)) {
            sumR += r
            sumG += g
            sumB += b
            count++
          }
        }

        if (count === 0) {
          resolve(null)
          return
        }

        const avgR = Math.round(sumR / count)
        const avgG = Math.round(sumG / count)
        const avgB = Math.round(sumB / count)

        const colors = getContrastingComplementaryColor(avgR, avgG, avgB)

        colorCache.set(imageUrl, colors)
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(cacheKey, JSON.stringify(colors))
        }
        resolve(colors)
      }
      catch (e) {
        console.error('[CharacterMediaResolver] Canvas extraction failed:', e)
        resolve(null)
      }
    }
    img.onerror = () => {
      resolve(null)
    }
  })
}
