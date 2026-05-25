/**
 * Centralized debug logging for model loading pipelines.
 * Set localStorage.debug = 'airi:*' to enable all debug output.
 * Set localStorage.debug = 'airi:vrm' or 'airi:live2d' for specific pipelines.
 */

const DEBUG_PREFIX = 'airi'

function isDebugEnabled(namespace?: string): boolean {
  try {
    const debugEnv = localStorage.getItem('debug')
    if (!debugEnv)
      return false
    if (namespace)
      return debugEnv.includes(`${DEBUG_PREFIX}:${namespace}`) || debugEnv.includes(`${DEBUG_PREFIX}:*`) || debugEnv === '*'
    return debugEnv.includes(`${DEBUG_PREFIX}:`) || debugEnv === '*'
  } catch {
    return false
  }
}

function formatTime(): string {
  return new Date().toISOString().slice(11, 23)
}

export function createLogger(namespace: string) {
  const enabled = isDebugEnabled(namespace)

  return {
    log: (...args: unknown[]) => {
      if (enabled || isDebugEnabled()) {
        console.log(`[${formatTime()}] [${DEBUG_PREFIX}:${namespace}]`, ...args)
      }
    },
    warn: (...args: unknown[]) => {
      console.warn(`[${formatTime()}] [${DEBUG_PREFIX}:${namespace}]`, ...args)
    },
    error: (...args: unknown[]) => {
      console.error(`[${formatTime()}] [${DEBUG_PREFIX}:${namespace}]`, ...args)
    },
    info: (...args: unknown[]) => {
      if (enabled || isDebugEnabled()) {
        console.info(`[${formatTime()}] [${DEBUG_PREFIX}:${namespace}]`, ...args)
      }
    },
    time: (label: string) => {
      if (enabled || isDebugEnabled()) {
        console.time(`[${DEBUG_PREFIX}:${namespace}] ${label}`)
      }
    },
    timeEnd: (label: string) => {
      if (enabled || isDebugEnabled()) {
        console.timeEnd(`[${DEBUG_PREFIX}:${namespace}] ${label}`)
      }
    },
  }
}

export const vrmLogger = createLogger('vrm')
export const live2dLogger = createLogger('live2d')
export const rendererLogger = createLogger('renderer')
