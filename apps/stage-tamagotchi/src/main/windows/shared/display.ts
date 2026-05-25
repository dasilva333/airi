import type { BrowserWindow, Rectangle } from 'electron'

import { screen } from 'electron'

export function currentDisplayBounds(window: BrowserWindow) {
  const bounds = window.getBounds()
  const nearbyDisplay = screen.getDisplayMatching(bounds)

  return nearbyDisplay.bounds
}

interface SizeActual {
  actual: number
}
interface SizePercentage {
  percentage: number
}
type Size = SizeActual | SizePercentage | number

function evaluateSize(basedOn: number, size: Size) {
  if (typeof size === 'number') {
    return size
  }
  if ('actual' in size) {
    return size.actual
  }

  return Math.floor(basedOn * size.percentage)
}

/**
 * Breakpoint prefix Minimum width CSS
 * sm 40rem (640px) @media (width >= 40rem) { ... }
 * md 48rem (768px) @media (width >= 48rem) { ... }
 * lg 64rem (1024px) @media (width >= 64rem) { ... }
 * xl 80rem (1280px) @media (width >= 80rem) { ... }
 * 2xl 96rem (1536px) @media (width >= 96rem) { ... }
 *
 * Additional to tailwindcss defaults:
 * 3xl 112rem (1792px) @media (width >= 112rem) { ... }
 * 4xl 128rem (2048px) @media (width >= 128rem) { ... }
 * 5xl 144rem (2304px) @media (width >= 144rem) { ... }
 * 6xl 160rem (2560px) @media (width >= 160rem) { ... }
 * 7xl 176rem (2816px) @media (width >= 176rem) { ... }
 * 8xl 192rem (3072px) @media (width >= 192rem) { ... }
 * 9xl 208rem (3328px) @media (width >= 208rem) { ... }
 * 10xl 224rem (3584px) @media (width >= 224rem) { ... }
 */
export const tailwindBreakpoints = {
  '2xl': { max: 1791, min: 1536 },
  '3xl': { max: 2047, min: 1792 },
  '4xl': { max: 2303, min: 2048 },
  '5xl': { max: 2559, min: 2304 },
  '6xl': { max: 2815, min: 2560 },
  '7xl': { max: 3071, min: 2816 },
  '8xl': { max: 3327, min: 3072 },
  '9xl': { max: 3583, min: 3328 },
  '10xl': { max: Infinity, min: 3584 },
  lg: { max: 1279, min: 1024 },
  md: { max: 1023, min: 768 },
  sm: { max: 767, min: 640 },
  xl: { max: 1535, min: 1280 },
}

/**
 * Common screen resolution breakpoints.
 * Mainly for reference or if you want to target specific screen resolutions.
 *
 * - 720p HD 1280×720
 * - 1080p FHD 1920×1080
 * - 2K QHD 2560×1440
 * - 4K UHD 3840×2160
 * - 5K 5120×2880
 * - 8K UHD 7680×4320
 *
 * @see {@link https://en.wikipedia.org/wiki/Display_resolution#Common_display_resolutions}
 */
export const resolutionBreakpoints = {
  '2k': { max: 2560, min: 1921 },
  '4k': { max: 3840, min: 2561 },
  '5k': { max: 7680, min: 3841 },
  '8k': { max: Infinity, min: 7681 },
  '720p': { max: 1280, min: 0 },
  '1080p': { max: 1920, min: 1281 },
}

/**
 * Achieve responsive sizes based on screen width breakpoints.
 * @see {@link https://tailwindcss.com/docs/responsive-design#overview}
 */
export function mapForBreakpoints<B extends Record<string, { min: number; max: number }> = typeof tailwindBreakpoints>(
  basedOn: number,
  sizes: { [key in keyof B]?: number } | number,
  options?: { breakpoints: B },
) {
  if (typeof sizes === 'number') {
    return sizes
  }

  const breakpoints = options?.breakpoints ?? tailwindBreakpoints

  const matched = Object.entries(breakpoints).find(([, b]) => {
    return basedOn >= b.min && basedOn <= b.max
  })

  if (matched) {
    const size = sizes[matched[0]]
    if (size) {
      return size
    }
  }

  // Fallback: find nearest-least smallest breakpoint
  const sortedSizes = Object.entries(sizes)
    .map(([key, value]) => ({ key, min: breakpoints[key as keyof typeof breakpoints]?.min ?? 0, value }))
    .sort((a, b) => b.min - a.min) // Sort descending by min width

  const fallback = sortedSizes.find((s) => s.min <= basedOn)

  return fallback?.value ?? Object.values(sizes)?.[0] ?? 0
}

/**
 * Calculate width based on options similar to how Web CSS does it.
 *
 * @param bounds
 * @param sizeOptions
 * @returns width in pixels
 */
export function widthFrom(bounds: Rectangle, sizeOptions: Size & { min?: Size; max?: Size }) {
  const val = evaluateSize(bounds.width, sizeOptions)
  const min = sizeOptions.min ? evaluateSize(bounds.width, sizeOptions.min) : undefined
  const max = sizeOptions.max ? evaluateSize(bounds.width, sizeOptions.max) : undefined

  if (min && val < min) {
    return min
  }

  if (max && val > max) {
    return max
  }

  return val
}

/**
 * Calculate height based on options similar to how Web CSS does it.
 *
 * @param bounds
 * @param sizeOptions
 * @returns height in pixels
 */
export function heightFrom(bounds: Rectangle, sizeOptions: Size & { min?: Size; max?: Size }) {
  const val = evaluateSize(bounds.height, sizeOptions)
  const min = sizeOptions.min ? evaluateSize(bounds.height, sizeOptions.min) : undefined
  const max = sizeOptions.max ? evaluateSize(bounds.height, sizeOptions.max) : undefined

  if (min && val < min) {
    return min
  }

  if (max && val > max) {
    return max
  }

  return val
}

export function ensureWindowInVisibleBounds(bounds: Rectangle): Rectangle {
  const displays = screen.getAllDisplays()

  const hasOverlap = displays.some((display) => {
    const db = display.bounds
    return (
      bounds.x < db.x + db.width &&
      bounds.x + bounds.width > db.x &&
      bounds.y < db.y + db.height &&
      bounds.y + bounds.height > db.y
    )
  })

  if (hasOverlap) {
    return bounds
  }

  const primaryDisplay = screen.getPrimaryDisplay()
  const workArea = primaryDisplay.workArea

  const x = Math.round(workArea.x + (workArea.width - bounds.width) / 2)
  const y = Math.round(workArea.y + (workArea.height - bounds.height) / 2)

  return {
    height: bounds.height,
    width: bounds.width,
    x,
    y,
  }
}
