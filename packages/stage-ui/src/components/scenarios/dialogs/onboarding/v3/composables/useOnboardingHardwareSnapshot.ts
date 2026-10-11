import type { SystemMemoryInfo } from '@proj-airi/stage-shared'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { sensorsGetSystemMemory } from '@proj-airi/stage-shared'
import { detectWebGPU } from '@proj-airi/stage-shared/webgpu'
import { readonly, ref } from 'vue'

export type HardwareSource
  = | 'observed-capability'
    | 'identifying-information'
    | 'measured-system-info'
    | 'approximate'
    | 'estimate'
    | 'user-reported'
    | 'unknown'

export interface HardwareTelemetryField<T> {
  value: T
  source: HardwareSource
  confidence: string
  label?: string
}

export interface OnboardingHardwareSnapshot {
  status: 'checking' | 'ready' | 'unknown'
  webgpu: HardwareTelemetryField<boolean | null>
  fp16: HardwareTelemetryField<boolean | null>
  gpuDeviceName: HardwareTelemetryField<string | null>
  gpuArchitecture: HardwareTelemetryField<string | null>
  systemMemoryBytes: HardwareTelemetryField<number | null>
  estimatedVRAMBytes: HardwareTelemetryField<number | null>
  isElectron: boolean
  error?: string
}

// Module-level singleton state to cache detection once per onboarding session.
// Non-blocking: starts asynchronously, components read reactive state.
let detectionPromise: Promise<void> | null = null

const snapshotState = ref<OnboardingHardwareSnapshot>({
  status: 'checking',
  webgpu: {
    value: null,
    source: 'unknown',
    confidence: 'unknown',
    label: 'WebGPU Acceleration',
  },
  fp16: {
    value: null,
    source: 'unknown',
    confidence: 'unknown',
    label: 'Shader FP16 Support',
  },
  gpuDeviceName: {
    value: null,
    source: 'unknown',
    confidence: 'unknown',
    label: 'Graphics Adapter',
  },
  gpuArchitecture: {
    value: null,
    source: 'unknown',
    confidence: 'unknown',
    label: 'GPU Architecture',
  },
  systemMemoryBytes: {
    value: null,
    source: 'unknown',
    confidence: 'unknown',
    label: 'System Memory',
  },
  estimatedVRAMBytes: {
    value: null,
    source: 'unknown',
    confidence: 'unknown',
    label: 'Estimated VRAM',
  },
  isElectron: false,
})

function withTimeout<T>(promise: Promise<T>, ms = 2500, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

async function probeHardware() {
  const isElectron = typeof window !== 'undefined'
    && (Boolean((window as any).electron) || Boolean((window as any).process?.versions?.electron))
  snapshotState.value.isElectron = isElectron

  let isAnyCheckSuccessful = false

  // 1. WebGPU & Adapter Metadata Probe
  try {
    const caps = await withTimeout(
      detectWebGPU().catch(() => null),
      2500,
      null,
    )

    if (caps && typeof caps.supported === 'boolean') {
      isAnyCheckSuccessful = true
      snapshotState.value.webgpu = {
        value: caps.supported,
        source: 'observed-capability',
        confidence: 'observed capability',
        label: 'WebGPU Acceleration',
      }
      snapshotState.value.fp16 = {
        value: caps.fp16Supported,
        source: 'observed-capability',
        confidence: 'observed capability',
        label: 'Shader FP16 Support',
      }

      if (caps.adapterInfo?.device || caps.adapterInfo?.description || caps.adapterInfo?.vendor) {
        const name = caps.adapterInfo.device || caps.adapterInfo.description || caps.adapterInfo.vendor || null
        snapshotState.value.gpuDeviceName = {
          value: name,
          source: 'identifying-information',
          confidence: 'identifying information, when available',
          label: 'Graphics Adapter',
        }
      }
      if (caps.adapterInfo?.architecture) {
        snapshotState.value.gpuArchitecture = {
          value: caps.adapterInfo.architecture,
          source: 'identifying-information',
          confidence: 'identifying information, when available',
          label: 'GPU Architecture',
        }
      }

      // Record VRAM heuristic as an estimate (NEVER claimed as measured hardware)
      if (caps.estimatedVRAM && caps.estimatedVRAM > 0) {
        snapshotState.value.estimatedVRAMBytes = {
          value: caps.estimatedVRAM,
          source: caps.estimatedVRAMSource === 'override' ? 'user-reported' : 'estimate',
          confidence: caps.estimatedVRAMSource === 'override' ? 'user-reported' : 'heuristic estimate (conservative buffer limit)',
          label: 'Estimated VRAM',
        }
      }
    }
    else {
      // Failed or timed-out check produces an unknown result, not unsupported
      snapshotState.value.webgpu = {
        value: null,
        source: 'unknown',
        confidence: 'unknown',
        label: 'WebGPU Acceleration',
      }
    }
  }
  catch {
    snapshotState.value.webgpu = {
      value: null,
      source: 'unknown',
      confidence: 'unknown',
      label: 'WebGPU Acceleration',
    }
  }

  // 2. System Memory Probe (Electron OS IPC first, Browser deviceMemory fallback)
  try {
    let memoryBytes: number | null = null
    let memSource: HardwareSource = 'unknown'
    let memConfidence = 'unknown'

    if (isElectron) {
      try {
        const getSystemMemoryInvoke = useElectronEventaInvoke(sensorsGetSystemMemory)
        const sysMem = await withTimeout<SystemMemoryInfo | null>(
          getSystemMemoryInvoke().catch(() => null),
          1500,
          null,
        )
        if (sysMem && sysMem.totalBytes > 0) {
          memoryBytes = sysMem.totalBytes
          memSource = 'measured-system-info'
          memConfidence = 'measured system information'
          isAnyCheckSuccessful = true
        }
      }
      catch {
        // Fall through to browser deviceMemory
      }
    }

    if (memoryBytes === null && typeof navigator !== 'undefined' && 'deviceMemory' in navigator) {
      const devMem = (navigator as any).deviceMemory
      if (typeof devMem === 'number' && devMem > 0) {
        memoryBytes = devMem * 1024 * 1024 * 1024
        memSource = 'approximate'
        memConfidence = 'approximate browser device-memory report'
        isAnyCheckSuccessful = true
      }
    }

    if (memoryBytes !== null) {
      snapshotState.value.systemMemoryBytes = {
        value: memoryBytes,
        source: memSource,
        confidence: memConfidence,
        label: 'System Memory',
      }
    }
  }
  catch {
    // Graceful fallback to unknown
  }

  snapshotState.value.status = isAnyCheckSuccessful ? 'ready' : 'unknown'
}

export function useOnboardingHardwareSnapshot() {
  if (!detectionPromise) {
    detectionPromise = probeHardware()
  }

  return {
    snapshot: readonly(snapshotState),
    refresh: () => {
      detectionPromise = probeHardware()
      return detectionPromise
    },
  }
}
