export enum StageEnvironment {
  Web = 'web',
  Capacitor = 'capacitor',
  Tamagotchi = 'tamagotchi',
}

export function isStageWeb(): boolean {
  return !import.meta.env.RUNTIME_ENVIRONMENT || import.meta.env.RUNTIME_ENVIRONMENT === 'browser'
}

export function isStageCapacitor(): boolean {
  return import.meta.env.RUNTIME_ENVIRONMENT === 'capacitor'
}

export function isStageTamagotchi(): boolean {
  return import.meta.env.RUNTIME_ENVIRONMENT === 'electron'
}

export function isUrlMode(mode: 'file' | 'server'): boolean {
  if (!import.meta.env.URL_MODE) {
    return mode === 'server'
  }

  return import.meta.env.URL_MODE === mode
}

export function isApplePlatform(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false
  }

  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) {
    return true
  }

  // Detect iPadOS Safari / WebKit when configured in desktop mode
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
    return true
  }

  return false
}
