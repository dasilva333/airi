/**
 * Packages the Cloudflare Worker entry point (src/index.ts) into a single
 * ES module string using esbuild in-memory bundling.
 */

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function packageWorkerScript(): Promise<string> {
  const entryPoint = resolve(__dirname, '../index.ts')

  const result = await build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    // Inline everything — the Cloudflare Worker runtime has no node_modules
    external: [],
  })

  const outputFile = result.outputFiles[0]
  if (!outputFile) {
    throw new Error('esbuild produced no output files')
  }

  return outputFile.text
}
