/**
 * Packages the Cloudflare Worker entry point (src/index.ts) into a single
 * ES module string using esbuild in-memory bundling.
 */

import fs from 'node:fs'

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

import { BUNDLED_WORKER_SCRIPT } from '../bundle-code'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function packageWorkerScript(): Promise<string> {
  try {
    const candidates = [
      resolve(__dirname, '../index.ts'),
      resolve(__dirname, 'index.ts'),
      resolve(__dirname, '../index.mjs'),
      resolve(__dirname, 'index.mjs'),
      resolve(__dirname, '../src/index.ts'),
    ]

    const entryPoint = candidates.find(c => fs.existsSync(c))
    if (entryPoint) {
      const result = await build({
        entryPoints: [entryPoint],
        bundle: true,
        write: false,
        format: 'esm',
        target: 'es2022',
        platform: 'browser',
        external: [],
      })

      const outputFile = result.outputFiles[0]
      if (outputFile) {
        return outputFile.text
      }
    }
  }
  catch (err: any) {
    console.warn(`[Packager] Dynamic bundle attempt failed, using pre-bundled fallback script: ${err.message}`)
  }

  // Guaranteed zero-fail fallback: pre-compiled full worker bundle code!
  return BUNDLED_WORKER_SCRIPT
}
