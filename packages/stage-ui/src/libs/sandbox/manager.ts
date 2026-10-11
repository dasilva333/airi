import type { CommandLogEntry, ExecResult, MountedWidget, SandboxChannelMessage, VirtualFileEntry } from './types'

import { isStageTamagotchi } from '@proj-airi/stage-shared'
import { Bash } from 'just-bash'

import { compileTypeScriptInSandbox } from './compiler-bridge'
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

  constructor() {
    this.bash = new Bash({
      cwd: '/workspace',
    })
    this.registerCustomCommands()
  }

  async init(): Promise<void> {
    this.isLeader = isMainWindow()

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
    }
    else {
      // In follower window (e.g. Chat Window), request initial state/logs from leader
      await this.requestInitialSync()
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

  unmountWidget(idOrPath: string): void {
    this.mountedWidgetsList = this.mountedWidgetsList.filter(w => w.id !== idOrPath && w.path !== idOrPath)
    if (this.channel) {
      this.channel.postMessage({ type: 'widget-unmount', id: idOrPath })
    }
    this.notifyMountListeners()
  }

  clearWidgets(): void {
    this.mountedWidgetsList = []
    if (this.channel) {
      this.channel.postMessage({ type: 'widget-clear' })
    }
    this.notifyMountListeners()
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
          stderr: 'Usage: mount_widget <file.ts|file.js|file.html> [--title <title>] [--target sidepanel|inline|window]\n',
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

      const exists = await ctx.fs.exists(fullPath)
      if (!exists) {
        return {
          stdout: '',
          stderr: `mount_widget: File not found: ${fullPath}\n`,
          exitCode: 1,
        }
      }

      const code = await ctx.fs.readFile(fullPath)

      // Parse optional args
      let target: 'sidepanel' | 'inline' | 'window' = 'sidepanel'
      let title: string | undefined
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--target' && args[i + 1]) {
          target = args[++i] as any
        }
        else if (args[i] === '--title' && args[i + 1]) {
          title = args[++i]
        }
      }
      if (!title) {
        title = fullPath.split('/').pop() || 'Widget'
      }

      const widget: MountedWidget = {
        id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        path: fullPath,
        code,
        title,
        target,
        mountedAt: Date.now(),
      }

      const existingIdx = this.mountedWidgetsList.findIndex(w => w.path === fullPath)
      if (existingIdx >= 0) {
        this.mountedWidgetsList[existingIdx] = widget
      }
      else {
        this.mountedWidgetsList.push(widget)
      }

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

      return {
        stdout: `[GEN_UI_MOUNT:${fullPath}]\n✨ Mounted ${title} (${fullPath}) to ${target} Generative UI Canvas\n`,
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
      this.notifyMountListeners()
      return {
        stdout: 'Cleared all mounted generative widgets.\n',
        stderr: '',
        exitCode: 0,
      }
    }

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

      const virtualModules: Record<string, any> = {
        'fs': virtualFs,
        'node:fs': virtualFs,
        'path': virtualPath,
        'node:path': virtualPath,
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
export interface AiriWidgetSidecar {
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

export interface AiriWidgetContext extends HTMLElement {
  container: HTMLElement
  sidecar: AiriWidgetSidecar
  data: AiriWidgetSidecar
  onUpdate: (callback: (updatedSidecar: AiriWidgetSidecar) => void) => () => void
}
`)

    await this.bash.fs.writeFile('/workspace/README.md', `# Project AIRI Workstation
In-Memory POSIX RAM disk. Zero host filesystem access.
- Live system projections: /workspace/.airi/*.json
- TypeScript compiler: tsc <file.ts>
- Generative UI: mount_widget <file.ts|file.js>
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
    this.registerCustomCommands()
    await this.seedWorkspace()
    await this.syncProjections()
  }
}
