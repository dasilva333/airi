import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { env } from 'node:process'

import { bundleReleaseFromBuild } from '@ergosphere-it/electron/release'
import { keyPairFromPrivateKey } from '@ergosphere-it/protocol'
import { buildChannelFile, uploadStages } from '@ergosphere-it/publish'

interface PublishOptions {
  channel: 'stable' | 'canary' | 'dev' | 'nightly'
  bucket: string
  dryRun: boolean
  outDir: string
  workerUrl: string
}

async function uploadFileViaWorker(
  workerUrl: string,
  token: string,
  key: string,
  bytes: Uint8Array,
  isCAS: boolean,
): Promise<'skipped' | 'uploaded'> {
  const fileUrl = `${workerUrl.replace(/\/+$/, '')}/${key}`

  // If CAS object, check if it already exists to save bandwidth and time
  if (isCAS) {
    try {
      const headRes = await fetch(fileUrl, { method: 'HEAD' })
      if (headRes.status === 200) {
        return 'skipped'
      }
    }
    catch {}
  }

  let retries = 3
  while (retries > 0) {
    try {
      const res = await fetch(fileUrl, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Length': bytes.byteLength.toString(),
        },
        body: bytes,
      })

      if (res.status === 200) {
        return 'uploaded'
      }
      throw new Error(`Worker returned ${res.status}: ${await res.text()}`)
    }
    catch (err) {
      retries--
      if (retries === 0)
        throw err
      await new Promise(r => setTimeout(r, 500))
    }
  }
  return 'uploaded'
}

async function uploadStageConcurrently(
  stageFiles: Array<{ key: string, bytes: Uint8Array }>,
  workerUrl: string,
  token: string,
  isCAS: boolean,
  concurrency = 25,
) {
  let done = 0
  let uploaded = 0
  let skipped = 0
  const total = stageFiles.length

  const queue = [...stageFiles]
  const workers = Array.from({ length: concurrency }).map(async () => {
    while (queue.length > 0) {
      const file = queue.shift()
      if (!file)
        break

      const status = await uploadFileViaWorker(workerUrl, token, file.key, file.bytes, isCAS)
      done++
      if (status === 'uploaded')
        uploaded++
      else
        skipped++

      if (done % 50 === 0 || done === total) {
        process.stdout.write(`\r    [${done}/${total}] Uploaded: ${uploaded}, Skipped: ${skipped}`)
      }
    }
  })

  await Promise.all(workers)
  process.stdout.write('\n')
}

async function main() {
  const args = process.argv.slice(2)
  const channelIdx = args.indexOf('--channel')
  const channel = (channelIdx !== -1 ? args[channelIdx + 1] : 'canary') as PublishOptions['channel']
  const bucketIdx = args.indexOf('--bucket')
  const bucket = bucketIdx !== -1 ? args[bucketIdx + 1] : 'airi-updates'
  const workerIdx = args.indexOf('--worker-url')
  const workerUrl = workerIdx !== -1 ? args[workerIdx + 1] : (env.AIRI_UPDATES_WORKER_URL || 'https://airi-updates.r1ch4rd.workers.dev')
  const token = env.ERGOSPHERE_UPLOAD_TOKEN || 'airi-ota-secret-20261028'
  const dryRun = args.includes('--dry-run')
  const outDir = resolve(process.cwd(), 'out')
  const storeDir = resolve(outDir, 'update-store')

  console.log(`==> AIRI OTA Release Publisher`)
  console.log(`  Channel:    ${channel}`)
  console.log(`  Bucket:     ${bucket}`)
  console.log(`  Worker URL: ${workerUrl}`)
  console.log(`  Dry Run:    ${dryRun ? 'YES (local only)' : 'NO (uploading to Cloudflare via Worker)'}`)
  console.log(`  Out Dir:    ${outDir}`)

  const bundleJsonPath = join(outDir, 'bundle.json')
  const bundleDirPath = join(outDir, 'bundle')

  if (!existsSync(bundleJsonPath) || !existsSync(bundleDirPath)) {
    console.error(`Error: Bundle not found at ${outDir}. Run 'pnpm run build' first.`)
    process.exit(1)
  }

  // Load Ed25519 signing key
  const keyPath = resolve(process.cwd(), '../../.cache/keys/updater.pkcs8.key')
  const pem = env.ERGOSPHERE_IT_SIGNING_KEY || (existsSync(keyPath) ? readFileSync(keyPath, 'utf8') : null)

  if (!pem) {
    console.error(`Error: Signing key not found at ${keyPath} or in ERGOSPHERE_IT_SIGNING_KEY.`)
    process.exit(1)
  }

  const keyPair = await keyPairFromPrivateKey(pem)
  console.log(`✓ Loaded signing key: ${keyPair.signingKey.keyId}`)

  // Build signed bundle release from build output
  console.log(`Building signed bundle from ${outDir}...`)
  const bundle = await bundleReleaseFromBuild({
    outDir,
    signingKey: keyPair.signingKey,
  })

  console.log(`✓ Bundle built: v${bundle.version} (Release ID: ${bundle.releaseId})`)

  // Build signed channel manifest
  console.log(`Generating channel manifest for '${channel}'...`)
  const channelRelease = await buildChannelFile({
    bundle,
    channel,
    product: bundle.product || 'ai.moeru.airi.dasilva333',
    signingKey: keyPair.signingKey,
  })

  // Stage files
  const stages = uploadStages([bundle], [channelRelease])
  const totalFiles = stages.reduce((acc, stage) => acc + stage.length, 0)
  console.log(`✓ Prepared ${totalFiles} release artifacts across ${stages.length} stages`)

  // Write files to local store directory first
  for (const stage of stages) {
    for (const file of stage) {
      const targetPath = join(storeDir, file.key)
      mkdirSync(dirname(targetPath), { recursive: true })
      writeFileSync(targetPath, file.bytes)
    }
  }
  console.log(`✓ Exported local store to ${storeDir}`)

  if (dryRun) {
    console.log(`\nDry run completed! No files were uploaded.`)
    return
  }

  // Upload to Cloudflare R2 in strict dependency order:
  // Stage 0: CAS objects (payloads)
  // Stage 1: Bundle manifest & signature
  // Stage 2: Channel manifest & signature
  console.log(`\nUploading to Cloudflare Edge via Worker (${workerUrl})...`)

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    const isCAS = i === 0
    console.log(`--> Uploading Stage ${i + 1}/${stages.length} (${stage.length} files, isCAS=${isCAS})...`)
    await uploadStageConcurrently(stage, workerUrl, token, isCAS, 25)
  }

  console.log(`\n✓ Successfully published v${bundle.version} to channel '${channel}'!`)
  console.log(`  Feed URL: ${workerUrl.replace(/\/+$/, '')}/channels/${channel}.json`)
}

main().catch((err) => {
  console.error('Publish failed:', err)
  process.exit(1)
})
