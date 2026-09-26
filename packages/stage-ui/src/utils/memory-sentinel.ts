/**
 * In-App Diagnostic Memory Sentinel & Telemetry Probe
 *
 * Runs inside the Electron renderer process to capture exact subsystem state
 * and memory metrics before/after background events and on periodic intervals.
 * Output is logged with `[MEM-PROBE]` to stdout/airi.log.
 */

export interface SubsystemStats {
  action?: string
  extra?: Record<string, any>
}

let lastHeapMB = 0
let sentinelStarted = false

export function logMemoryProbe(tag: string = 'TICK', stats?: SubsystemStats): void {
  try {
    const perf = (typeof performance !== 'undefined' ? performance : null) as any
    const mem = perf?.memory

    const jsHeapUsed = mem?.usedJSHeapSize ? mem.usedJSHeapSize / (1024 * 1024) : 0
    const jsHeapTotal = mem?.totalJSHeapSize ? mem.totalJSHeapSize / (1024 * 1024) : 0
    const jsHeapLimit = mem?.jsHeapSizeLimit ? mem.jsHeapSizeLimit / (1024 * 1024) : 0

    const delta = lastHeapMB > 0 ? (jsHeapUsed - lastHeapMB) : 0
    lastHeapMB = jsHeapUsed

    const deltaStr = delta >= 0 ? `+${delta.toFixed(1)} MB` : `${delta.toFixed(1)} MB`
    const winHash = typeof window !== 'undefined' ? (window.location.hash || '#/') : 'unknown'
    const extraStr = stats?.extra ? ` | Details: ${JSON.stringify(stats.extra)}` : ''
    const actionStr = stats?.action ? ` | Action: [${stats.action}]` : ''

    console.log(
      `[MEM-PROBE] [${tag}] Route: "${winHash}" | JS Heap: ${jsHeapUsed.toFixed(1)} MB / ${jsHeapTotal.toFixed(1)} MB (Limit: ${jsHeapLimit.toFixed(0)} MB, Δ: ${deltaStr})${actionStr}${extraStr}`,
    )
  }
  catch (err) {
    console.warn('[MEM-PROBE] Failed to log memory stats:', err)
  }
}

export function initMemorySentinel(intervalMs = 10000): void {
  if (sentinelStarted)
    return
  sentinelStarted = true

  // Initial boot log
  logMemoryProbe('INIT', { action: 'App startup & sentinel initialization' })

  // Periodic heartbeat log
  if (typeof window !== 'undefined') {
    window.setInterval(() => {
      logMemoryProbe('PERIODIC')
    }, intervalMs)
  }
}
