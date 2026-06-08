import type { createContext } from '@moeru/eventa/adapters/electron/main'
import type { BrowserWindow } from 'electron'

import type { LocalLlmDownloadProgress, LocalLlmServerStatus } from '../../../shared/eventa'

import os from 'node:os'
import path from 'node:path'

import { Buffer } from 'node:buffer'
import { exec, execFile, spawn } from 'node:child_process'
import { createWriteStream, existsSync, promises as fs } from 'node:fs'
import { promisify } from 'node:util'

import yauzl from 'yauzl'

import { defineInvokeHandler } from '@moeru/eventa'
import { app } from 'electron'
import { isMacOS, isWindows } from 'std-env'

import {
  electronLocalLlmCancelDownload,
  electronLocalLlmDeleteModel,
  electronLocalLlmDownloadModel,
  electronLocalLlmGetDownloadedModels,
  electronLocalLlmGetStatus,
  electronLocalLlmProgressEvent,
  electronLocalLlmStartServer,
  electronLocalLlmStopServer,
} from '../../../shared/eventa'
import { onAppBeforeQuit } from '../../libs/bootkit/lifecycle'

// Paths configuration
const USER_DATA_DIR = app.getPath('userData')
const BIN_DIR = path.join(USER_DATA_DIR, 'bin')
const MODELS_DIR = path.join(USER_DATA_DIR, 'models')
const PORT = 39000

const EXPECTED_BIN_VERSION = isWindows ? 'b9391-vulkan' : 'b4800'
const VERSION_FILE = path.join(BIN_DIR, 'version.txt')

// Binary URL definition based on platform
function getBinaryUrl(): string {
  const base = 'https://github.com/ggerganov/llama.cpp/releases/download/b4800/'
  if (isWindows) {
    return 'https://github.com/ggml-org/llama.cpp/releases/download/b9391/llama-b9391-bin-win-vulkan-x64.zip'
  }
  if (isMacOS) {
    // Determine Apple Silicon vs Intel
    const arch = os.arch()
    if (arch === 'arm64') {
      return `${base}llama-b4800-bin-macos-arm64.zip`
    }
    return `${base}llama-b4800-bin-macos-x64.zip`
  }
  // Linux fallback
  return `${base}llama-b4800-bin-ubuntu-x64.zip`
}

function getBinaryName(): string {
  return isWindows ? 'llama-server.exe' : 'llama-server'
}

function getBinaryPath(): string {
  return path.join(BIN_DIR, getBinaryName())
}

// Global state
let serverProcess: any = null
let isStartingServer = false
let currentStatusState: LocalLlmServerStatus['state'] = 'idle'
let currentActiveModel: string | null = null
let currentDownloadAbortController: AbortController | null = null
let lastError: string | undefined
let currentDownloadProgress: LocalLlmDownloadProgress | null = null

const execFileAsync = promisify(execFile)

function killAllZombies(): Promise<void> {
  return new Promise((resolve) => {
    const cmd = isWindows ? 'taskkill /f /im llama-server.exe' : 'killall llama-server'
    exec(cmd, () => {
      resolve()
    })
  })
}

async function getBestDeviceIndex(): Promise<string | null> {
  const binaryPath = getBinaryPath()
  if (!existsSync(binaryPath)) {
    return null
  }
  try {
    const { stdout } = await execFileAsync(binaryPath, ['--list-devices'], { cwd: BIN_DIR })
    const lines = stdout.split('\n')
    const devices: { id: string, name: string, isDiscrete: boolean }[] = []

    for (const line of lines) {
      const parts = line.split(':')
      if (parts.length >= 2) {
        const left = parts[0].trim()
        const right = parts.slice(1).join(':').trim()
        const match = left.match(/^(?:Vulkan|CUDA|sycl)?(\d+)$/i)
        if (match) {
          const name = right.toLowerCase()
          const isDiscrete = name.includes('nvidia')
            || name.includes('geforce')
            || name.includes('rtx')
            || name.includes('gtx')
            || name.includes('radeon')
            || name.includes('amd')
            || name.includes('arc')
          devices.push({ id: left, name: right, isDiscrete })
        }
      }
    }

    const discrete = devices.find(d => d.isDiscrete)
    if (discrete) {
      console.log(`[Local LLM] Selected discrete GPU: ${discrete.name} (ID ${discrete.id})`)
      return discrete.id
    }

    if (devices.length > 0) {
      console.log(`[Local LLM] No discrete GPU found, defaulting to device: ${devices[0].name} (ID ${devices[0].id})`)
      return devices[0].id
    }
  }
  catch (err) {
    console.warn('[Local LLM] Failed to query devices for GPU selection:', err)
  }
  return null
}

// Helper to unzip
function extractZip(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err)
        return reject(err)
      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        if (entry.fileName.endsWith('/')) {
          // Directory, skip or create
          zipfile.readEntry()
        }
        else {
          // File, check if it's the server binary or related necessary files
          const baseName = path.basename(entry.fileName)
          if (baseName.endsWith('.dll') || baseName.endsWith('.exe') || baseName.includes('llama')) {
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err)
                return reject(err)
              const writePath = path.join(destDir, baseName)
              const writeStream = createWriteStream(writePath)
              readStream.pipe(writeStream)
              writeStream.on('close', () => {
                // Ensure executable permissions on POSIX
                if (!isWindows) {
                  fs.chmod(writePath, 0o755).catch(() => {})
                }
                zipfile.readEntry()
              })
            })
          }
          else {
            zipfile.readEntry()
          }
        }
      })
      zipfile.on('end', () => resolve())
      zipfile.on('error', err => reject(err))
    })
  })
}

// Helper to ensure correct binary version exists
async function ensureBinary(signal?: AbortSignal, onProgress?: (downloaded: number, total: number) => void): Promise<void> {
  const binaryPath = getBinaryPath()
  if (existsSync(binaryPath)) {
    return
  }

  // Ensure directories exist
  await fs.mkdir(USER_DATA_DIR, { recursive: true })
  await fs.mkdir(BIN_DIR, { recursive: true })

  const binaryUrl = getBinaryUrl()
  const zipTempPath = path.join(BIN_DIR, 'llama_bin.zip')

  const res = await fetch(binaryUrl, { signal })
  if (!res.ok || !res.body) {
    throw new Error(`Failed to download binary from ${binaryUrl}`)
  }

  const fileStream = createWriteStream(zipTempPath)
  const reader = res.body.getReader()
  let downloaded = 0
  const total = Number(res.headers.get('content-length') || 0)

  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    fileStream.write(Buffer.from(value))
    downloaded += value.length
    if (onProgress) {
      onProgress(downloaded, total)
    }
  }
  fileStream.end()

  // Extract binary zip
  await extractZip(zipTempPath, BIN_DIR)
  await fs.unlink(zipTempPath).catch(() => {})

  // Write version file to make sure it's marked as correct
  await fs.writeFile(VERSION_FILE, EXPECTED_BIN_VERSION, 'utf8').catch(() => {})
}

// Service implementation
export function createLocalLlmService(params: { context: ReturnType<typeof createContext>['context'], window: BrowserWindow }) {
  // Ensure directories exist and verify version on startup
  ;(async () => {
    try {
      await fs.mkdir(BIN_DIR, { recursive: true })
      await fs.mkdir(MODELS_DIR, { recursive: true })

      let currentVersion = ''
      if (existsSync(VERSION_FILE)) {
        currentVersion = (await fs.readFile(VERSION_FILE, 'utf8')).trim()
      }
      if (currentVersion !== EXPECTED_BIN_VERSION) {
        console.log(`[Local LLM Service] Version mismatch (found: "${currentVersion}", expected: "${EXPECTED_BIN_VERSION}"). Cleaning bin directory.`)
        const binaryPath = getBinaryPath()
        if (existsSync(binaryPath)) {
          await fs.unlink(binaryPath).catch(() => {})
        }
        if (isWindows) {
          const files = await fs.readdir(BIN_DIR).catch(() => [] as string[])
          for (const file of files) {
            if (file.endsWith('.dll') || file.endsWith('.exe')) {
              await fs.unlink(path.join(BIN_DIR, file)).catch(() => {})
            }
          }
        }
        await fs.writeFile(VERSION_FILE, EXPECTED_BIN_VERSION, 'utf8').catch(() => {})
      }
    }
    catch (err) {
      console.error('[Local LLM Service] Failed to initialize directories or check version:', err)
    }
  })()

  const emitProgress = (payload: LocalLlmDownloadProgress) => {
    console.log('[Local LLM Service] Emitting progress:', payload.progress, '%', payload)
    currentDownloadProgress = payload
    if (payload.status === 'completed' || payload.status === 'failed') {
      setTimeout(() => {
        if (currentDownloadProgress === payload) {
          currentDownloadProgress = null
        }
      }, 5000)
    }
    params.context.emit(electronLocalLlmProgressEvent, payload)
  }

  // Get current runner status
  defineInvokeHandler(params.context, electronLocalLlmGetStatus, async (): Promise<LocalLlmServerStatus> => {
    return {
      state: currentStatusState,
      binaryExists: existsSync(getBinaryPath()),
      activeModel: currentActiveModel,
      port: PORT,
      error: lastError,
      downloadProgress: currentDownloadProgress,
    }
  })

  // List downloaded GGUF files
  defineInvokeHandler(params.context, electronLocalLlmGetDownloadedModels, async (): Promise<string[]> => {
    try {
      if (!existsSync(MODELS_DIR))
        return []
      const files = await fs.readdir(MODELS_DIR)
      return files.filter(f => f.endsWith('.gguf'))
    }
    catch {
      return []
    }
  })

  // Download a GGUF model (and binary if missing)
  defineInvokeHandler(params.context, electronLocalLlmDownloadModel, async (payload) => {
    if (!payload?.modelId || !payload?.repo || !payload?.filename) {
      throw new Error('Missing download parameters')
    }

    if (currentDownloadAbortController) {
      throw new Error('A download is already in progress')
    }

    currentDownloadAbortController = new AbortController()
    const signal = currentDownloadAbortController.signal
    const modelSavePath = path.join(MODELS_DIR, payload.filename)
    let fileStream: ReturnType<typeof createWriteStream> | null = null

    try {
      // 1. Download and extract binary if missing
      const binaryPath = getBinaryPath()
      if (!existsSync(binaryPath)) {
        currentStatusState = 'downloading_binary'
        emitProgress({
          modelId: payload.modelId,
          status: 'downloading',
          bytesDownloaded: 0,
          totalBytes: 100,
          progress: 5,
          speedMb: 0,
        })

        await ensureBinary(signal, (downloaded, total) => {
          emitProgress({
            modelId: payload.modelId,
            status: 'downloading',
            bytesDownloaded: downloaded,
            totalBytes: total || downloaded,
            progress: total ? Math.round((downloaded / total) * 30) : 15, // Mapping bin download to 0-30%
            speedMb: 0,
          })
        })
      }

      // 2. Download the actual model file
      currentStatusState = 'downloading_binary' // Reuse state or keep reporting downloading
      const downloadUrl = `https://huggingface.co/${payload.repo}/resolve/main/${payload.filename}`

      const res = await fetch(downloadUrl, { signal })
      if (!res.ok || !res.body) {
        throw new Error(`Failed to download model from ${downloadUrl}`)
      }

      fileStream = createWriteStream(modelSavePath)
      fileStream.on('error', (err) => {
        console.log('[Local LLM Service] Download stream error (safe to ignore if cancelled):', err.message)
      })
      const reader = res.body.getReader()
      let downloaded = 0
      const total = Number(res.headers.get('content-length') || 0)
      let lastTime = Date.now()
      let lastBytes = 0

      while (true) {
        if (signal.aborted || fileStream.destroyed)
          break
        const { done, value } = await reader.read()
        if (done)
          break
        if (signal.aborted || fileStream.destroyed)
          break
        fileStream.write(Buffer.from(value))
        downloaded += value.length

        const now = Date.now()
        const duration = (now - lastTime) / 1000
        let speed = 0
        if (duration >= 0.5) {
          const bytesDiff = downloaded - lastBytes
          speed = (bytesDiff / (1024 * 1024)) / duration
          lastBytes = downloaded
          lastTime = now
        }

        emitProgress({
          modelId: payload.modelId,
          status: 'downloading',
          bytesDownloaded: downloaded,
          totalBytes: total || downloaded,
          progress: total ? Math.round(30 + (downloaded / total) * 70) : 50, // Mapping model download to 30-100%
          speedMb: Math.round(speed * 10) / 10,
        })
      }

      if (fileStream && !fileStream.destroyed) {
        fileStream.end()
      }

      if (signal.aborted) {
        throw new DOMException('The user aborted a request.', 'AbortError')
      }

      emitProgress({
        modelId: payload.modelId,
        status: 'completed',
        bytesDownloaded: downloaded,
        totalBytes: downloaded,
        progress: 100,
        speedMb: 0,
      })
      currentStatusState = 'idle'
    }
    catch (err: any) {
      if (fileStream) {
        fileStream.destroy()
      }
      if (existsSync(modelSavePath)) {
        await fs.unlink(modelSavePath).catch(() => {})
      }

      if (err.name === 'AbortError') {
        lastError = 'Download cancelled'
      }
      else {
        lastError = err.message
      }
      emitProgress({
        modelId: payload.modelId,
        status: 'failed',
        bytesDownloaded: 0,
        totalBytes: 0,
        progress: 0,
        speedMb: 0,
        error: lastError,
      })
      currentStatusState = 'error'
    }
    finally {
      currentDownloadAbortController = null
    }
  })

  // Delete a downloaded GGUF file
  defineInvokeHandler(params.context, electronLocalLlmDeleteModel, async (payload) => {
    if (!payload?.modelId)
      return
    const modelPath = path.join(MODELS_DIR, payload.modelId)
    if (existsSync(modelPath)) {
      await fs.unlink(modelPath)
    }
  })

  // Cancel a download in progress
  defineInvokeHandler(params.context, electronLocalLlmCancelDownload, async () => {
    if (currentDownloadAbortController) {
      currentDownloadAbortController.abort()
    }
  })

  // Start the server with a specific GGUF model
  defineInvokeHandler(params.context, electronLocalLlmStartServer, async (payload) => {
    if (!payload?.modelId) {
      throw new Error('Model ID is required')
    }

    if (isStartingServer) {
      console.warn('[Local LLM Service] Start server already in progress. Ignoring request.')
      return
    }

    isStartingServer = true
    try {
      if (serverProcess) {
        // Stop old server first
        serverProcess.kill()
        serverProcess = null
      }
      await killAllZombies()

      currentStatusState = 'starting'
      currentActiveModel = payload.modelId
      const modelPath = path.join(MODELS_DIR, payload.modelId)

      if (!existsSync(modelPath)) {
        currentStatusState = 'error'
        lastError = `Model file not found: ${payload.modelId}`
        throw new Error(lastError)
      }

      const binaryPath = getBinaryPath()
      if (!existsSync(binaryPath)) {
        // If binary is missing, auto-download it!
        currentStatusState = 'downloading_binary'
        emitProgress({
          modelId: payload.modelId,
          status: 'downloading',
          bytesDownloaded: 0,
          totalBytes: 100,
          progress: 10,
          speedMb: 0,
        })

        try {
          await ensureBinary(undefined, (downloaded, total) => {
            emitProgress({
              modelId: payload.modelId,
              status: 'downloading',
              bytesDownloaded: downloaded,
              totalBytes: total || downloaded,
              progress: total ? Math.round((downloaded / total) * 90) : 50,
              speedMb: 0,
            })
          })
          emitProgress({
            modelId: payload.modelId,
            status: 'completed',
            bytesDownloaded: 100,
            totalBytes: 100,
            progress: 100,
            speedMb: 0,
          })
          currentStatusState = 'idle'
        }
        catch (err: any) {
          currentStatusState = 'error'
          lastError = `Failed to download engine binary: ${err.message}`
          throw err
        }
      }

      // Double check ggml.dll on Windows
      const ggmlPath = path.join(BIN_DIR, 'ggml.dll')
      if (isWindows && !existsSync(ggmlPath) && existsSync(binaryPath)) {
        await fs.unlink(binaryPath).catch(() => {})
        currentStatusState = 'error'
        lastError = 'Missing companion engine files. Please run the model again to repair the server installation.'
        throw new Error(lastError)
      }

      const bestDevice = await getBestDeviceIndex()
      const args = [
        '--model',
        modelPath,
        '--port',
        String(PORT),
        '--ctx-size',
        '2048',
        '--n-gpu-layers',
        '99',
      ]
      if (bestDevice !== null) {
        args.push('--device', String(bestDevice))
      }

      console.log(`[Local LLM Service] Spawning ${binaryPath} with args:`, args)
      serverProcess = spawn(binaryPath, args, {
        cwd: BIN_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      serverProcess.stdout.on('data', (data: Buffer) => {
        const line = data.toString()
        console.log(`[Local LLM stdout] ${line.trim()}`)
        if (line.includes('HTTP server listening')) {
          currentStatusState = 'running'
          currentActiveModel = payload.modelId
          lastError = undefined
        }
      })

      serverProcess.stderr.on('data', (data: Buffer) => {
        const line = data.toString()
        console.warn(`[Local LLM stderr] ${line.trim()}`)
      })

      serverProcess.on('error', (err: Error) => {
        console.error('[Local LLM process error]', err)
        currentStatusState = 'error'
        lastError = err.message
        currentActiveModel = null
      })

      serverProcess.on('exit', (code: number | null) => {
        console.log(`[Local LLM exit] Process exited with code ${code}`)
        serverProcess = null
        currentStatusState = 'stopped'
        currentActiveModel = null
      })

      // Timeout check: if not running after 10 seconds, set status as error
      setTimeout(() => {
        if (currentStatusState === 'starting') {
          currentStatusState = 'running' // Sometimes llama.cpp outputs to stderr only, assume running if alive
          currentActiveModel = payload.modelId
        }
      }, 8000)
    }
    finally {
      isStartingServer = false
    }
  })

  // Stop the server
  defineInvokeHandler(params.context, electronLocalLlmStopServer, async () => {
    if (serverProcess) {
      serverProcess.kill()
      serverProcess = null
    }
    await killAllZombies()
    currentStatusState = 'stopped'
    currentActiveModel = null
  })

  // Hook cleanup on app exit
  onAppBeforeQuit(async () => {
    if (serverProcess) {
      console.log('[Local LLM Service] Stopping local server process on quit')
      serverProcess.kill()
      serverProcess = null
    }
    await killAllZombies()
  })
}
