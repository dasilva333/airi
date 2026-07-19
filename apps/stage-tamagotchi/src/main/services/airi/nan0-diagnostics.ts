import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type { Nan0KernelDiagnosticEvent } from '@proj-airi/nan0-runtime'

import { appendFile, mkdir } from 'node:fs/promises'
import { isAbsolute, join, relative, resolve } from 'node:path'

import { defineInvokeHandler } from '@moeru/eventa'
import {
  formatNan0DiagnosticConsoleLine,
  resolveNan0KernelObservatoryConfiguration,
  serializeNan0DiagnosticJsonl,
} from '@proj-airi/nan0-runtime'
import { nan0DiagnosticsAppend, nan0DiagnosticsGetConfiguration } from '@proj-airi/stage-shared'
import { app } from 'electron'

const MAX_EVENTS_PER_BATCH = 128
const MAX_EVENT_BYTES = 256 * 1024

function safeLogDirectory(configured: string): string {
  const userData = app.getPath('userData')
  if (/^(?:\\\\|\/\/)/.test(configured))
    return join(userData, 'logs')
  if (isAbsolute(configured))
    return configured
  const candidate = resolve(userData, configured)
  const fromUserData = relative(userData, candidate)
  return fromUserData.startsWith('..') || isAbsolute(fromUserData)
    ? join(userData, 'logs')
    : candidate
}

function validEvent(value: unknown): value is Nan0KernelDiagnosticEvent {
  if (!value || typeof value !== 'object')
    return false
  const event = value as Partial<Nan0KernelDiagnosticEvent>
  return event.schemaVersion === 1
    && typeof event.eventId === 'string'
    && typeof event.event === 'string'
    && typeof event.timestamp === 'number'
    && Number.isFinite(event.timestamp)
}

function eventDate(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

export function createNan0DiagnosticsService(params: {
  context: ReturnType<typeof createContext>['context']
}) {
  const configuration = resolveNan0KernelObservatoryConfiguration(process.env)
  const logDirectory = safeLogDirectory(configuration.logDirectory)
  let writeChain = Promise.resolve<string[]>([])
  let writeFailureReported = false

  defineInvokeHandler(params.context, nan0DiagnosticsGetConfiguration, () => configuration)
  defineInvokeHandler(params.context, nan0DiagnosticsAppend, async (payload) => {
    if (!configuration.enabled)
      return { accepted: 0, logFiles: [] }

    const events = (Array.isArray(payload?.events) ? payload.events : [])
      .slice(0, MAX_EVENTS_PER_BATCH)
      .filter(validEvent)
      .filter(event => Buffer.byteLength(serializeNan0DiagnosticJsonl(event), 'utf8') <= MAX_EVENT_BYTES)

    if (configuration.console) {
      for (const event of events) {
        const line = formatNan0DiagnosticConsoleLine(event, configuration.verbose)
        if (line)
          console.info(line)
      }
    }
    if (!configuration.jsonl || !events.length)
      return { accepted: events.length, logFiles: [] }

    writeChain = writeChain.then(async () => {
      await mkdir(logDirectory, { recursive: true })
      const grouped = new Map<string, Nan0KernelDiagnosticEvent[]>()
      for (const event of events) {
        const date = eventDate(event.timestamp)
        grouped.set(date, [...(grouped.get(date) ?? []), event])
      }
      const paths: string[] = []
      for (const [date, datedEvents] of grouped) {
        const path = join(logDirectory, `nan0-kernel-${date}.jsonl`)
        const content = `${datedEvents.map(serializeNan0DiagnosticJsonl).join('\n')}\n`
        await appendFile(path, content, 'utf8')
        paths.push(path)
      }
      return paths
    }).catch((error) => {
      if (!writeFailureReported) {
        writeFailureReported = true
        console.error(`[Nan0 Observatory] JSONL write failed; cognition is unaffected: ${error instanceof Error ? error.message : String(error)}`)
      }
      return []
    })

    const logFiles = await writeChain
    return { accepted: events.length, logFiles }
  })

  return {
    configuration,
    async flush() {
      await writeChain
    },
  }
}
