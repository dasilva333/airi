import type { SigningKey } from '@ergosphere-it/protocol'
import type { BundleRelease, ChannelFileRelease } from '@ergosphere-it/publish'

import process, { env } from 'node:process'

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { createKeyPair, keyPairFromPrivateKey } from '@ergosphere-it/protocol'
import { buildBundleRelease, buildChannelFile, createReleaseId, uploadStages } from '@ergosphere-it/publish'

export interface CreateMockReleaseOptions {
  storeDir: string
  version: string
  channel?: 'stable' | 'canary' | 'dev' | 'nightly'
  releaseId?: number
  nativeVersion?: { min: number, max: number }
  requires?: 'reload' | 'restart'
  corruptSignature?: boolean
  signingKeyPem?: string
  files?: Array<{
    path: string
    content: string | Uint8Array
    component: string
  }>
}

export interface GeneratedReleaseResult {
  releaseId: number
  version: string
  channel: string
  bundle: BundleRelease
  channelRelease: ChannelFileRelease
  writtenFiles: string[]
}

/**
 * Loads the Ed25519 signing key from environment or local keyfile.
 */
export async function loadSigningKey(customPem?: string): Promise<SigningKey> {
  let pem = customPem || env.ERGOSPHERE_IT_SIGNING_KEY
  if (!pem) {
    const keyPath = resolve(import.meta.dirname, '../../../../.cache/keys/updater.pkcs8.key')
    if (existsSync(keyPath)) {
      pem = readFileSync(keyPath, 'utf8')
    }
    else {
      const ephemeral = await createKeyPair()
      return ephemeral.signingKey
    }
  }

  const keyPair = await keyPairFromPrivateKey(pem)
  return keyPair.signingKey
}

/**
 * Generates a signed Ergosphere release and writes it to a file-tree store directory.
 */
export async function createMockRelease(options: CreateMockReleaseOptions): Promise<GeneratedReleaseResult> {
  const storeRoot = resolve(options.storeDir)
  const channel = options.channel ?? 'canary'
  const releaseId = options.releaseId ?? createReleaseId()
  const version = options.version
  const signingKey = await loadSigningKey(options.signingKeyPem)
  const isRestart = options.requires === 'restart'

  // Default files: if requires restart, include main process file; else web renderer only
  const defaultFiles = isRestart
    ? [
        {
          path: 'main/index.mjs',
          component: 'main',
          content: `// Updated AIRI Main v${version}\nexport const version = "${version}";\n`,
        },
        {
          path: 'renderer/index.html',
          component: 'renderer',
          content: `<!DOCTYPE html><html><body>AIRI Desktop v${version}</body></html>`,
        },
      ]
    : [
        {
          path: 'renderer/index.html',
          component: 'renderer',
          content: `<!DOCTYPE html><html><body>AIRI Desktop v${version} (Hot Reload)</body></html>`,
        },
        {
          path: 'renderer/assets/app.js',
          component: 'renderer',
          content: `console.log("AIRI Hot Reloaded to v${version}");`,
        },
      ]

  const inputFiles = options.files ?? defaultFiles

  const components = isRestart
    ? [
        { dir: 'main', entry: 'main/index.mjs', type: 'electron-main' as const },
        { dir: 'renderer', entry: 'renderer/index.html', type: 'web' as const },
      ]
    : [
        { dir: 'renderer', entry: 'renderer/index.html', type: 'web' as const },
      ]

  const bundleFiles = inputFiles.map(f => ({
    bytes: typeof f.content === 'string' ? new TextEncoder().encode(f.content) : f.content,
    component: f.component,
    executable: false,
    path: f.path,
  }))

  const bundle = await buildBundleRelease({
    components,
    files: bundleFiles,
    host: 'airi',
    nativeVersion: options.nativeVersion ?? { min: 1, max: 1 },
    product: 'airi',
    releaseId,
    signingKey,
    version,
  })

  const channelRelease = await buildChannelFile({
    bundle,
    channel,
    product: 'airi',
    signingKey,
  })

  const writtenFiles: string[] = []
  const stages = uploadStages([bundle], [channelRelease])

  for (const stage of stages) {
    for (const file of stage) {
      const fullPath = join(storeRoot, file.key)
      mkdirSync(dirname(fullPath), { recursive: true })

      let bytesToWrite = file.bytes
      if (options.corruptSignature && file.key.endsWith('.sig')) {
        // Intentionally tamper with signature bytes to test rejection
        const tampered = new Uint8Array(file.bytes)
        tampered[0] = (tampered[0] ^ 0xFF)
        bytesToWrite = tampered
      }

      writeFileSync(fullPath, bytesToWrite)
      writtenFiles.push(file.key)
    }
  }

  return {
    releaseId,
    version,
    channel,
    bundle,
    channelRelease,
    writtenFiles,
  }
}

// CLI execution
const isCli = process.argv[1] && (
  process.argv[1].endsWith('generate-manifest.ts')
  || process.argv[1].endsWith('generate-manifest.js')
)

if (isCli) {
  const args = process.argv.slice(2)
  const storeIdx = args.indexOf('--store')
  const storeDir = storeIdx !== -1 ? args[storeIdx + 1] : join(process.cwd(), 'out', 'update-store')
  const versionIdx = args.indexOf('--version')
  const version = versionIdx !== -1 ? args[versionIdx + 1] : '0.9.43-canary.1'
  const channelIdx = args.indexOf('--channel')
  const channel = (channelIdx !== -1 ? args[channelIdx + 1] : 'canary') as any
  const corrupt = args.includes('--corrupt')
  const requiresRestart = args.includes('--restart')

  createMockRelease({
    storeDir,
    version,
    channel,
    corruptSignature: corrupt,
    requires: requiresRestart ? 'restart' : 'reload',
  }).then((res) => {
    console.info(`[test-updater] Generated ${res.channel} release:`)
    console.info(`  Release ID: ${res.releaseId}`)
    console.info(`  Version:    ${res.version}`)
    console.info(`  Files (${res.writtenFiles.length}):\n    ${res.writtenFiles.join('\n    ')}`)
  }).catch((err) => {
    console.error('[test-updater] Failed to generate release:', err)
    process.exit(1)
  })
}
