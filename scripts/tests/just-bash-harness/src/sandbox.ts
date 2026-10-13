import path from 'node:path'

import { Bash } from '../node_modules/just-bash/dist/bundle/index.js'
import { compileTypeScript } from './compiler.ts'

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export class SandboxManager {
  private bash: Bash

  constructor() {
    this.bash = new Bash({
      cwd: '/workspace',
    })
    this.registerCustomCommands()
  }

  async init(): Promise<void> {
    await this.seedWorkspace()
  }

  private registerCustomCommands(): void {
    // 1. Native TypeScript compiler (tsc / tsc-rs via @tsc-rs/darwin-arm64)
    this.bash.registerCommand({
      name: 'tsc',
      execute: async (args, ctx) => compileTypeScript(args, ctx),
    })

    this.bash.registerCommand({
      name: 'tsc-rs',
      execute: async (args, ctx) => compileTypeScript(args, ctx),
    })

    // 2. Generative UI mount / show command
    const mountHandler = async (args: string[], ctx: any) => {
      const file = args[0]
      if (!file) {
        return {
          stdout: '',
          stderr: 'Usage: mount <file.js|file.html>\n',
          exitCode: 1,
        }
      }
      const fullPath = file.startsWith('/') ? file : path.posix.join(ctx.cwd || '/workspace', file)
      const exists = await ctx.fs.exists(fullPath)
      if (!exists) {
        return {
          stdout: '',
          stderr: `mount: File not found: ${fullPath}\n`,
          exitCode: 1,
        }
      }
      return {
        stdout: `[GEN_UI_MOUNT:${fullPath}]\n✨ Mounted ${fullPath} to Generative Canvas\n`,
        stderr: '',
        exitCode: 0,
      }
    }

    this.bash.registerCommand({
      name: 'mount',
      execute: mountHandler,
    })

    this.bash.registerCommand({
      name: 'show',
      execute: mountHandler,
    })

    // 3. sed -i permission preservation wrapper
    const origSed = (this.bash as any).commands.get('sed')
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
              const fullPath = targetFile.startsWith('/') ? targetFile : path.posix.join(ctx.cwd || '/workspace', targetFile)
              if (await ctx.fs.exists(fullPath)) {
                const s = await ctx.fs.stat(fullPath)
                origMode = s.mode
              }
            }
          }
          const res = await origSed.execute(args, ctx)
          if (origMode && targetFile) {
            const fullPath = targetFile.startsWith('/') ? targetFile : path.posix.join(ctx.cwd || '/workspace', targetFile)
            if (await ctx.fs.exists(fullPath)) {
              await ctx.fs.chmod(fullPath, origMode)
            }
          }
          return res
        },
      })
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
        // Handle -e or --eval
        const evalIdx = args.findIndex(a => a === '-e' || a === '--eval')
        if (evalIdx !== -1 && args[evalIdx + 1]) {
          const code = args[evalIdx + 1]
          try {
            let stdout = ''
            let stderr = ''
            const customConsole = {
              log: (...a: any[]) => { stdout += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
              error: (...a: any[]) => { stderr += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
              warn: (...a: any[]) => { stderr += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
              info: (...a: any[]) => { stdout += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
            }
            const fn = new Function('console', 'process', code)
            fn(customConsole, { env: ctx.env, cwd: () => ctx.cwd })
            return { stdout, stderr, exitCode: 0 }
          }
          catch (err: any) {
            return { stdout: '', stderr: `${err.stack || err.message}\n`, exitCode: 1 }
          }
        }
        // Handle script file: node foo.js
        const scriptFile = args.find(a => !a.startsWith('-'))
        if (scriptFile) {
          const fullPath = scriptFile.startsWith('/') ? scriptFile : path.posix.join(ctx.cwd || '/workspace', scriptFile)
          if (!(await ctx.fs.exists(fullPath))) {
            return { stdout: '', stderr: `Cannot find module '${scriptFile}'\n`, exitCode: 1 }
          }
          const code = await ctx.fs.readFile(fullPath)
          try {
            let stdout = ''
            let stderr = ''
            const customConsole = {
              log: (...a: any[]) => { stdout += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
              error: (...a: any[]) => { stderr += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
              warn: (...a: any[]) => { stderr += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
              info: (...a: any[]) => { stdout += `${a.map(x => typeof x === 'object' ? JSON.stringify(x, null, 2) : String(x)).join(' ')}\n` },
            }
            const fn = new Function('console', 'process', code)
            fn(customConsole, { env: ctx.env, cwd: () => ctx.cwd })
            return { stdout, stderr, exitCode: 0 }
          }
          catch (err: any) {
            return { stdout: '', stderr: `${err.stack || err.message}\n`, exitCode: 1 }
          }
        }
        return { stdout: 'v22.14.0\n', stderr: '', exitCode: 0 }
      },
    })
  }

  async seedWorkspace(): Promise<void> {
    await this.bash.exec('mkdir -p /workspace/src')

    await this.bash.exec(`cat << 'EOF' > /workspace/notes.txt
Project AIRI - In-Memory Agent Sandbox
Status: Phase 4 Active (Client @xsai + Remote MCP + tsc-rs + Generative Canvas)
Architecture: In-Browser @xsai Stream Loop + RAM Disk Workspace + Streamable HTTP MCP
Compiler: Native tsc-rs (TypeScript 7.1.0-dev) bound as 'tsc' in bash
Safety: 100% in-memory RAM disk, zero host disk access.
EOF`)

    await this.bash.exec(`cat << 'EOF' > /workspace/todo.md
# Project AIRI: In-Memory Sandbox Roadmap
- [x] Phase 1: Interactive two-column UI + in-memory just-bash sandbox
- [x] Phase 2: Client-side @xsai streaming loop with bash tool (zero backend proxy)
- [x] Phase 3: Remote MCP bridge (Streamable HTTP / StreamableHTTPServerTransport)
- [x] Phase 4: ts-rust (tsc-rs) native compilation & dynamic Generative UI Canvas
- [ ] Phase 5: Autonomous multi-tool synthesis loop & dynamic widget composition
EOF`)

    await this.bash.exec(`cat << 'EOF' > /workspace/data.json
{
  "project": "Project AIRI",
  "version": "0.9.37",
  "sandbox": {
    "type": "in-memory-posix",
    "engine": "just-bash",
    "compiler": "tsc-rs",
    "v8_isolate": true,
    "zero_vm": true
  },
  "metrics": {
    "memory_mb": 45.2,
    "cold_start_ms": 4,
    "fs_mode": "ramdisk"
  },
  "features": [
    "pipe_chaining",
    "jq_filtering",
    "grep_search",
    "custom_commands",
    "tsc_compilation",
    "remote_mcp",
    "generative_ui"
  ]
}
EOF`)

    await this.bash.exec(`cat << 'EOF' > /workspace/src/index.ts
export interface AiriAgentSandbox {
  name: string
  compiler: string
  execute(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>
}

export function createSandbox(): AiriAgentSandbox {
  return {
    name: 'AIRI In-Memory POSIX Sandbox',
    compiler: 'tsc-rs 7.1.0-dev',
    async execute(command: string) {
      return { stdout: 'executed: ' + command, stderr: '', exitCode: 0 }
    }
  }
}
EOF`)
  }

  async exec(command: string): Promise<ExecResult> {
    const result = await this.bash.exec(command)
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
    }
  }

  async readFile(filePath: string): Promise<string> {
    const exists = await this.bash.fs.exists(filePath)
    if (!exists) {
      throw new Error(`File not found: ${filePath}`)
    }
    return await this.bash.readFile(filePath)
  }

  async reset(): Promise<void> {
    this.bash = new Bash({ cwd: '/workspace' })
    this.registerCustomCommands()
    await this.seedWorkspace()
  }
}
