import type { EventContext } from '@moeru/eventa'
import type { Analyser, AnalyserBeatEvent, AnalyserWorkletParameters } from '@nekopaw/tempora'

import type { BeatSyncDetectorEventMap, BeatSyncDetectorState, BeatSyncVibe } from './types'

import analyserWorklet from '@nekopaw/tempora/worklet?url'

import { defineInvoke, defineInvokeHandler } from '@moeru/eventa'
import { startAnalyser as startTemporaAnalyser } from '@nekopaw/tempora'
import { setupElectronScreenCapture } from '@proj-airi/electron-screen-capture/renderer'

import { isStageTamagotchi, isStageWeb, StageEnvironment } from '../environment'
import { isElectronWindow } from '../window'
import {
  beatSyncBeatSignaledInvokeEventa,
  beatSyncGetInputByteFrequencyDataInvokeEventa,
  beatSyncGetStateInvokeEventa,
  beatSyncStateChangedInvokeEventa,
  beatSyncToggleInvokeEventa,
  beatSyncUpdateParametersInvokeEventa,
  beatSyncUpdateVibeParametersInvokeEventa,
  beatSyncVibeSignaledInvokeEventa,
  createContext,
  electronEnsureBeatSync,
} from './eventa'
import { BEAT_SYNC_ANALYSIS_INTERVAL_MS, BEAT_SYNC_HIT_COOLDOWN_MS, BEAT_SYNC_HIT_THRESHOLD } from './settings'
import { BeatSyncTempoEstimator, BeatSyncVibeTracker } from './vibe'

export const inputAnalyserFFTSize = 1024

export interface BeatSyncDetector {
  start: (createSource: (context: AudioContext) => Promise<AudioNode>) => Promise<void>
  updateParameters: (params: Partial<AnalyserWorkletParameters>) => void
  updateVibeParameters: (params: { energyGain?: number }) => void
  startScreenCapture: () => Promise<void>
  stop: () => void
  on: <E extends keyof BeatSyncDetectorEventMap>(event: E, listener: BeatSyncDetectorEventMap[E]) => () => void
  off: <E extends keyof BeatSyncDetectorEventMap>(event: E, listener: BeatSyncDetectorEventMap[E]) => void
  getInputByteFrequencyData: () => Uint8Array<ArrayBuffer>
  readonly state: BeatSyncDetectorState
  readonly context: AudioContext | undefined
  readonly analyser: Analyser | undefined
  readonly source: AudioNode | undefined
}

export type CreateBeatSyncDetectorOptions
  = | { env: StageEnvironment.Tamagotchi }
    | { env: StageEnvironment.Web }
    | { env: StageEnvironment.Capacitor }

export function createBeatSyncDetector(options: CreateBeatSyncDetectorOptions): BeatSyncDetector {
  let context: AudioContext | undefined
  let analyser: Analyser | undefined
  let source: AudioNode | undefined
  const state = {
    isActive: false,
  }

  let stopSource: (() => void) | undefined

  let inputAnalyserNode: AnalyserNode | undefined
  let inputAnalyserBuffer: Uint8Array<ArrayBuffer> | undefined

  let vibeAnalyserNode: AnalyserNode | undefined
  let vibeTimeDomainBuffer: Uint8Array<ArrayBuffer> | undefined
  let vibeFrequencyBuffer: Uint8Array<ArrayBuffer> | undefined
  let vibeInterval: ReturnType<typeof setInterval> | undefined
  const vibeTracker = new BeatSyncVibeTracker()
  const tempoEstimator = new BeatSyncTempoEstimator()

  const listeners: { [K in keyof BeatSyncDetectorEventMap]: Array<(...args: any) => void> } = {
    stateChange: [],
    beat: [],
    vibe: [],
  }

  const emit = <E extends keyof BeatSyncDetectorEventMap>(event: E, ...args: Parameters<BeatSyncDetectorEventMap[E]>) => {
    listeners[event].forEach(listener => listener(...args))
  }

  const stopVibeLoop = () => {
    if (vibeInterval) {
      clearInterval(vibeInterval)
      vibeInterval = undefined
    }
  }

  const startVibeLoop = () => {
    stopVibeLoop()
    let lastBeatAt = Number.NEGATIVE_INFINITY
    vibeInterval = setInterval(() => {
      try {
        if (!vibeAnalyserNode || !vibeTimeDomainBuffer || !vibeFrequencyBuffer)
          return

        vibeAnalyserNode.getByteTimeDomainData(vibeTimeDomainBuffer)
        vibeAnalyserNode.getByteFrequencyData(vibeFrequencyBuffer)
        const now = performance.now()
        const vibe = vibeTracker.update(vibeTimeDomainBuffer, vibeFrequencyBuffer)
        const isHit = vibe.hit >= BEAT_SYNC_HIT_THRESHOLD
          && now - lastBeatAt >= BEAT_SYNC_HIT_COOLDOWN_MS
        if (isHit) {
          lastBeatAt = now
          tempoEstimator.noteHit(now)
        }
        emit('vibe', { ...vibe, ...tempoEstimator.update(vibe.hit) })
      }
      catch (error) {
        console.warn('[beat-sync] Vibe analysis failed', error)
      }
    }, BEAT_SYNC_ANALYSIS_INTERVAL_MS)
  }

  const stop = () => {
    if (!state.isActive)
      return

    state.isActive = false
    emit('stateChange', state)
    stopVibeLoop()
    vibeTracker.reset()
    tempoEstimator.reset()
    stopSource?.()
    stopSource = undefined

    if (vibeAnalyserNode) {
      vibeAnalyserNode.disconnect()
      vibeAnalyserNode = undefined
      vibeTimeDomainBuffer = undefined
      vibeFrequencyBuffer = undefined
    }

    if (inputAnalyserNode) {
      inputAnalyserNode.disconnect()
      inputAnalyserNode = undefined
      inputAnalyserBuffer = undefined
    }

    source?.disconnect()
    source = undefined

    analyser?.stop()
    analyser = undefined

    context?.close()
    context = undefined
  }

  const start = async (createSource: (context: AudioContext) => Promise<AudioNode>) => {
    stop()

    context = new AudioContext()
    analyser = await startTemporaAnalyser({
      context,
      worklet: analyserWorklet,
      listeners: {
        onBeat: e => emit('beat', e),
      },
    })

    const node = await createSource(context)

    inputAnalyserNode = context.createAnalyser()
    inputAnalyserNode.fftSize = inputAnalyserFFTSize // Fast Fourier Transform size (power of 2, 32-32768)
    // A smaller fftSize gives better time resolution but worse frequency resolution.
    inputAnalyserNode.smoothingTimeConstant = 0.8 // A value between 0 and 1. Higher value smooths out changes.
    inputAnalyserBuffer = new Uint8Array(inputAnalyserNode.frequencyBinCount)

    vibeAnalyserNode = context.createAnalyser()
    vibeAnalyserNode.fftSize = 2048
    vibeAnalyserNode.smoothingTimeConstant = 0.2
    vibeTimeDomainBuffer = new Uint8Array(vibeAnalyserNode.fftSize)
    vibeFrequencyBuffer = new Uint8Array(vibeAnalyserNode.frequencyBinCount)

    node.connect(inputAnalyserNode)
    node.connect(vibeAnalyserNode)
    inputAnalyserNode.connect(analyser?.workletNode)

    source = node

    state.isActive = true
    emit('stateChange', state)
    startVibeLoop()
  }

  const updateParameters = (params: Partial<AnalyserWorkletParameters>) => {
    analyser?.updateParameters(params)
  }

  const updateVibeParameters = (params: { energyGain?: number }) => {
    if (params.energyGain !== undefined)
      vibeTracker.setEnergyGain(params.energyGain)
  }

  const startScreenCapture = async () => start(async (ctx) => {
    switch (options.env) {
      case StageEnvironment.Web: {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
          video: true,
        })

        if (stream.getAudioTracks().length === 0) {
          throw new Error('No audio track available in the stream')
        }

        stream.getAudioTracks().forEach((track) => {
          let stopCalled = false
          track.addEventListener('ended', () => {
            if (stopCalled)
              return
            stopCalled = true
            stop()
          })
        })

        const node = ctx.createMediaStreamSource(stream)
        stopSource = () => {
          stream.getTracks().forEach(track => track.stop())
        }

        return node
      }
      case StageEnvironment.Tamagotchi: {
        if (!isElectronWindow(window)) {
          throw new Error(`Electron window is required for this environment: ${options.env}`)
        }

        // FIXME(Makito): Will refactor later
        const { createContext } = await import('@moeru/eventa/adapters/electron/renderer')
        const { selectWithSource } = setupElectronScreenCapture(createContext(window.electron.ipcRenderer).context)

        const stream = await selectWithSource(
          (sources) => {
            if (sources.length === 0)
              throw new Error('No screen source available')
            return sources[0].id
          },
          async () => await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          }),
          { sourcesOptions: { types: ['screen'] } },
        )

        const videoTracks = stream.getVideoTracks()

        videoTracks.forEach((track) => {
          track.stop()
          stream.removeTrack(track)
        })

        const node = ctx.createMediaStreamSource(stream)
        stopSource = () => {
          stream.getTracks().forEach(track => track.stop())
        }

        return node
      }
      default:
        throw new Error('Failed to start screen capture: Unsupported environment')
    }
  })

  const off = <E extends keyof BeatSyncDetectorEventMap>(event: E, listener: BeatSyncDetectorEventMap[E]) => {
    const listenerFns = listeners[event]
    if (!listenerFns) {
      throw new Error(`Unknown event: ${event}`)
    }

    const index = listenerFns.indexOf(listener)
    if (index !== -1)
      listenerFns.splice(index, 1)
  }

  const on = <E extends keyof BeatSyncDetectorEventMap>(event: E, listener: BeatSyncDetectorEventMap[E]) => {
    const listenerFns = listeners[event]
    if (!listenerFns) {
      throw new Error(`Unknown event: ${event}`)
    }
    listenerFns.push(listener)
    return () => off(event, listener)
  }

  const getInputByteFrequencyData = () => {
    inputAnalyserNode?.getByteFrequencyData(inputAnalyserBuffer!)
    return inputAnalyserBuffer!
  }

  return {
    start,
    updateParameters,
    updateVibeParameters,
    startScreenCapture,
    stop,
    on,
    off,
    getInputByteFrequencyData,

    get state() { return state },
    get context() { return context },
    get analyser() { return analyser },
    get source() { return source },
  }
}

let detector: BeatSyncDetector | undefined
function getDetector() {
  if (!isStageWeb())
    throw new Error('getDetector() is only available in Stage Web environment')

  if (!detector)
    detector = createBeatSyncDetector({ env: StageEnvironment.Web })

  return detector
}

let context: EventContext<any, any> | undefined
function getContext() {
  if (!context)
    context = createContext()

  return context
}

let electronMainContext: EventContext<any, any> | undefined
async function ensureElectronBeatSyncWindow() {
  if (!isStageTamagotchi())
    return
  if (typeof window === 'undefined' || !isElectronWindow(window))
    return

  if (!electronMainContext) {
    const { createContext } = await import('@moeru/eventa/adapters/electron/renderer')
    electronMainContext = createContext(window.electron.ipcRenderer).context
  }
  await defineInvoke(electronMainContext, electronEnsureBeatSync)()
}

export async function toggleBeatSync(enabled: boolean) {
  if (isStageWeb()) {
    if (enabled) {
      return getDetector().startScreenCapture()
    }
    else {
      return getDetector().stop()
    }
  }

  if (isStageTamagotchi()) {
    await ensureElectronBeatSyncWindow()
    const toggleFn = defineInvoke(getContext(), beatSyncToggleInvokeEventa)
    return toggleFn(enabled)
  }

  throw new Error('Unknown environment for beatSyncToggle()')
}

export async function getBeatSyncState() {
  if (isStageWeb()) {
    return getDetector().state
  }

  if (isStageTamagotchi()) {
    await ensureElectronBeatSyncWindow()
    return defineInvoke(getContext(), beatSyncGetStateInvokeEventa)()
  }

  throw new Error('Unknown environment for getBeatSyncState()')
}

export async function updateBeatSyncParameters(params: Partial<AnalyserWorkletParameters>) {
  if (isStageWeb()) {
    return getDetector().updateParameters(params)
  }

  if (isStageTamagotchi()) {
    await ensureElectronBeatSyncWindow()
    return defineInvoke(getContext(), beatSyncUpdateParametersInvokeEventa)(params)
  }

  throw new Error('Unknown environment for updateBeatSyncParameters()')
}

export function listenBeatSyncStateChange(listener: (state: BeatSyncDetectorState) => void) {
  if (isStageWeb()) {
    return getDetector().on('stateChange', listener)
  }

  if (isStageTamagotchi()) {
    return defineInvokeHandler(getContext(), beatSyncStateChangedInvokeEventa, listener)
  }

  throw new Error('Unknown environment for listenBeatSyncStateChange()')
}

export function listenBeatSyncBeatSignal(listener: (e: AnalyserBeatEvent) => void) {
  if (isStageWeb()) {
    return getDetector().on('beat', listener)
  }

  if (isStageTamagotchi()) {
    return defineInvokeHandler(getContext(), beatSyncBeatSignaledInvokeEventa, listener)
  }

  throw new Error('Unknown environment for listenBeatSyncBeatSignal()')
}

export async function getBeatSyncInputByteFrequencyData() {
  if (isStageWeb()) {
    return getDetector().getInputByteFrequencyData()
  }

  if (isStageTamagotchi()) {
    await ensureElectronBeatSyncWindow()
    return defineInvoke(getContext(), beatSyncGetInputByteFrequencyDataInvokeEventa)()
  }

  throw new Error('Unknown environment for getBeatSyncInputByteFrequencyData()')
}

export async function updateBeatSyncVibeParameters(params: { energyGain?: number }) {
  if (isStageWeb()) {
    return getDetector().updateVibeParameters(params)
  }

  if (isStageTamagotchi()) {
    await ensureElectronBeatSyncWindow()
    return defineInvoke(getContext(), beatSyncUpdateVibeParametersInvokeEventa)(params)
  }

  throw new Error('Unknown environment for updateBeatSyncVibeParameters()')
}

export function listenBeatSyncVibeSignal(listener: (vibe: BeatSyncVibe) => void) {
  if (isStageWeb()) {
    return getDetector().on('vibe', listener)
  }

  if (isStageTamagotchi()) {
    return defineInvokeHandler(getContext(), beatSyncVibeSignaledInvokeEventa, listener)
  }

  throw new Error('Unknown environment for listenBeatSyncVibeSignal()')
}
