/**
 * Centralized debug logging for model loading pipelines.
 * Set localStorage.debug = 'airi:*' to enable all debug output.
 * Set localStorage.debug = 'airi:vrm' or 'airi:live2d' for specific pipelines.
 * Supports comma-separated namespaces: localStorage.debug = 'airi:vrm,airi:live2d'
 */

const DEBUG_PREFIX = 'airi'

function isDebugEnabled(namespace: string): boolean {
  try {
    const debugEnv = localStorage.getItem('debug')
    if (!debugEnv) return false
    return debugEnv
      .split(/[\s,]+/)
      .some(
        (pattern) => pattern === '*' || pattern === `${DEBUG_PREFIX}:*` || pattern === `${DEBUG_PREFIX}:${namespace}`,
      )
  } catch {
    return false
  }
}

function formatTime(): string {
  return new Date().toISOString().slice(11, 23)
}

export function createLogger(namespace: string) {
  return {
    error: (...args: unknown[]) => {
      console.error(`[${formatTime()}] [${DEBUG_PREFIX}:${namespace}]`, ...args)
    },
    info: (...args: unknown[]) => {
      if (isDebugEnabled(namespace)) {
        console.info(`[${formatTime()}] [${DEBUG_PREFIX}:${namespace}]`, ...args)
      }
    },
    log: (...args: unknown[]) => {
      if (isDebugEnabled(namespace)) {
        console.log(`[${formatTime()}] [${DEBUG_PREFIX}:${namespace}]`, ...args)
      }
    },
    time: (label: string) => {
      if (isDebugEnabled(namespace)) {
        console.time(`[${DEBUG_PREFIX}:${namespace}] ${label}`)
      }
    },
    timeEnd: (label: string) => {
      if (isDebugEnabled(namespace)) {
        console.timeEnd(`[${DEBUG_PREFIX}:${namespace}] ${label}`)
      }
    },
    warn: (...args: unknown[]) => {
      console.warn(`[${formatTime()}] [${DEBUG_PREFIX}:${namespace}]`, ...args)
    },
  }
}

export const vrmLogger = createLogger('vrm')
export const live2dLogger = createLogger('live2d')
export const rendererLogger = createLogger('renderer')
