/**
 * Preview-only sRGB linearization.
 *
 * The VRM live swap intentionally keeps the legacy NoColorSpace behavior; this
 * table compensates the displayed image so it approximates the re-imported VRM
 * without touching export bytes. Alpha is never modified.
 */

export const SRGB_LINEAR_LUT: Readonly<Uint8Array> = (() => {
  const lut = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    const c = i / 255
    const linear = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    lut[i] = Math.round(linear * 255)
  }
  return lut
})()

export function srgbToLinearByte(value: number): number {
  return SRGB_LINEAR_LUT[value] ?? 0
}

export function linearizeRgba(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    data[i] = SRGB_LINEAR_LUT[data[i]]
    data[i + 1] = SRGB_LINEAR_LUT[data[i + 1]]
    data[i + 2] = SRGB_LINEAR_LUT[data[i + 2]]
  }
}
