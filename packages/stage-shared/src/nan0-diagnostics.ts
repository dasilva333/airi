import type {
  Nan0KernelDiagnosticEvent,
  Nan0KernelObservatoryConfiguration,
} from '@proj-airi/nan0-runtime'

import { defineInvokeEventa } from '@moeru/eventa'

export interface Nan0DiagnosticAppendRequest {
  events: Nan0KernelDiagnosticEvent[]
}

export interface Nan0DiagnosticAppendResult {
  accepted: number
  logFiles: string[]
  error?: string
}

export const nan0DiagnosticsGetConfiguration = defineInvokeEventa<Nan0KernelObservatoryConfiguration>(
  'eventa:invoke:electron:nan0:diagnostics:get-configuration',
)

export const nan0DiagnosticsAppend = defineInvokeEventa<Nan0DiagnosticAppendResult, Nan0DiagnosticAppendRequest>(
  'eventa:invoke:electron:nan0:diagnostics:append',
)
