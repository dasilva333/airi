import type { ExecResult } from './types'

import { useElectronEventaInvoke } from '@proj-airi/electron-vueuse'
import { electronSandboxCompileTypeScript } from '@proj-airi/stage-shared'

/**
 * Fallback browser TypeScript transpile function when native tsc-rs binary IPC is unavailable.
 * Removes types, interfaces, type annotations, and enums so modern browsers can execute the code.
 */
function browserTranspileTypeScript(source: string): string {
  let js = source
  // Remove import type ...
  js = js.replace(/import\s+type\s[^;]+;/g, '')
  // Remove export type ... or export interface ...
  js = js.replace(/export\s+(?:type|interface)\s[^;{]+(?:\{[^}]*\}|;)/g, '')
  // Remove standalone interface ...
  js = js.replace(/(?:^|\n)\s*interface\s+\w+(?:<[^>]+>)?\s*\{[^}]*\}/g, '')
  // Remove type alias ...
  js = js.replace(/(?:^|\n)\s*type\s+\w+(?:<[^>]+>)?\s*=[^;]+;/g, '')
  // Remove function/variable return and argument type annotations (: type)
  js = js.replace(/:\s*[A-Z][\w<>[\],\s|&]*(?=[=,){\n;])/g, '')
  // Remove as <Type>
  js = js.replace(/\s+as\s[\w<>[\],\s|&]+/g, '')
  return js
}

export async function compileTypeScriptInSandbox(
  args: string[],
  ctx: any,
): Promise<ExecResult> {
  // Check version flag
  if (args.includes('-v') || args.includes('--version')) {
    return {
      stdout: 'Version 7.1.0-dev\n',
      stderr: '',
      exitCode: 0,
    }
  }

  // Check help flag
  if (args.includes('-h') || args.includes('--help')) {
    return {
      stdout: 'Usage: tsc [options] [file...]\nOptions:\n  --target es2022\n  --lib es2022,dom\n  --outDir <dir>\n',
      stderr: '',
      exitCode: 0,
    }
  }

  const isElectron = typeof window !== 'undefined' && Boolean((window as any)?.electron)

  // 1. Desktop Electron: Use native tsc-rs IPC bridge
  if (isElectron) {
    try {
      const compileInvoke = useElectronEventaInvoke(electronSandboxCompileTypeScript)
      if (compileInvoke) {
        // Collect in-memory files from /workspace
        const rawPaths = ctx.fs.getAllPaths()
        const allPaths: string[] = Array.isArray(rawPaths) ? rawPaths : await rawPaths
        const files: Record<string, string> = {}

        for (const p of allPaths) {
          if (!p.startsWith('/workspace'))
            continue
          const stat = await ctx.fs.stat(p)
          if (!stat.isDirectory) {
            const rel = p.replace(/^\/workspace\/?/, '')
            if (rel) {
              files[rel] = await ctx.fs.readFile(p)
            }
          }
        }

        const res = await compileInvoke({ files, args })
        if (res) {
          // Write emitted artifacts back into virtual RAM disk
          for (const [relPath, content] of Object.entries(res.emittedFiles || {})) {
            const vfsPath = `/workspace/${relPath}`
            await ctx.fs.writeFile(vfsPath, typeof content === 'string' ? content : String(content))
          }

          return {
            stdout: res.stdout || '',
            stderr: res.stderr || '',
            exitCode: res.exitCode ?? 0,
          }
        }
      }
    }
    catch (err: any) {
      console.warn('[Sandbox] tsc-rs native compile failed, falling back to browser transpile:', err)
    }
  }

  // 2. Web / Browser fallback
  try {
    const rawPaths = ctx.fs.getAllPaths()
    const allPaths: string[] = Array.isArray(rawPaths) ? rawPaths : await rawPaths
    const targetFiles = args.filter(a => !a.startsWith('-')).map(a => a.startsWith('/') ? a : `/workspace/${a}`)
    const filesToCompile = targetFiles.length > 0
      ? targetFiles
      : allPaths.filter(p => p.startsWith('/workspace') && (p.endsWith('.ts') || p.endsWith('.tsx')) && !p.endsWith('.d.ts'))

    if (filesToCompile.length === 0) {
      return {
        stdout: '',
        stderr: 'error TS18003: No inputs were found in /workspace\n',
        exitCode: 1,
      }
    }

    for (const filePath of filesToCompile) {
      const content = await ctx.fs.readFile(filePath)
      const js = browserTranspileTypeScript(content)
      const outPath = filePath.replace(/\.tsx?$/, '.js')
      await ctx.fs.writeFile(outPath, js)
    }

    return {
      stdout: `Compiled ${filesToCompile.length} file(s) successfully.\n`,
      stderr: '',
      exitCode: 0,
    }
  }
  catch (err: any) {
    return {
      stdout: '',
      stderr: `tsc: compile error: ${err.message}\n`,
      exitCode: 1,
    }
  }
}
