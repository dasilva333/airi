import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const TSC_BIN = path.resolve(__dirname, '../node_modules/.bin/tsc-rs')

export interface CompilerResult {
  stdout: string
  stderr: string
  exitCode: number
}

/**
 * Execute tsc-rs against files stored inside just-bash's virtual in-memory filesystem.
 * Exposes a drop-in tsc / tsc-rs command to the sandbox with path and flag normalization.
 */
export async function compileTypeScript(args: string[], ctx: any): Promise<CompilerResult> {
  // 1. Version check (-v, --version)
  if (args.includes('-v') || args.includes('--version')) {
    return {
      stdout: 'Version 5.8.2\n',
      stderr: '',
      exitCode: 0,
    }
  }

  // 2. Help check (-h, --help)
  if (args.includes('-h') || args.includes('--help')) {
    const helpRes = spawnSync(TSC_BIN, ['--help'], { encoding: 'utf-8' })
    return {
      stdout: helpRes.stdout || '',
      stderr: helpRes.stderr || '',
      exitCode: helpRes.status ?? 0,
    }
  }

  // 3. Create isolated ephemeral scratch directory on host disk
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'airi-tsc-'))

  try {
    // 4. Mirror in-memory /workspace files to scratch directory
    const allPaths: string[] = await ctx.fs.getAllPaths()
    for (const p of allPaths) {
      if (!p.startsWith('/workspace'))
        continue
      const stat = await ctx.fs.stat(p)
      const rel = path.posix.relative('/workspace', p)
      if (!rel)
        continue
      const target = path.join(tempDir, rel)
      if (stat.isDirectory) {
        await fs.mkdir(target, { recursive: true })
      }
      else {
        await fs.mkdir(path.dirname(target), { recursive: true })
        const content = await ctx.fs.readFile(p)
        await fs.writeFile(target, content)
      }
    }

    // 5. Parse and normalize arguments
    const fileArgs: string[] = []
    const normalizedFlags: string[] = []
    let hasTarget = false
    let hasLib = false

    for (let i = 0; i < args.length; i++) {
      const a = args[i]

      // Handle --outDir: remap /workspace to tempDir so tsc-rs doesn't fail on macOS read-only root
      if (a === '--outDir') {
        const next = args[++i]
        if (next) {
          if (next === '/workspace' || next === '/workspace/' || next === '.') {
            normalizedFlags.push('--outDir', tempDir)
          }
          else if (next.startsWith('/workspace/')) {
            normalizedFlags.push('--outDir', path.join(tempDir, next.slice('/workspace/'.length)))
          }
          else {
            normalizedFlags.push('--outDir', next)
          }
        }
      }
      else if (a.startsWith('--outDir=')) {
        const val = a.slice('--outDir='.length)
        if (val === '/workspace' || val === '/workspace/' || val === '.') {
          normalizedFlags.push(`--outDir=${tempDir}`)
        }
        else if (val.startsWith('/workspace/')) {
          normalizedFlags.push(`--outDir=${path.join(tempDir, val.slice('/workspace/'.length))}`)
        }
        else {
          normalizedFlags.push(a)
        }
      }
      else if (a === '--target') {
        hasTarget = true
        const next = args[++i]
        if (next)
          normalizedFlags.push('--target', next.toLowerCase())
      }
      else if (a.startsWith('--target=')) {
        hasTarget = true
        normalizedFlags.push(`--target=${a.slice('--target='.length).toLowerCase()}`)
      }
      else if (a === '--lib') {
        hasLib = true
        const next = args[++i]
        if (next)
          normalizedFlags.push('--lib', next.toLowerCase())
      }
      else if (a.startsWith('--lib=')) {
        hasLib = true
        normalizedFlags.push(`--lib=${a.slice('--lib='.length).toLowerCase()}`)
      }
      else if (a.startsWith('-')) {
        normalizedFlags.push(a)
      }
      else {
        let f = a
        if (f.startsWith('/workspace/'))
          f = f.slice('/workspace/'.length)
        else if (f.startsWith('/'))
          f = f.slice(1)
        fileArgs.push(f)
      }
    }

    // If no explicit files provided, discover all .ts / .tsx files in /workspace
    let effectiveFiles = fileArgs
    if (effectiveFiles.length === 0) {
      effectiveFiles = allPaths
        .filter(p => p.startsWith('/workspace') && (p.endsWith('.ts') || p.endsWith('.tsx')) && !p.endsWith('.d.ts'))
        .map(p => path.posix.relative('/workspace', p))
    }

    if (effectiveFiles.length === 0) {
      return {
        stdout: '',
        stderr: 'error TS18003: No inputs were found in /workspace\n',
        exitCode: 1,
      }
    }

    // 6. Build compiler arguments with default fallbacks
    const tscArgs = [
      ...effectiveFiles,
      '--ignoreConfig',
    ]

    if (!hasTarget)
      tscArgs.push('--target', 'es2022')
    if (!hasLib)
      tscArgs.push('--lib', 'es2022,dom')

    tscArgs.push(...normalizedFlags)

    // 7. Invoke native tsc-rs binary in temp directory
    const res = spawnSync(TSC_BIN, tscArgs, {
      cwd: tempDir,
      encoding: 'utf-8',
    })

    // 8. Recursively sync emitted artifacts (.js, .d.ts, .map) back to in-memory filesystem
    async function syncEmitted(dir: string): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          await syncEmitted(full)
        }
        else if (entry.name.endsWith('.js') || entry.name.endsWith('.d.ts') || entry.name.endsWith('.map')) {
          const rel = path.relative(tempDir, full)
          const vfsPath = path.posix.join('/workspace', rel.split(path.sep).join('/'))
          const content = await fs.readFile(full, 'utf-8')
          await ctx.fs.writeFile(vfsPath, content)
        }
      }
    }
    await syncEmitted(tempDir)

    return {
      stdout: res.stdout || '',
      stderr: res.stderr || '',
      exitCode: res.status ?? 0,
    }
  }
  catch (err: any) {
    return {
      stdout: '',
      stderr: `tsc: internal error: ${err.message}\n`,
      exitCode: 1,
    }
  }
  finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}
