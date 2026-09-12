/**
 * The HTTP contract of a VOICEVOX-family speech engine (VOICEVOX, AivisSpeech).
 */

type VoicevoxEngineEndpoint = 'audio_query' | 'speakers' | 'synthesis' | 'version'

const VOICEVOX_ENGINE_PATHS: Record<VoicevoxEngineEndpoint, string> = {
  audio_query: 'audio_query',
  speakers: 'speakers',
  synthesis: 'synthesis',
  version: 'version',
}

const POST_ENDPOINTS = new Set<VoicevoxEngineEndpoint>(['audio_query', 'synthesis'])

interface VoicevoxEngineRequest {
  baseUrl: string
  body?: unknown
  endpoint: VoicevoxEngineEndpoint
  query?: Record<string, string>
}

export interface VoicevoxEngineRequestOptions {
  fetch?: typeof globalThis.fetch
  signal?: AbortSignal
}

export interface VoicevoxAudioQuery {
  [field: string]: unknown
  intonationScale: number
  pitchScale: number
  speedScale: number
  volumeScale: number
}

export interface VoicevoxSpeakerStyle {
  id: number
  name: string
  type?: string
}

export interface VoicevoxSpeaker {
  name: string
  speaker_uuid?: string
  styles: VoicevoxSpeakerStyle[]
}

export interface VoicevoxSynthesisParameters {
  intonation?: number
  pitch?: number
  speed?: number
  volume?: number
}

export function applyVoicevoxParameters(
  audioQuery: VoicevoxAudioQuery,
  parameters: VoicevoxSynthesisParameters,
): VoicevoxAudioQuery {
  if (typeof parameters.speed === 'number')
    audioQuery.speedScale = parameters.speed
  if (typeof parameters.pitch === 'number')
    audioQuery.pitchScale = parameters.pitch
  if (typeof parameters.intonation === 'number')
    audioQuery.intonationScale = parameters.intonation
  if (typeof parameters.volume === 'number')
    audioQuery.volumeScale = parameters.volume

  return audioQuery
}

export async function fetchEngineVersion(
  baseUrl: string,
  options?: VoicevoxEngineRequestOptions,
): Promise<string> {
  const response = await request({ baseUrl, endpoint: 'version' }, options)
  return (await response.text()).replace(/^"|"$/g, '')
}

export async function fetchSpeakers(
  baseUrl: string,
  options?: VoicevoxEngineRequestOptions,
): Promise<VoicevoxSpeaker[]> {
  const response = await request({ baseUrl, endpoint: 'speakers' }, options)
  const speakers = await decodeJson<VoicevoxSpeaker[]>(response, 'speakers')
  return Array.isArray(speakers) ? speakers : []
}

export async function synthesizeSpeech(
  baseUrl: string,
  synthesis: { parameters?: VoicevoxSynthesisParameters, styleId: string, text: string },
  options?: VoicevoxEngineRequestOptions,
): Promise<ArrayBuffer> {
  const query = { speaker: synthesis.styleId, text: synthesis.text }
  const audioQueryResponse = await request({ baseUrl, endpoint: 'audio_query', query }, options)
  const audioQuery = applyVoicevoxParameters(
    await decodeJson<VoicevoxAudioQuery>(audioQueryResponse, 'audio_query'),
    synthesis.parameters ?? {},
  )

  const synthesisResponse = await request(
    { baseUrl, body: audioQuery, endpoint: 'synthesis', query: { speaker: synthesis.styleId } },
    options,
  )

  return await synthesisResponse.arrayBuffer()
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim()
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`
}

function buildUrl(engineRequest: VoicevoxEngineRequest): URL {
  const url = new URL(VOICEVOX_ENGINE_PATHS[engineRequest.endpoint], normalizeBaseUrl(engineRequest.baseUrl))
  for (const [key, value] of Object.entries(engineRequest.query ?? {}))
    url.searchParams.set(key, value)

  return url
}

async function decodeJson<T>(response: Response, endpoint: string): Promise<T> {
  const body = await response.text()
  try {
    return JSON.parse(body) as T
  }
  catch {
    throw new Error(`Speech engine answered /${endpoint} with a body that is not JSON. Check that the Base URL points at a VOICEVOX-compatible engine.`)
  }
}

async function request(
  engineRequest: VoicevoxEngineRequest,
  options?: VoicevoxEngineRequestOptions,
): Promise<Response> {
  let url: URL
  try {
    url = buildUrl(engineRequest)
  }
  catch {
    throw new Error('The Base URL is not an absolute http:// or https:// address.')
  }

  const doFetch = options?.fetch ?? globalThis.fetch
  const response = await doFetch(url, {
    method: POST_ENDPOINTS.has(engineRequest.endpoint) ? 'POST' : 'GET',
    redirect: 'error',
    signal: options?.signal,
    ...(engineRequest.body === undefined
      ? {}
      : { body: JSON.stringify(engineRequest.body), headers: { 'Content-Type': 'application/json' } }),
  })

  if (!response.ok) {
    const detail = (await response.text()).trim()
    const suffix = detail ? `: ${detail.slice(0, 200)}` : ''
    throw new Error(`Speech engine answered ${response.status} ${response.statusText} for /${engineRequest.endpoint}${suffix}`)
  }

  return response
}
