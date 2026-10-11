export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface CommandLogEntry {
  id: string
  command: string
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
  timestamp: number
}

export interface VirtualFileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
}

export interface MountedWidget {
  path: string
  code: string
  mountedAt: number
}

export interface SandboxVfsSessionProjection {
  activeSessionId: string
  characterName: string
  messageCount: number
  lastMessageAt: string | null
  hoursSinceLastMessage: number | null
  createdAt: string | null
}

export interface SandboxVfsCognitionProjection {
  character: {
    name: string
    description?: string
  }
  consciousness: {
    activeProvider: string
    activeModel: string
  }
}

export interface SandboxVfsTelemetryProjection {
  idleTimeSec: number
  activeProgram: string
  activeWindowTitle: string
  windowHistory: Array<{
    processName: string
    title: string
    durationMs: number
  }>
  cpuLoad: [number, number, number]
  gpuAvg: number
  volumeLevel: number
  localTime: string
  usageMetrics: {
    ttsHourly: number
    sttHourly: number
    chatHourly: number
    journalHourly: number
    turnCount: number
  }
}

export interface SandboxVfsMessageItem {
  id: string
  role: string
  createdAt?: string
  content: string
}

export type SandboxChannelMessage
  = | { type: 'sync-request', requestId: string }
    | { type: 'sync-response', requestId: string, commandLogs: CommandLogEntry[] }
    | { type: 'command-log', entry: CommandLogEntry }
    | { type: 'exec', requestId: string, command: string }
    | { type: 'exec-done', requestId: string, result: ExecResult }
    | { type: 'exec-error', requestId: string, error: string }
    | { type: 'list-files', requestId: string, dir: string }
    | { type: 'list-files-done', requestId: string, entries: VirtualFileEntry[] }
    | { type: 'read-file', requestId: string, path: string }
    | { type: 'read-file-done', requestId: string, content: string }
    | { type: 'read-file-error', requestId: string, error: string }
    | { type: 'write-file', requestId: string, path: string, content: string }
    | { type: 'write-file-done', requestId: string }
    | { type: 'clear-logs' }
    | { type: 'reset', requestId: string }
    | { type: 'reset-done', requestId: string }
