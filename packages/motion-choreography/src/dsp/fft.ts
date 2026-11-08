/**
 * Fast Fourier Transform (FFT) utilities for spectral analysis.
 * Radix-2 Cooley-Tukey algorithm with zero dependencies.
 */

/**
 * Applies a Hann window in-place to an audio frame.
 */
export function applyHannWindow(frame: Float32Array): void {
  const n = frame.length
  for (let i = 0; i < n; i++) {
    const multiplier = 0.5 * (1.0 - Math.cos((2.0 * Math.PI * i) / (n - 1)))
    frame[i] *= multiplier
  }
}

/**
 * Computes the real FFT of a power-of-2 sized signal.
 * Returns the magnitude spectrum of size (N / 2) + 1.
 */
export function computeMagnitudeSpectrum(signal: Float32Array): Float32Array {
  const n = signal.length
  if ((n & (n - 1)) !== 0) {
    throw new Error(`FFT size must be a power of 2, received ${n}`)
  }

  const real = new Float32Array(n)
  const imag = new Float32Array(n)
  real.set(signal)

  // Bit-reversal permutation
  let j = 0
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tempR = real[i]
      real[i] = real[j]
      real[j] = tempR
      const tempI = imag[i]
      imag[i] = imag[j]
      imag[j] = tempI
    }
    let k = n >> 1
    while (k <= j) {
      j -= k
      k >>= 1
    }
    j += k
  }

  // Cooley-Tukey butterflies
  for (let len = 2; len <= n; len <<= 1) {
    const halfLen = len >> 1
    const angle = (-2.0 * Math.PI) / len
    const wStepR = Math.cos(angle)
    const wStepI = Math.sin(angle)

    for (let i = 0; i < n; i += len) {
      let wR = 1.0
      let wI = 0.0

      for (let k = 0; k < halfLen; k++) {
        const uR = real[i + k]
        const uI = imag[i + k]

        const tR = wR * real[i + k + halfLen] - wI * imag[i + k + halfLen]
        const tI = wR * imag[i + k + halfLen] + wI * real[i + k + halfLen]

        real[i + k] = uR + tR
        imag[i + k] = uI + tI
        real[i + k + halfLen] = uR - tR
        imag[i + k + halfLen] = uI - tI

        const nextWR = wR * wStepR - wI * wStepI
        wI = wR * wStepI + wI * wStepR
        wR = nextWR
      }
    }
  }

  // Half-spectrum magnitudes (from DC to Nyquist)
  const halfN = (n >> 1) + 1
  const magnitudes = new Float32Array(halfN)
  for (let k = 0; k < halfN; k++) {
    magnitudes[k] = Math.sqrt(real[k] * real[k] + imag[k] * imag[k])
  }

  return magnitudes
}

/**
 * Computes spectral centroid (center of mass of the frequency spectrum) in Hertz.
 */
export function computeSpectralCentroid(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
): number {
  const binWidth = sampleRate / fftSize
  let weightedSum = 0
  let totalMagnitude = 0

  for (let i = 0; i < magnitudes.length; i++) {
    const freq = i * binWidth
    const mag = magnitudes[i]
    weightedSum += freq * mag
    totalMagnitude += mag
  }

  if (totalMagnitude === 0) {
    return 0
  }

  return weightedSum / totalMagnitude
}
