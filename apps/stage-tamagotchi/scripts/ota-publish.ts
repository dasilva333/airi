import { execSync } from 'node:child_process'
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
}

async function main() {
  const args = process.argv.slice(2)
  const channelIdx = args.indexOf('--channel')
  const channel = (channelIdx !== -1 ? args[channelIdx + 1] : 'canary') as PublishOptions['channel']
  const bucketIdx = args.indexOf('--bucket')
  const bucket = bucketIdx !== -1 ? args[bucketIdx + 1] : 'airi-updates'
  const dryRun = args.includes('--dry-run')
  const outDir = resolve(process.cwd(), 'out')
  const storeDir = resolve(outDir, 'update-store')

  console.log(`==> AIRI OTA Release Publisher`)
  console.log(`  Channel:  ${channel}`)
  console.log(`  Bucket:   ${bucket}`)
  console.log(`  Dry Run:  ${dryRun ? 'YES (local only)' : 'NO (uploading to Cloudflare R2)'}`)
  console.log(`  Out Dir:  ${outDir}`)

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
    product: 'airi',
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
  console.log(`\nUploading to Cloudflare R2 (${bucket})...`)

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i]
    console.log(`--> Uploading Stage ${i + 1}/${stages.length} (${stage.length} files)...`)

    for (const file of stage) {
      const localFile = join(storeDir, file.key)
      const r2Target = `${bucket}/${file.key}`
      process.stdout.write(`    Uploading ${file.key}... `)

      try {
        execSync(`npx wrangler r2 object put "${r2Target}" -f "${localFile}" --remote`, {
          stdio: 'pipe',
        })
        process.stdout.write(`OK\n`)
      }
      catch (err: any) {
        process.stdout.write(`FAILED\n`)
        console.error(`Error uploading ${file.key}:`, err?.message || err)
        process.exit(1)
      }
    }
  }

  console.log(`\n✓ Successfully published v${bundle.version} to channel '${channel}'!`)
  console.log(`  Feed URL: https://airi-updates.r1ch4rd.workers.dev/channels/${channel}.json`)
}

main().catch((err) => {
  console.error('Publish failed:', err)
  process.exit(1)
})
