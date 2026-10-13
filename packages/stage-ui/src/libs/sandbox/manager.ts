import type { CommandLogEntry, ExecResult, MountedWidget, SandboxChannelMessage, VirtualFileEntry } from './types'

import { defineInvoke, defineInvokeEventa } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/renderer'
import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { Bash } from 'just-bash'

import { widgetsRepo } from '../../database/repos/widgets.repo'
import { tryGetMcpToolBridge } from '../../stores/mcp-tool-bridge'
import { compileTypeScriptInSandbox } from './compiler-bridge'
import { createVirtualJevEnvironment, handleJevCommand } from './jev'
import {
  buildCognitionProjection,
  buildMessagesProjection,
  buildSessionProjection,
  buildTelemetryProjection,
} from './projections'

export function isMainWindow(): boolean {
  if (typeof window === 'undefined')
    return true
  if (!isStageTamagotchi())
    return true
  const hash = window.location.hash || ''
  return hash === '' || hash === '#/' || hash === '#' || hash === '#!/'
}

const SANDBOX_CHANNEL_NAME = 'airi:sandbox:channel'

export class SandboxManager {
  private bash: Bash
  private mountedWidgetsList: MountedWidget[] = []
  private mountListeners: Array<(widget: MountedWidget) => void> = []
  private commandLogs: CommandLogEntry[] = []
  private commandListeners: Array<(log: CommandLogEntry) => void> = []
  private channel: BroadcastChannel | null = null
  private isLeader = true
  private pendingRequests = new Map<string, { resolve: (val: any) => void, reject: (err: any) => void, timeout: ReturnType<typeof setTimeout> }>()
  private suppressStateSyncPaths = new Set<string>()
  private windowMessageListener: ((event: MessageEvent) => void) | null = null

  constructor() {
    this.bash = new Bash({
      cwd: '/workspace',
    })
    this.registerCustomCommands()
  }

  async init(): Promise<void> {
    this.isLeader = isMainWindow()
    this.setupWindowMessageListener()

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(SANDBOX_CHANNEL_NAME)
        this.setupChannelListeners()
      }
      catch (err) {
        console.warn('[SandboxManager] Failed to create BroadcastChannel:', err)
      }
    }

    if (this.isLeader) {
      await this.seedWorkspace()
      await this.syncProjections()
      await this.rehydrateMountedWidgets()
    }
    else {
      // In follower window (e.g. Chat Window), request initial state/logs from leader
      await this.requestInitialSync()
      if (this.mountedWidgetsList.length === 0) {
        await this.rehydrateMountedWidgets()
      }
    }
  }

  get mountedWidgets(): MountedWidget[] {
    return [...this.mountedWidgetsList]
  }

  get commandHistory(): CommandLogEntry[] {
    return [...this.commandLogs]
  }

  onMount(listener: (widget: MountedWidget) => void): () => void {
    this.mountListeners.push(listener)
    return () => {
      const idx = this.mountListeners.indexOf(listener)
      if (idx !== -1)
        this.mountListeners.splice(idx, 1)
    }
  }

  onCommand(listener: (log: CommandLogEntry) => void): () => void {
    this.commandListeners.push(listener)
    return () => {
      const idx = this.commandListeners.indexOf(listener)
      if (idx !== -1)
        this.commandListeners.splice(idx, 1)
    }
  }

  private setupChannelListeners(): void {
    if (!this.channel)
      return

    this.channel.onmessage = async (event: MessageEvent<SandboxChannelMessage>) => {
      const msg = event.data
      if (!msg)
        return

      if (this.isLeader) {
        switch (msg.type) {
          case 'sync-request': {
            this.channel?.postMessage({
              type: 'sync-response',
              requestId: msg.requestId,
              commandLogs: [...this.commandLogs],
              mountedWidgets: [...this.mountedWidgetsList],
            })
            break
          }
          case 'exec': {
            try {
              const res = await this.execInternal(msg.command)
              this.channel?.postMessage({
                type: 'exec-done',
                requestId: msg.requestId,
                result: res,
              })
            }
            catch (err: any) {
              this.channel?.postMessage({
                type: 'exec-error',
                requestId: msg.requestId,
                error: err.message,
              })
            }
            break
          }
          case 'list-files': {
            const entries = await this.listFilesInternal(msg.dir)
            this.channel?.postMessage({
              type: 'list-files-done',
              requestId: msg.requestId,
              entries,
            })
            break
          }
          case 'read-file': {
            try {
              const content = await this.readFileInternal(msg.path)
              this.channel?.postMessage({
                type: 'read-file-done',
                requestId: msg.requestId,
                content,
              })
            }
            catch (err: any) {
              this.channel?.postMessage({
                type: 'read-file-error',
                requestId: msg.requestId,
                error: err.message,
              })
            }
            break
          }
          case 'write-file': {
            try {
              await this.writeFileInternal(msg.path, msg.content)
              this.channel?.postMessage({
                type: 'write-file-done',
                requestId: msg.requestId,
              })
            }
            catch (err: any) {
              console.warn('[SandboxManager] Leader write-file failed:', err)
            }
            break
          }
          case 'clear-logs': {
            this.commandLogs = []
            this.notifyCommandListeners()
            break
          }
          case 'widget-unmount': {
            this.mountedWidgetsList = this.mountedWidgetsList.filter(w => w.id !== msg.id && w.path !== msg.id)
            this.notifyMountListeners()
            break
          }
          case 'widget-clear': {
            this.mountedWidgetsList = []
            this.notifyMountListeners()
            break
          }
          case 'widget-state-update': {
            await this.handleWidgetStateUpdate(msg.id, msg.path, msg.state)
            break
          }
          case 'widget-state-sync': {
            const widget = this.mountedWidgetsList.find(w => w.id === msg.id || w.path === msg.path)
            if (widget) {
              widget.state = msg.state
            }
            if (typeof document !== 'undefined') {
              const iframes = Array.from(document.querySelectorAll('iframe'))
              for (const iframe of iframes) {
                try {
                  iframe.contentWindow?.postMessage(msg, '*')
                }
                catch {}
              }
            }
            break
          }
          case 'reset': {
            await this.resetInternal()
            this.channel?.postMessage({
              type: 'reset-done',
              requestId: msg.requestId,
            })
            break
          }
        }
      }
      else {
        switch (msg.type) {
          case 'sync-response': {
            if (msg.commandLogs) {
              this.commandLogs = [...msg.commandLogs]
              this.notifyCommandListeners()
            }
            if (msg.mountedWidgets) {
              this.mountedWidgetsList = [...msg.mountedWidgets]
              this.notifyMountListeners()
            }
            this.resolvePending(msg.requestId, msg.commandLogs)
            break
          }
          case 'widget-mount': {
            const existingIdx = this.mountedWidgetsList.findIndex(w => w.path === msg.widget.path || w.id === msg.widget.id)
            if (existingIdx >= 0) {
              this.mountedWidgetsList[existingIdx] = msg.widget
            }
            else {
              this.mountedWidgetsList.push(msg.widget)
            }
            this.notifyMountListeners(msg.widget)
            break
          }
          case 'widget-unmount': {
            this.mountedWidgetsList = this.mountedWidgetsList.filter(w => w.id !== msg.id && w.path !== msg.id)
            this.notifyMountListeners()
            break
          }
          case 'widget-clear': {
            this.mountedWidgetsList = []
            this.notifyMountListeners()
            break
          }
          case 'widget-state-sync': {
            const widget = this.mountedWidgetsList.find(w => w.id === msg.id || w.path === msg.path)
            if (widget) {
              widget.state = msg.state
            }
            if (typeof document !== 'undefined') {
              const iframes = Array.from(document.querySelectorAll('iframe'))
              for (const iframe of iframes) {
                try {
                  iframe.contentWindow?.postMessage(msg, '*')
                }
                catch {}
              }
            }
            break
          }
          case 'command-log': {
            const exists = this.commandLogs.some(e => e.id === msg.entry.id)
            if (!exists) {
              this.commandLogs.push(msg.entry)
              if (this.commandLogs.length > 100) {
                this.commandLogs.shift()
              }
              this.notifyCommandListeners(msg.entry)
            }
            break
          }
          case 'exec-done': {
            this.resolvePending(msg.requestId, msg.result)
            break
          }
          case 'exec-error': {
            this.rejectPending(msg.requestId, new Error(msg.error))
            break
          }
          case 'list-files-done': {
            this.resolvePending(msg.requestId, msg.entries)
            break
          }
          case 'read-file-done': {
            this.resolvePending(msg.requestId, msg.content)
            break
          }
          case 'read-file-error': {
            this.rejectPending(msg.requestId, new Error(msg.error))
            break
          }
          case 'write-file-done': {
            this.resolvePending(msg.requestId, undefined)
            break
          }
          case 'clear-logs': {
            this.commandLogs = []
            this.notifyCommandListeners()
            break
          }
          case 'reset-done': {
            this.commandLogs = []
            this.mountedWidgetsList = []
            this.notifyCommandListeners()
            this.resolvePending(msg.requestId, undefined)
            break
          }
        }
      }
    }
  }

  private setupWindowMessageListener(): void {
    if (typeof window === 'undefined' || this.windowMessageListener)
      return

    this.windowMessageListener = async (event: MessageEvent) => {
      const msg = event.data
      if (!msg || msg.type !== 'widget-state-update')
        return

      const { id, path, state } = msg
      await this.handleWidgetStateUpdate(id, path, state)
    }

    window.addEventListener('message', this.windowMessageListener)
  }

  async handleWidgetStateUpdate(id: string, path: string, state: any): Promise<void> {
    const widget = this.mountedWidgetsList.find(w => w.id === id || w.path === path)
    if (widget) {
      widget.state = state
    }

    try {
      await widgetsRepo.updateWidgetState(id || path, state)
    }
    catch (err) {
      console.warn('[SandboxManager] Failed to persist widget state in repo:', err)
    }

    const targetPath = widget?.sourcePath || widget?.path || path
    if (targetPath) {
      const jsonPath = targetPath.replace(/\.(ts|js|html)$/, '.json')
      const jsonStr = JSON.stringify(state, null, 2)
      if (widget) {
        widget._lastSyncedJsonContent = jsonStr
      }
      this.suppressStateSyncPaths.add(jsonPath)
      try {
        await this.writeFile(jsonPath, jsonStr)
      }
      catch (err) {
        console.warn(`[SandboxManager] Failed to write sidecar state file ${jsonPath}:`, err)
      }
      finally {
        this.suppressStateSyncPaths.delete(jsonPath)
      }
    }

    this.broadcastWidgetStateSync(widget?.id || id, widget?.path || path, state)
  }

  async checkWidgetStateFiles(specificPath?: string): Promise<void> {
    for (const widget of this.mountedWidgetsList) {
      const targetPath = widget.sourcePath || widget.path
      if (!targetPath)
        continue
      const jsonPath = targetPath.replace(/\.(ts|js|html)$/, '.json')
      if (specificPath && specificPath !== jsonPath)
        continue
      if (this.suppressStateSyncPaths.has(jsonPath))
        continue

      try {
        if (await this.bash.fs.exists(jsonPath)) {
          const content = await this.bash.readFile(jsonPath)
          if (content && content !== widget._lastSyncedJsonContent) {
            widget._lastSyncedJsonContent = content
            let parsed: any
            try {
              parsed = JSON.parse(content)
            }
            catch {
              continue
            }
            widget.state = parsed
            try {
              await widgetsRepo.updateWidgetState(widget.id, parsed)
            }
            catch {}
            this.broadcastWidgetStateSync(widget.id, widget.path, parsed)
          }
        }
      }
      catch {}
    }
  }

  private broadcastWidgetStateSync(id: string, path: string, state: any): void {
    if (this.channel) {
      try {
        this.channel.postMessage({
          type: 'widget-state-sync',
          id,
          path,
          state,
        })
      }
      catch {}
    }

    if (typeof document !== 'undefined') {
      try {
        const iframes = Array.from(document.querySelectorAll('iframe'))
        for (const iframe of iframes) {
          iframe.contentWindow?.postMessage({
            type: 'widget-state-sync',
            id,
            path,
            state,
          }, '*')
        }
      }
      catch {}
    }
  }

  private async requestInitialSync(): Promise<void> {
    if (!this.channel)
      return
    const requestId = `sync-${Date.now()}`
    try {
      await this.sendRpc('sync-request', { type: 'sync-request', requestId }, 600)
    }
    catch {
      // Leader not yet booted or offline
    }
  }

  private sendRpc<T>(_action: string, message: SandboxChannelMessage, timeoutMs = 15000): Promise<T> {
    const requestId = (message as any).requestId
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Sandbox RPC timeout: ${requestId}`))
      }, timeoutMs)

      this.pendingRequests.set(requestId, { resolve, reject, timeout })
      this.channel?.postMessage(message)
    })
  }

  private resolvePending(requestId: string, val: any): void {
    const req = this.pendingRequests.get(requestId)
    if (req) {
      clearTimeout(req.timeout)
      this.pendingRequests.delete(requestId)
      req.resolve(val)
    }
  }

  private rejectPending(requestId: string, err: any): void {
    const req = this.pendingRequests.get(requestId)
    if (req) {
      clearTimeout(req.timeout)
      this.pendingRequests.delete(requestId)
      req.reject(err)
    }
  }

  private notifyCommandListeners(entry?: CommandLogEntry): void {
    const target = entry || this.commandLogs[this.commandLogs.length - 1]
    for (const listener of this.commandListeners) {
      try {
        if (target)
          listener(target)
      }
      catch (err) {
        console.error('[Sandbox] Command listener error:', err)
      }
    }
  }

  private notifyMountListeners(widget?: MountedWidget): void {
    const target = widget || this.mountedWidgetsList[this.mountedWidgetsList.length - 1] || ({ path: '', code: '', id: '', mountedAt: 0 } as MountedWidget)
    for (const listener of this.mountListeners) {
      try {
        listener(target)
      }
      catch (err) {
        console.error('[Sandbox] Mount listener error:', err)
      }
    }
  }

  private postChannelMessage(message: any): void {
    if (!this.channel)
      return
    try {
      const clean = JSON.parse(JSON.stringify(message))
      this.channel.postMessage(clean)
    }
    catch (err) {
      console.warn('[SandboxManager] Failed to post message to BroadcastChannel:', err)
    }
  }

  unmountWidget(idOrPath: string): void {
    this.mountedWidgetsList = this.mountedWidgetsList.filter(w => w.id !== idOrPath && w.path !== idOrPath)
    this.postChannelMessage({ type: 'widget-unmount', id: idOrPath })
    void widgetsRepo.setMounted(idOrPath, false).catch((err) => {
      console.warn('[SandboxManager] Failed to update unmount state in widgetsRepo:', err)
    })
    this.notifyMountListeners()
  }

  async setWidgetSurface(idOrPath: string, surface: 'panel' | 'widget'): Promise<void> {
    const w = this.mountedWidgetsList.find(x => x.id === idOrPath || x.path === idOrPath)
    if (w) {
      w.surface = surface
      w.target = surface === 'widget' ? 'window' : 'sidepanel'
      await widgetsRepo.saveWidget({
        ...w,
        title: w.title || 'Widget',
        surface,
        target: w.target,
        isMounted: true,
        updatedAt: Date.now(),
      }).catch((err) => {
        console.warn('[SandboxManager] Failed to update widget surface in widgetsRepo:', err)
      })
      this.postChannelMessage({ type: 'widget-mount', widget: w })
      this.notifyMountListeners(w)

      // If switching to standalone widget surface and Electron is available, pop out the standalone desktop window
      if (surface === 'widget' && typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
        try {
          const win = window as any
          const { context } = createContext(win.electron.ipcRenderer as any)
          const widgetsAddEventa = defineInvokeEventa<string | undefined, any>('eventa:invoke:electron:windows:widgets:add')
          const invokeAddWidget = defineInvoke(context, widgetsAddEventa)
          await invokeAddWidget({
            id: w.id,
            componentName: 'generative',
            componentProps: {
              id: w.id,
              title: w.title,
              path: w.path,
              code: w.code,
            },
            size: 'm',
            ttlMs: 0,
          })
        }
        catch (err) {
          console.warn('[SandboxManager] Failed to invoke widgetsAdd for breakout widget window:', err)
        }
      }
    }
  }

  async updateWidgetPosition(idOrPath: string, position: { x: number, y: number }): Promise<void> {
    const w = this.mountedWidgetsList.find(x => x.id === idOrPath || x.path === idOrPath)
    if (w) {
      w.position = position
      await widgetsRepo.updateWidgetPosition(w.id, position).catch((err) => {
        console.warn('[SandboxManager] Failed to update widget position in widgetsRepo:', err)
      })
      this.postChannelMessage({ type: 'widget-mount', widget: w })
      // NOTICE: same-window followers (floating layer) only refresh via
      // mount listeners; without this the drag position never propagates.
      this.notifyMountListeners(w)
    }
  }

  clearWidgets(): void {
    this.mountedWidgetsList = []
    this.postChannelMessage({ type: 'widget-clear' })
    void widgetsRepo.clearMounted().catch((err) => {
      console.warn('[SandboxManager] Failed to clear mounted widgets in widgetsRepo:', err)
    })
    this.notifyMountListeners()
  }

  async mountPersistedWidget(idOrPath: string, surfaceOverride?: 'panel' | 'widget'): Promise<MountedWidget | null> {
    const all = await widgetsRepo.getWidgets()
    const target = all.find(w =>
      w.id === idOrPath
      || w.path === idOrPath
      || w.sourcePath === idOrPath
      || w.title?.toLowerCase() === idOrPath.toLowerCase(),
    )
    if (!target)
      return null

    // 1. Re-seed files into VFS
    if (target.sourcePath && target.sourceCode) {
      try {
        await this.bash.fs.writeFile(target.sourcePath, target.sourceCode)
      }
      catch {}
    }
    if (target.path && target.code) {
      try {
        await this.bash.fs.writeFile(target.path, target.code)
      }
      catch {}
    }

    const surface = surfaceOverride || target.surface || (target.target === 'window' ? 'widget' : 'panel')
    const targetMode = target.target || (surface === 'widget' ? 'window' : 'sidepanel')

    // 2. Add or update mounted list
    const widget: MountedWidget = {
      id: target.id,
      path: target.path,
      sourcePath: target.sourcePath,
      sourceCode: target.sourceCode,
      code: target.code,
      title: target.title,
      surface,
      target: targetMode,
      position: target.position,
      state: target.state,
      mountedAt: Date.now(),
    }

    const existingIdx = this.mountedWidgetsList.findIndex(w => w.id === target.id || w.path === target.path)
    if (existingIdx >= 0) {
      this.mountedWidgetsList[existingIdx] = widget
    }
    else {
      this.mountedWidgetsList.push(widget)
    }

    // 3. Mark mounted in repo and update surface
    await widgetsRepo.saveWidget({
      ...target,
      surface,
      target: targetMode,
      isMounted: true,
      updatedAt: Date.now(),
    }).catch(() => {})

    // 4. Broadcast & notify
    this.postChannelMessage({ type: 'widget-mount', widget })
    this.notifyMountListeners(widget)

    return widget
  }

  clearLogs(): void {
    this.commandLogs = []
    if (this.channel) {
      this.channel.postMessage({ type: 'clear-logs' })
    }
    this.notifyCommandListeners()
  }

  private registerCustomCommands(): void {
    // 1. TypeScript compiler (tsc & tsc-rs)
    this.bash.registerCommand({
      name: 'tsc',
      execute: async (args, ctx) => compileTypeScriptInSandbox(args, ctx),
    })

    this.bash.registerCommand({
      name: 'tsc-rs',
      execute: async (args, ctx) => compileTypeScriptInSandbox(args, ctx),
    })

    // 2. Generative UI mount / show commands
    const mountHandler = async (args: string[], ctx: any) => {
      const file = args[0]
      if (!file) {
        return {
          stdout: '',
          stderr: 'Usage: mount_widget <file.ts|file.js|file.html> [--title <title>] [--surface panel|widget]\n',
          exitCode: 1,
        }
      }
      let fullPath = file.startsWith('/') ? file : `${ctx.cwd || '/workspace'}/${file}`

      // Auto-compile if .ts
      if (fullPath.endsWith('.ts')) {
        const jsPath = fullPath.replace(/\.ts$/, '.js')
        const compileRes = await compileTypeScriptInSandbox([fullPath, '--module', 'esnext', '--target', 'es2022', '--lib', 'es2022,dom'], ctx)
        if (compileRes.exitCode !== 0) {
          return {
            stdout: compileRes.stdout,
            stderr: `mount_widget: TypeScript compilation failed for ${fullPath}:\n${compileRes.stderr}`,
            exitCode: compileRes.exitCode,
          }
        }
        if (await ctx.fs.exists(jsPath)) {
          fullPath = jsPath
        }
      }

      let exists = await ctx.fs.exists(fullPath)
      let foundInRepo: any = null
      if (!exists) {
        const allPersisted = await widgetsRepo.getWidgets()
        foundInRepo = allPersisted.find(w =>
          w.id === file
          || w.path === file
          || w.path === fullPath
          || w.sourcePath === file
          || w.sourcePath === fullPath
          || w.title?.toLowerCase() === file.toLowerCase(),
        )

        if (foundInRepo) {
          // Re-seed files from repo into VFS
          if (foundInRepo.sourcePath && foundInRepo.sourceCode) {
            try {
              await ctx.fs.writeFile(foundInRepo.sourcePath, foundInRepo.sourceCode)
            }
            catch {}
          }
          if (foundInRepo.path && foundInRepo.code) {
            try {
              await ctx.fs.writeFile(foundInRepo.path, foundInRepo.code)
            }
            catch {}
          }
          fullPath = foundInRepo.path
          exists = await ctx.fs.exists(fullPath)
        }
      }

      if (!exists) {
        return {
          stdout: '',
          stderr: `mount_widget: File not found: ${fullPath}\nTip: Run 'list_widgets' to view all persisted widgets.\n`,
          exitCode: 1,
        }
      }

      const code = await ctx.fs.readFile(fullPath)

      // Parse optional args: --surface panel|widget (default panel), --target legacy support
      let surface: 'panel' | 'widget' = 'panel'
      let title: string | undefined
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--surface' && args[i + 1]) {
          const val = args[++i].toLowerCase()
          if (val === 'widget' || val === 'window')
            surface = 'widget'
          else
            surface = 'panel'
        }
        else if (args[i] === '--target' && args[i + 1]) {
          const val = args[++i].toLowerCase()
          if (val === 'window' || val === 'widget')
            surface = 'widget'
          else
            surface = 'panel'
        }
        else if (args[i] === '--title' && args[i + 1]) {
          title = args[++i]
        }
      }
      if (!title) {
        title = foundInRepo?.title || fullPath.split('/').pop() || 'Widget'
      }

      let sourcePath: string | undefined
      let sourceCode: string | undefined
      if (file.endsWith('.ts')) {
        sourcePath = file.startsWith('/') ? file : `${ctx.cwd || '/workspace'}/${file}`
        try {
          if (await ctx.fs.exists(sourcePath)) {
            sourceCode = await ctx.fs.readFile(sourcePath)
          }
        }
        catch {}
      }
      if (!sourcePath && foundInRepo?.sourcePath) {
        sourcePath = foundInRepo.sourcePath
        sourceCode = foundInRepo.sourceCode
      }

      // Check for existing sidecar state file or persisted state
      const jsonCandidatePath = (sourcePath || fullPath).replace(/\.(ts|js|html)$/, '.json')
      let preloadedState: any = foundInRepo?.state
      let lastSyncedJsonContent: string | undefined
      try {
        if (await ctx.fs.exists(jsonCandidatePath)) {
          const raw = await ctx.fs.readFile(jsonCandidatePath)
          if (raw && raw.trim()) {
            preloadedState = JSON.parse(raw)
            lastSyncedJsonContent = raw
          }
        }
      }
      catch {}

      // If state was persisted in repo but .json file doesn't exist yet in VFS, lazily write it
      if (!lastSyncedJsonContent && preloadedState && Object.keys(preloadedState).length > 0) {
        try {
          const jsonStr = JSON.stringify(preloadedState, null, 2)
          await ctx.fs.writeFile(jsonCandidatePath, jsonStr)
          lastSyncedJsonContent = jsonStr
        }
        catch {}
      }

      const target: 'sidepanel' | 'inline' | 'window' = surface === 'widget' ? 'window' : 'sidepanel'
      const widget: MountedWidget = {
        id: foundInRepo?.id || `widget-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        path: fullPath,
        sourcePath,
        sourceCode,
        code,
        title,
        surface,
        target,
        state: preloadedState,
        _lastSyncedJsonContent: lastSyncedJsonContent,
        mountedAt: Date.now(),
      }

      const existingIdx = this.mountedWidgetsList.findIndex(w => w.id === widget.id || w.path === fullPath)
      if (existingIdx >= 0) {
        this.mountedWidgetsList[existingIdx] = widget
      }
      else {
        this.mountedWidgetsList.push(widget)
      }

      void widgetsRepo.saveWidget({
        id: widget.id,
        title: widget.title || title || 'Widget',
        path: fullPath,
        sourcePath,
        sourceCode,
        code,
        surface,
        target,
        state: preloadedState,
        isMounted: true,
        mountedAt: widget.mountedAt,
        updatedAt: Date.now(),
      }).catch((err) => {
        console.warn('[SandboxManager] Failed to persist mounted widget in widgetsRepo:', err)
      })

      if (this.channel) {
        try {
          this.channel.postMessage({
            type: 'widget-mount',
            widget,
          })
        }
        catch (err) {
          console.warn('[SandboxManager] Failed to broadcast widget-mount:', err)
        }
      }

      this.notifyMountListeners(widget)

      // If surface is standalone widget and Electron is available, pop out the standalone desktop window
      if (surface === 'widget' && typeof window !== 'undefined' && (window as any).electron?.ipcRenderer) {
        try {
          const win = window as any
          const { context } = createContext(win.electron.ipcRenderer as any)
          const widgetsAddEventa = defineInvokeEventa<string | undefined, any>('eventa:invoke:electron:windows:widgets:add')
          const invokeAddWidget = defineInvoke(context, widgetsAddEventa)
          await invokeAddWidget({
            id: widget.id,
            componentName: 'generative',
            componentProps: {
              id: widget.id,
              title: widget.title,
              path: widget.path,
              code: widget.code,
            },
            size: 'm',
            ttlMs: 0,
          })
        }
        catch (err) {
          console.warn('[SandboxManager] Failed to invoke widgetsAdd for standalone widget window:', err)
        }
      }

      const locationReminder = surface === 'panel'
        ? `Widget "${title}" mounted in right side panel of the chatbox (if closed, open the widgets panel to view).`
        : `Widget "${title}" mounted in new standalone widget window on the desktop.`

      return {
        stdout: `[GEN_UI_MOUNT:${fullPath}]\n✨ ${locationReminder}\n`,
        stderr: '',
        exitCode: 0,
      }
    }

    const unmountHandler = async (args: string[], ctx: any) => {
      const target = args[0]
      if (!target) {
        return {
          stdout: '',
          stderr: 'Usage: unmount_widget <file|id>\n',
          exitCode: 1,
        }
      }
      const fullPath = target.startsWith('/') ? target : `${ctx.cwd || '/workspace'}/${target}`
      this.mountedWidgetsList = this.mountedWidgetsList.filter(w => w.id !== target && w.path !== target && w.path !== fullPath)

      if (this.channel) {
        this.channel.postMessage({ type: 'widget-unmount', id: target })
      }
      void widgetsRepo.setMounted(target, false).catch(() => {})
      void widgetsRepo.setMounted(fullPath, false).catch(() => {})
      this.notifyMountListeners()

      return {
        stdout: `Unmounted widget: ${target}\n`,
        stderr: '',
        exitCode: 0,
      }
    }

    const clearWidgetsHandler = async () => {
      this.mountedWidgetsList = []
      if (this.channel) {
        this.channel.postMessage({ type: 'widget-clear' })
      }
      void widgetsRepo.clearMounted().catch(() => {})
      this.notifyMountListeners()
      return {
        stdout: 'Cleared all mounted generative widgets.\n',
        stderr: '',
        exitCode: 0,
      }
    }

    const listWidgetsHandler = async () => {
      const all = await widgetsRepo.getWidgets()
      if (all.length === 0) {
        return {
          stdout: 'No generative widgets registered yet. Use mount_widget <file.ts|file.js> to create one.\n',
          stderr: '',
          exitCode: 0,
        }
      }

      let out = 'Persisted Generative Widgets:\n'
      out += '--------------------------------------------------------------------------------\n'
      for (const w of all) {
        const isCurrentlyMounted = this.mountedWidgetsList.some(m => m.id === w.id || m.path === w.path)
        const status = isCurrentlyMounted ? '[ACTIVE]' : '[UNMOUNTED]'
        const title = w.title || 'Untitled'
        const path = w.sourcePath || w.path
        out += `${status.padEnd(12)} ${title.padEnd(28)} ${path}\n`
      }
      out += '--------------------------------------------------------------------------------\n'
      out += `Total: ${all.length} widget(s). Remount with: mount_widget <path|title>\n`

      return {
        stdout: out,
        stderr: '',
        exitCode: 0,
      }
    }

    this.bash.registerCommand({
      name: 'list_widgets',
      execute: listWidgetsHandler,
    })

    this.bash.registerCommand({
      name: 'widgets',
      execute: listWidgetsHandler,
    })

    this.bash.registerCommand({
      name: 'mount_widget',
      execute: mountHandler,
    })

    this.bash.registerCommand({
      name: 'mount',
      execute: mountHandler,
    })

    this.bash.registerCommand({
      name: 'show',
      execute: mountHandler,
    })

    this.bash.registerCommand({
      name: 'unmount_widget',
      execute: unmountHandler,
    })

    this.bash.registerCommand({
      name: 'unmount',
      execute: unmountHandler,
    })

    this.bash.registerCommand({
      name: 'clear_widgets',
      execute: clearWidgetsHandler,
    })

    // 2.5. Native MCP CLI command
    const mcpHandler = async (args: string[], _ctx: any) => {
      if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
        return {
          stdout: `Usage:
  mcp list [--json]                    List all available MCP tools
  mcp tools [--json]                   Alias for 'mcp list'
  mcp call <server::tool> [json_args]  Call an MCP tool with JSON arguments
  mcp <server::tool> [json_args]       Shorthand to call an MCP tool

Examples:
  mcp list
  mcp weather::get_forecast '{"city": "Tokyo"}'
  mcp github::list_issues '{"repo": "airi"}' > /workspace/issues.json
  cat /workspace/issues.json | jq '.[].title'
`,
          stderr: '',
          exitCode: 0,
        }
      }

      const bridge = tryGetMcpToolBridge()
      if (!bridge) {
        return {
          stdout: '',
          stderr: 'mcp: MCP tool bridge is not available in this runtime.\nTip: Ensure MCP servers are configured in Settings > MCP.\n',
          exitCode: 1,
        }
      }

      const sub = args[0]

      // Listing tools
      if (sub === 'list' || sub === 'tools') {
        try {
          const isJson = args.includes('--json')
          const tools = await bridge.listTools()
          if (isJson) {
            return {
              stdout: `${JSON.stringify(tools, null, 2)}\n`,
              stderr: '',
              exitCode: 0,
            }
          }
          if (tools.length === 0) {
            return {
              stdout: 'No MCP tools currently registered or running.\n',
              stderr: '',
              exitCode: 0,
            }
          }
          let out = `Available MCP Tools (${tools.length}):\n`
          for (const t of tools) {
            const qualified = t.name || `${t.serverName}::${t.toolName}`
            out += `  • ${qualified.padEnd(32)} ${t.description || 'No description'}\n`
          }
          return { stdout: out, stderr: '', exitCode: 0 }
        }
        catch (err: any) {
          return {
            stdout: '',
            stderr: `mcp: failed to list tools: ${err.message}\n`,
            exitCode: 1,
          }
        }
      }

      // Tool invocation
      const toolName = sub === 'call' ? args[1] : sub
      const rawArgs = sub === 'call' ? args.slice(2).join(' ') : args.slice(1).join(' ')

      if (!toolName) {
        return {
          stdout: '',
          stderr: 'mcp: missing tool name. Usage: mcp call <server::tool> [json_args]\n',
          exitCode: 1,
        }
      }

      let parsedArgs: Record<string, unknown> = {}
      if (rawArgs.trim()) {
        try {
          parsedArgs = JSON.parse(rawArgs.trim())
        }
        catch (err: any) {
          return {
            stdout: '',
            stderr: `mcp: invalid JSON arguments for '${toolName}': ${err.message}\nReceived: ${rawArgs}\n`,
            exitCode: 1,
          }
        }
      }

      try {
        const res = await bridge.callTool({
          name: toolName,
          arguments: parsedArgs,
        })

        if (res.isError) {
          const errMsg = typeof res.toolResult === 'string'
            ? res.toolResult
            : JSON.stringify(res.toolResult || res.content || 'Unknown error', null, 2)
          return {
            stdout: '',
            stderr: `mcp error [${toolName}]: ${errMsg}\n`,
            exitCode: 1,
          }
        }

        let outputText = ''
        if (res.structuredContent) {
          outputText = JSON.stringify(res.structuredContent, null, 2)
        }
        else if (res.toolResult !== undefined) {
          outputText = typeof res.toolResult === 'object'
            ? JSON.stringify(res.toolResult, null, 2)
            : String(res.toolResult)
        }
        else if (Array.isArray(res.content)) {
          outputText = res.content
            .map((c: any) => c.text ?? JSON.stringify(c, null, 2))
            .join('\n')
        }
        else {
          outputText = JSON.stringify(res, null, 2)
        }

        return {
          stdout: `${outputText}\n`,
          stderr: '',
          exitCode: 0,
        }
      }
      catch (err: any) {
        return {
          stdout: '',
          stderr: `mcp: invocation failed for '${toolName}': ${err.message}\n`,
          exitCode: 1,
        }
      }
    }

    this.bash.registerCommand({
      name: 'mcp',
      execute: mcpHandler,
    })

    // 2.6. Native TypeSafe Jev System-1 CLI command
    this.bash.registerCommand({
      name: 'jev',
      execute: handleJevCommand,
    })

    // 3. sed -i permission preservation wrapper
    const origSed = (this.bash as any).commands?.get?.('sed')
    if (origSed) {
      this.bash.registerCommand({
        name: 'sed',
        execute: async (args: string[], ctx: any) => {
          const isInline = args.includes('-i') || args.some(a => a.startsWith('-i'))
          let targetFile: string | null = null
          let origMode: number | null = null
          if (isInline) {
            targetFile = args[args.length - 1]
            if (targetFile && !targetFile.startsWith('-')) {
              const fullPath = targetFile.startsWith('/') ? targetFile : `${ctx.cwd || '/workspace'}/${targetFile}`
              if (await ctx.fs.exists(fullPath)) {
                const s = await ctx.fs.stat(fullPath)
                origMode = s.mode
              }
            }
          }
          const res = await origSed.execute(args, ctx)
          if (origMode && targetFile) {
            const fullPath = targetFile.startsWith('/') ? targetFile : `${ctx.cwd || '/workspace'}/${targetFile}`
            if (await ctx.fs.exists(fullPath)) {
              await ctx.fs.chmod(fullPath, origMode)
            }
          }
          return res
        },
      })
    }

    class ProcessExitError extends Error {
      code: number
      constructor(code = 0) {
        super(`process.exit(${code})`)
        this.name = 'ProcessExitError'
        this.code = code
      }
    }

    const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor

    function transformScriptCode(code: string): string {
      let transformed = code
      // 1. import default + named: import fs, { readFileSync } from 'fs'
      transformed = transformed.replace(
        /import\s+([\w$]+)\s*,\s*\{([^}]+)\}\s*from\s+['"]([^'"]+)['"];?/g,
        'const $1 = require("$3"); const {$2} = $1;',
      )
      // 2. import * as foo from 'fs'
      transformed = transformed.replace(
        /import\s+\*\s+as\s+([\w$]+)\s+from\s+['"]([^'"]+)['"];?/g,
        'const $1 = require("$2");',
      )
      // 3. import { a, b } from 'fs'
      transformed = transformed.replace(
        /import\s*\{([^}]+)\}\s*from\s+['"]([^'"]+)['"];?/g,
        'const {$1} = require("$2");',
      )
      // 4. import foo from 'fs'
      transformed = transformed.replace(
        /import\s+([\w$]+)\s+from\s+['"]([^'"]+)['"];?/g,
        'const $1 = require("$2");',
      )
      // 5. import 'foo'
      transformed = transformed.replace(
        /import\s+['"]([^'"]+)['"];?/g,
        'require("$1");',
      )
      // 6. dynamic import: import(...) -> Promise.resolve(require(...))
      transformed = transformed.replace(
        /(?<![\w$])import\s*\(([^)]+)\)/g,
        'Promise.resolve(require($1))',
      )
      // 7. export default
      transformed = transformed.replace(
        /export\s+default\s+/g,
        'module.exports = ',
      )
      // 8. export const / let / var
      transformed = transformed.replace(
        /export\s+(const|let|var)\s+([\w$]+)\s*=/g,
        '$1 $2 = exports.$2 =',
      )
      // 9. export function
      transformed = transformed.replace(
        /export\s+function\s+([\w$]+)/g,
        'exports.$1 = function $1',
      )
      return transformed
    }

    function createVirtualNodeEnvironment(bashFs: any, ctx: any, scriptPath: string, scriptArgs: string[]) {
      const cwd = ctx.cwd || '/workspace'
      const resolveVirtualPath = (p: string) => {
        if (typeof bashFs.resolvePath === 'function') {
          return bashFs.resolvePath(cwd, p)
        }
        return p.startsWith('/') ? p : `${cwd}/${p}`
      }

      const virtualFs = {
        readFileSync: (p: string, _options?: any): string => {
          const full = resolveVirtualPath(p)
          const entry = bashFs.data?.get(full)
          if (!entry || entry.type !== 'file') {
            throw new Error(`ENOENT: no such file or directory, open '${p}'`)
          }
          return new TextDecoder().decode(entry.content)
        },
        writeFileSync: (p: string, data: any, _options?: any): void => {
          const full = resolveVirtualPath(p)
          const str = typeof data === 'string' ? data : String(data)
          if (typeof bashFs.writeFileSync === 'function') {
            bashFs.writeFileSync(full, str)
          }
          else {
            const encoder = new TextEncoder()
            bashFs.data?.set(full, {
              type: 'file',
              content: encoder.encode(str),
              mode: 0o644,
              mtime: new Date(),
            })
          }
        },
        existsSync: (p: string): boolean => {
          const full = resolveVirtualPath(p)
          return Boolean(bashFs.data?.has(full))
        },
        readdirSync: (p: string): string[] => {
          const full = resolveVirtualPath(p)
          const prefix = full.endsWith('/') ? full : `${full}/`
          const results = new Set<string>()
          for (const k of (bashFs.data?.keys() || [])) {
            if (k.startsWith(prefix) && k !== full) {
              const rest = k.slice(prefix.length)
              const segment = rest.split('/')[0]
              if (segment)
                results.add(segment)
            }
          }
          return Array.from(results)
        },
        statSync: (p: string) => {
          const full = resolveVirtualPath(p)
          const entry = bashFs.data?.get(full)
          if (!entry) {
            throw new Error(`ENOENT: no such file or directory, stat '${p}'`)
          }
          return {
            isFile: () => entry.type === 'file',
            isDirectory: () => entry.type === 'dir',
            size: entry.content ? entry.content.byteLength : 0,
            mode: entry.mode,
          }
        },
        promises: {
          readFile: async (p: string, options?: any) => virtualFs.readFileSync(p, options),
          writeFile: async (p: string, data: any, options?: any) => virtualFs.writeFileSync(p, data, options),
          readdir: async (p: string) => virtualFs.readdirSync(p),
          stat: async (p: string) => virtualFs.statSync(p),
        },
      }

      const virtualPath = {
        join: (...parts: string[]) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
        resolve: (...parts: string[]) => {
          let res = parts.filter(Boolean).join('/').replace(/\/+/g, '/')
          if (!res.startsWith('/'))
            res = `/${res}`
          return res
        },
        dirname: (p: string) => {
          const idx = p.lastIndexOf('/')
          if (idx === -1)
            return '.'
          if (idx === 0)
            return '/'
          return p.slice(0, idx)
        },
        basename: (p: string, ext?: string) => {
          let b = p.slice(p.lastIndexOf('/') + 1)
          if (ext && b.endsWith(ext))
            b = b.slice(0, -ext.length)
          return b
        },
        extname: (p: string) => {
          const idx = p.lastIndexOf('.')
          return idx !== -1 ? p.slice(idx) : ''
        },
        posix: null as any,
      }
      virtualPath.posix = virtualPath

      const virtualMcp = {
        listTools: async () => {
          const b = tryGetMcpToolBridge()
          if (!b)
            throw new Error('MCP tool bridge is not available in this runtime.')
          return await b.listTools()
        },
        callTool: async (name: string, args: Record<string, unknown> = {}) => {
          const b = tryGetMcpToolBridge()
          if (!b)
            throw new Error('MCP tool bridge is not available in this runtime.')
          const res = await b.callTool({ name, arguments: args })
          if (res.isError) {
            throw new Error(`MCP tool error [${name}]: ${JSON.stringify(res.toolResult || res.content)}`)
          }
          return res.structuredContent ?? res.toolResult ?? res.content
        },
        getRuntimeStatus: async () => {
          const b = tryGetMcpToolBridge()
          if (!b)
            throw new Error('MCP tool bridge is not available in this runtime.')
          return await b.getRuntimeStatus()
        },
      }

      const virtualJev = createVirtualJevEnvironment()

      const virtualModules: Record<string, any> = {
        'fs': virtualFs,
        'node:fs': virtualFs,
        'path': virtualPath,
        'node:path': virtualPath,
        'mcp': virtualMcp,
        'node:mcp': virtualMcp,
        'jev': virtualJev,
        'node:jev': virtualJev,
        'system1': virtualJev,
        'node:system1': virtualJev,
      }

      const customRequire = (id: string) => {
        if (virtualModules[id]) {
          return virtualModules[id]
        }
        if (id.startsWith('./') || id.startsWith('../') || id.startsWith('/')) {
          const resolved = resolveVirtualPath(id)
          const targetJs = resolved.endsWith('.js') ? resolved : `${resolved}.js`
          const targetJson = resolved.endsWith('.json') ? resolved : `${resolved}.json`
          if (virtualFs.existsSync(targetJson)) {
            return JSON.parse(virtualFs.readFileSync(targetJson))
          }
          if (virtualFs.existsSync(targetJs)) {
            const subCode = virtualFs.readFileSync(targetJs)
            const exp: any = {}
            const mod = { exports: exp }
            // eslint-disable-next-line no-new-func
            const fn = new Function('require', 'exports', 'module', '__filename', '__dirname', transformScriptCode(subCode))
            fn(customRequire, exp, mod, targetJs, virtualPath.dirname(targetJs))
            return mod.exports
          }
        }
        throw new Error(`Cannot find module '${id}'`)
      }

      const moduleObj: any = { exports: {} }

      const customProcess = {
        argv: ['node', scriptPath, ...scriptArgs],
        env: { ...ctx.env },
        cwd: () => ctx.cwd || '/workspace',
        exit: (code = 0) => {
          throw new ProcessExitError(code)
        },
      }

      const dirname = virtualPath.dirname(scriptPath)

      return {
        require: customRequire,
        module: moduleObj,
        process: customProcess,
        __filename: scriptPath,
        __dirname: dirname,
        fs: virtualFs,
        path: virtualPath,
        mcp: virtualMcp,
        jev: virtualJev,
      }
    }

    async function runNodeCode(
      code: string,
      env: ReturnType<typeof createVirtualNodeEnvironment>,
    ): Promise<{ stdout: string, stderr: string, exitCode: number }> {
      let stdout = ''
      let stderr = ''
      const customConsole = {
        log: (...a: any[]) => { stdout += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
        error: (...a: any[]) => { stderr += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
        warn: (...a: any[]) => { stderr += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
        info: (...a: any[]) => { stdout += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
      }

      const transformed = transformScriptCode(code)
      const prevMcp = (globalThis as any).mcp
      ;(globalThis as any).mcp = env.mcp
      const prevJev = (globalThis as any).jev
      ;(globalThis as any).jev = env.jev
      try {
        const fn = new (AsyncFunction as any)('require', 'module', 'exports', 'console', 'process', '__filename', '__dirname', transformed)
        await fn(env.require, env.module, env.module.exports, customConsole, env.process, env.__filename, env.__dirname)
        return { stdout, stderr, exitCode: 0 }
      }
      catch (err: any) {
        if (err instanceof ProcessExitError) {
          return { stdout, stderr, exitCode: err.code }
        }
        return { stdout, stderr: `${stderr}${err.stack || err.message}\n`, exitCode: 1 }
      }
      finally {
        if (prevMcp !== undefined) {
          ;(globalThis as any).mcp = prevMcp
        }
        else {
          delete (globalThis as any).mcp
        }
        if (prevJev !== undefined) {
          ;(globalThis as any).jev = prevJev
        }
        else {
          delete (globalThis as any).jev
        }
      }
    }

    // 4. In-memory Node.js runtime command
    this.bash.registerCommand({
      name: 'node',
      execute: async (args: string[], ctx: any) => {
        if (args.includes('-v') || args.includes('--version')) {
          return { stdout: 'v22.14.0\n', stderr: '', exitCode: 0 }
        }
        if (args.includes('-h') || args.includes('--help')) {
          return {
            stdout: 'Usage: node [options] [ script.js ] [arguments]\nOptions:\n  -v, --version         print Node.js version\n  -e, --eval "script"   evaluate script\n',
            stderr: '',
            exitCode: 0,
          }
        }
        const bashFs = (this.bash as any).fs
        // Handle -e or --eval
        const evalIdx = args.findIndex(a => a === '-e' || a === '--eval')
        if (evalIdx !== -1 && args[evalIdx + 1]) {
          const code = args[evalIdx + 1]
          const scriptArgs = args.slice(evalIdx + 2)
          const env = createVirtualNodeEnvironment(bashFs, ctx, '[eval]', scriptArgs)
          return await runNodeCode(code, env)
        }
        // Handle script file: node foo.js [arguments]
        const scriptFileIdx = args.findIndex(a => !a.startsWith('-'))
        if (scriptFileIdx !== -1) {
          const scriptFile = args[scriptFileIdx]
          const scriptArgs = args.slice(scriptFileIdx + 1)
          const fullPath = scriptFile.startsWith('/') ? scriptFile : `${ctx.cwd || '/workspace'}/${scriptFile}`
          if (!(await ctx.fs.exists(fullPath))) {
            return { stdout: '', stderr: `Cannot find module '${scriptFile}'\n`, exitCode: 1 }
          }
          const code = await ctx.fs.readFile(fullPath)
          const env = createVirtualNodeEnvironment(bashFs, ctx, fullPath, scriptArgs)
          return await runNodeCode(code, env)
        }
        return { stdout: 'v22.14.0\n', stderr: '', exitCode: 0 }
      },
    })
  }

  async syncProjections(): Promise<void> {
    try {
      await this.bash.exec('mkdir -p /workspace/.airi')

      const session = buildSessionProjection()
      const cognition = buildCognitionProjection()
      const telemetry = buildTelemetryProjection()
      const messages = buildMessagesProjection()

      await this.bash.fs.writeFile('/workspace/.airi/session.json', JSON.stringify(session, null, 2))
      await this.bash.fs.writeFile('/workspace/.airi/cognition.json', JSON.stringify(cognition, null, 2))
      await this.bash.fs.writeFile('/workspace/.airi/telemetry.json', JSON.stringify(telemetry, null, 2))
      await this.bash.fs.writeFile('/workspace/.airi/messages.json', JSON.stringify(messages, null, 2))
    }
    catch (err) {
      console.warn('[Sandbox] Failed to sync VFS projections:', err)
    }
  }

  async seedWorkspace(): Promise<void> {
    await this.bash.exec('mkdir -p /workspace/types')

    await this.bash.fs.writeFile('/workspace/types/airi-widget.d.ts', `// Project AIRI Generative UI Sidecar Contract
// NOTICE: Widgets execute in a sandboxed browser iframe DOM (HTML5 & native browser ESM).
// Do NOT import 'fs' or Node modules. Use context.callMcpTool(name, args) to fetch live external data.
interface _AiriWidgetSidecar {
  session: {
    id: string
    activeSessionId?: string
    activeCardName: string
    characterName?: string
    messageCount: number
    lastUserMessageAt: string
    lastMessageAt?: string | null
    hoursSinceLastMessage: number
  }
  cognition: {
    emotion: string
    valence: number
    energy: number
    somaticState?: string
    characterName?: string
    character?: {
      name: string
      description?: string
    }
    consciousness?: {
      activeProvider: string
      activeModel: string
    }
    provider?: string
    model?: string
    nan0?: {
      enabled: boolean
      emotions: Record<string, number>
      lastReflex?: {
        label: string
        cluster?: string
        confidence?: number
        icon?: string
      } | null
      decision?: string
      decisionReason?: string
      demandsSilence?: boolean
      isPouting?: boolean
      innerMonologue?: string
      moodProfile?: {
        primary: string
        secondary?: string | null
        valence: number
        arousal: number
      }
    }
  }
  telemetry: {
    isAfk: boolean
    idleSeconds: number
    idleTimeSec: number
    activeApp: string
    activeProgram: string
    activeWindowTitle: string
    cpuLoad: [number, number, number] & {
      '1m': number
      '5m': number
      '15m': number
    }
    gpuAvg?: number
    volumeLevel?: number
    localTime?: string
  }
}

interface _AiriWidgetContext<T = Record<string, any>> extends HTMLElement {
  container: HTMLElement
  sidecar: _AiriWidgetSidecar
  data: _AiriWidgetSidecar
  state: T
  setState: (updater: Partial<T> | ((prevState: T) => Partial<T> | T)) => void
  onStateChange: (callback: (newState: T) => void) => () => void
  onUpdate: (callback: (updatedSidecar: _AiriWidgetSidecar) => void) => () => void
  callMcpTool: (name: string, args?: Record<string, unknown>) => Promise<any>
}

export type AiriWidgetSidecar = _AiriWidgetSidecar
export type AiriWidgetContext<T = Record<string, any>> = _AiriWidgetContext<T>

declare global {
  type AiriWidgetSidecar = _AiriWidgetSidecar
  type AiriWidgetContext<T = Record<string, any>> = _AiriWidgetContext<T>
}
`)

    await this.bash.fs.writeFile('/workspace/README.md', `# Project AIRI Workstation
In-Memory POSIX RAM disk. Zero host filesystem access.
- Live system projections: /workspace/.airi/*.json
- TypeScript compiler: tsc <file.ts>
- Generative UI: mount_widget <file.ts|file.js> [--surface panel|widget]
- Model Context Protocol: mcp list | mcp <server::tool> [json_args]
- System 1 Semantic Decisions: jev is | jev choose | jev score | require('jev')
- Micro-App Types: /workspace/types/airi-widget.d.ts
`)
  }

  async exec(command: string): Promise<ExecResult> {
    if (!this.isLeader && this.channel) {
      const requestId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      try {
        return await this.sendRpc<ExecResult>('exec', {
          type: 'exec',
          requestId,
          command,
        }, 30000)
      }
      catch (err) {
        console.warn('[SandboxManager] RPC exec failed, falling back to local exec:', err)
      }
    }

    return await this.execInternal(command)
  }

  private async execInternal(command: string): Promise<ExecResult> {
    await this.syncProjections()

    const startTime = performance.now()
    const result = await this.bash.exec(command)
    const durationMs = Math.round(performance.now() - startTime)

    await this.checkWidgetStateFiles()

    const logEntry: CommandLogEntry = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      command,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      durationMs,
      timestamp: Date.now(),
    }

    this.commandLogs.push(logEntry)
    if (this.commandLogs.length > 100) {
      this.commandLogs.shift()
    }

    if (this.channel) {
      try {
        this.channel.postMessage({
          type: 'command-log',
          entry: logEntry,
        })
      }
      catch (err) {
        console.warn('[SandboxManager] Failed to broadcast command log:', err)
      }
    }

    this.notifyCommandListeners(logEntry)

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    }
  }

  async listFiles(dir = '/workspace'): Promise<VirtualFileEntry[]> {
    if (!this.isLeader && this.channel) {
      const requestId = `list-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      try {
        return await this.sendRpc<VirtualFileEntry[]>('list-files', {
          type: 'list-files',
          requestId,
          dir,
        }, 3000)
      }
      catch {
        // fallback to local
      }
    }

    return await this.listFilesInternal(dir)
  }

  private async listFilesInternal(dir = '/workspace'): Promise<VirtualFileEntry[]> {
    const entries: VirtualFileEntry[] = []
    try {
      const prefix = dir.endsWith('/') ? dir : `${dir}/`
      const seen = new Set<string>()
      const dataMap = (this.bash.fs as any).data as Map<string, any>
      if (dataMap) {
        for (const [k, v] of dataMap.entries()) {
          if (k.startsWith(prefix) && k !== dir) {
            const rel = k.slice(prefix.length)
            const seg = rel.split('/')[0]
            if (seg && !seen.has(seg)) {
              seen.add(seg)
              const isDir = rel.includes('/') || v.type === 'dir'
              entries.push({
                name: seg,
                path: `${prefix}${seg}`,
                isDirectory: isDir,
                size: v.content?.byteLength ?? 0,
              })
            }
          }
        }
      }
    }
    catch (err) {
      console.warn('[Sandbox] Failed to list files:', err)
    }
    return entries.sort((a, b) => (b.isDirectory ? 1 : 0) - (a.isDirectory ? 1 : 0) || a.name.localeCompare(b.name))
  }

  async readFile(filePath: string): Promise<string> {
    if (!this.isLeader && this.channel) {
      const requestId = `read-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      try {
        return await this.sendRpc<string>('read-file', {
          type: 'read-file',
          requestId,
          path: filePath,
        }, 5000)
      }
      catch {
        // fallback to local
      }
    }

    return await this.readFileInternal(filePath)
  }

  private async readFileInternal(filePath: string): Promise<string> {
    const exists = await this.bash.fs.exists(filePath)
    if (!exists) {
      throw new Error(`File not found: ${filePath}`)
    }
    return await this.bash.readFile(filePath)
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (!this.isLeader && this.channel) {
      const requestId = `write-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      try {
        await this.sendRpc('write-file', {
          type: 'write-file',
          requestId,
          path: filePath,
          content,
        }, 5000)
        return
      }
      catch {
        // fallback to local
      }
    }

    await this.writeFileInternal(filePath, content)
  }

  private async writeFileInternal(filePath: string, content: string): Promise<void> {
    await this.bash.fs.writeFile(filePath, content)
    await this.checkWidgetStateFiles(filePath)
  }

  async reset(): Promise<void> {
    if (!this.isLeader && this.channel) {
      const requestId = `reset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      try {
        await this.sendRpc('reset', { type: 'reset', requestId }, 5000)
        this.commandLogs = []
        this.mountedWidgetsList = []
        this.notifyCommandListeners()
        return
      }
      catch {
        // fallback to local
      }
    }

    await this.resetInternal()
  }

  private async resetInternal(): Promise<void> {
    this.bash = new Bash({ cwd: '/workspace' })
    this.mountedWidgetsList = []
    this.commandLogs = []
    this.suppressStateSyncPaths.clear()
    this.registerCustomCommands()
    await this.seedWorkspace()
    await this.syncProjections()
    void widgetsRepo.clearMounted().catch(() => {})
  }

  private async rehydrateMountedWidgets(): Promise<void> {
    try {
      const persisted = await widgetsRepo.getMountedWidgets()
      if (!persisted || persisted.length === 0)
        return

      for (const item of persisted) {
        if (item.sourcePath && item.sourceCode) {
          try {
            await this.bash.fs.writeFile(item.sourcePath, item.sourceCode)
          }
          catch (e) {
            console.warn(`[SandboxManager] Failed to restore source file ${item.sourcePath}:`, e)
          }
        }
        if (item.path && item.code) {
          try {
            await this.bash.fs.writeFile(item.path, item.code)
          }
          catch (e) {
            console.warn(`[SandboxManager] Failed to restore bundle file ${item.path}:`, e)
          }
        }

        // If widget has persisted state, lazily re-seed <name>.json into VFS
        let lastSyncedJsonContent: string | undefined
        if (item.state && Object.keys(item.state).length > 0) {
          const jsonPath = (item.sourcePath || item.path).replace(/\.(ts|js|html)$/, '.json')
          try {
            const jsonStr = JSON.stringify(item.state, null, 2)
            await this.bash.fs.writeFile(jsonPath, jsonStr)
            lastSyncedJsonContent = jsonStr
          }
          catch (e) {
            console.warn(`[SandboxManager] Failed to restore state file ${jsonPath}:`, e)
          }
        }

        const widget: MountedWidget = {
          id: item.id,
          path: item.path,
          sourcePath: item.sourcePath,
          sourceCode: item.sourceCode,
          code: item.code,
          title: item.title,
          surface: item.surface || (item.target === 'window' ? 'widget' : 'panel'),
          target: item.target || (item.surface === 'widget' ? 'window' : 'sidepanel'),
          position: item.position,
          state: item.state,
          _lastSyncedJsonContent: lastSyncedJsonContent,
          mountedAt: item.mountedAt || Date.now(),
        }

        const existingIdx = this.mountedWidgetsList.findIndex(w => w.id === item.id || w.path === item.path)
        if (existingIdx >= 0) {
          this.mountedWidgetsList[existingIdx] = widget
        }
        else {
          this.mountedWidgetsList.push(widget)
        }
      }

      this.notifyMountListeners()
    }
    catch (err) {
      console.warn('[SandboxManager] Failed to rehydrate mounted widgets from repo:', err)
    }
  }
}
