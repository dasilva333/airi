/**
 * optimize_backgrounds.mjs
 *
 * Standalone Node.js script (no Electron required) that batch re-encodes
 * all PNG backgrounds on the remote Samba share to AVIF via sharp.
 *
 * Processes one file at a time to keep memory usage flat — no accumulation.
 * Deletes the original .png after a successful .avif write.
 *
 * Usage:
 *   node scripts/optimize_backgrounds.mjs [backup-dir] [--webp] [--quality=N] [--dry-run]
 *
 * Options:
 *   --webp        Output WebP instead of AVIF
 *   --quality=N   Encoder quality 1-100 (default: 72 for AVIF, 80 for WebP)
 *   --dry-run     Report what would change without writing
 *   --concurrency=N  Parallel encodes (default: 4)
 */

import fs from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2)
const backupDir = args.find(a => !a.startsWith('--')) || process.env.AIRI_BACKUP_DIR || '/Volumes/AIRI-Backup-Share'
const dryRun = args.includes('--dry-run')
const useWebP = args.includes('--webp')
const qualityArg = args.find(a => a.startsWith('--quality='))
const concurrencyArg = args.find(a => a.startsWith('--concurrency='))
const quality = qualityArg ? Number.parseInt(qualityArg.split('=')[1]) : (useWebP ? 80 : 72)
const concurrency = concurrencyArg ? Number.parseInt(concurrencyArg.split('=')[1]) : 4
const outExt = useWebP ? '.webp' : '.avif'
const outMime = useWebP ? 'WebP' : 'AVIF'

const REMOTE_BG_DIR = path.join(backupDir, 'assets', 'backgrounds')

// ─── Startup Banner ──────────────────────────────────────────────────────────
console.log(`
╔══════════════════════════════════════════════════════════╗
║       AIRI Background AVIF Optimization Script           ║
╠══════════════════════════════════════════════════════════╣
║  Backup dir  : ${backupDir.padEnd(42)}║
║  Output      : ${outMime.padEnd(42)}║
║  Quality     : ${String(quality).padEnd(42)}║
║  Concurrency : ${String(concurrency).padEnd(42)}║
║  Mode        : ${(dryRun ? 'DRY RUN (no writes)' : 'LIVE').padEnd(42)}║
╚══════════════════════════════════════════════════════════╝
`)

// ─── Validate sharp ───────────────────────────────────────────────────────────
let sharp
try {
  sharp = (await import('sharp')).default
  // Verify it actually works
  await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .png()
    .toBuffer()
  console.log('[Optimizer] ✔ sharp loaded and verified\n')
}
catch (e) {
  console.error('[Optimizer] ✗ sharp not available or broken:', e.message)
  console.error('  Run: pnpm add -D sharp  or  npm install sharp')
  process.exit(1)
}

// ─── Discover remote PNG files ────────────────────────────────────────────────
if (!fs.existsSync(REMOTE_BG_DIR)) {
  console.error(`[Optimizer] ✗ Remote backgrounds directory not found: ${REMOTE_BG_DIR}`)
  process.exit(1)
}

const allFiles = fs.readdirSync(REMOTE_BG_DIR)
const pngFiles = allFiles.filter(f => f.endsWith('.png'))
const alreadyConverted = new Set(allFiles.filter(f => f.endsWith('.avif') || f.endsWith('.webp')).map(f => f.replace(/\.(avif|webp)$/, '')))

// Skip PNGs that already have a converted counterpart
const toConvert = pngFiles.filter(f => !alreadyConverted.has(f.replace('.png', '')))
const alreadyDone = pngFiles.length - toConvert.length

console.log(`[Optimizer] Found ${pngFiles.length} PNG files on remote`)
console.log(`[Optimizer] Already converted: ${alreadyDone}`)
console.log(`[Optimizer] To convert: ${toConvert.length}\n`)

if (toConvert.length === 0) {
  console.log('✅ All backgrounds already converted. Nothing to do.')
  process.exit(0)
}

// ─── Conversion worker ────────────────────────────────────────────────────────
let converted = 0
let failed = 0
let savedBytes = 0

async function convertFile(pngFile) {
  const pngPath = path.join(REMOTE_BG_DIR, pngFile)
  const id = pngFile.replace('.png', '')
  const outFile = id + outExt
  const outPath = path.join(REMOTE_BG_DIR, outFile)

  try {
    const pngStat = fs.statSync(pngPath)
    const pngSize = pngStat.size

    if (dryRun) {
      console.log(`[DRY RUN] Would convert: ${pngFile} → ${outFile} (${(pngSize / 1024).toFixed(0)} KB)`)
      converted++
      return
    }

    // Re-encode via sharp — process one at a time in memory, then flush to disk
    const instance = sharp(pngPath)
    const meta = await instance.metadata()

    let encoder
    if (useWebP) {
      encoder = instance.webp({ quality, effort: 4 })
    }
    else {
      encoder = instance.avif({ quality, effort: 4, chromaSubsampling: '4:2:0' })
    }

    await encoder.toFile(outPath)

    const outStat = fs.statSync(outPath)
    const outSize = outStat.size
    const saving = pngSize - outSize
    savedBytes += saving

    const ratio = ((saving / pngSize) * 100).toFixed(1)
    console.log(`[${++converted}/${toConvert.length}] ${pngFile} → ${outFile} | ${(pngSize / 1024).toFixed(0)} KB → ${(outSize / 1024).toFixed(0)} KB (${ratio}% smaller)`)

    // Delete the original PNG only after successful encode
    fs.unlinkSync(pngPath)
  }
  catch (err) {
    console.error(`[FAIL] ${pngFile}: ${err.message}`)
    // Clean up partial output if it exists
    if (fs.existsSync(outPath)) {
      try { fs.unlinkSync(outPath) }
      catch {}
    }
    failed++
  }
}

// ─── Process in controlled concurrency batches ────────────────────────────────
async function runWithConcurrency(items, worker, limit) {
  let index = 0
  async function next() {
    while (index < items.length) {
      const item = items[index++]
      await worker(item)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next))
}

const startTime = Date.now()
await runWithConcurrency(toConvert, convertFile, concurrency)
const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

// ─── Summary ──────────────────────────────────────────────────────────────────
const savedMB = (savedBytes / (1024 * 1024)).toFixed(2)
const savedGB = (savedBytes / (1024 * 1024 * 1024)).toFixed(3)

console.log(`
╔══════════════════════════════════════════════════════════╗
║                  OPTIMIZATION SUMMARY                     ║
╠══════════════════════════════════════════════════════════╣
║  Converted  : ${String(converted).padEnd(42)}║
║  Failed     : ${String(failed).padEnd(42)}║
║  Space saved: ${`${savedMB} MB (${savedGB} GB)`.padEnd(42)}║
║  Time taken : ${`${elapsed}s`.padEnd(42)}║
╚══════════════════════════════════════════════════════════╝
`)

if (failed > 0) {
  console.warn(`⚠️  ${failed} file(s) failed to convert. Original PNGs preserved for those.`)
  process.exit(1)
}
else if (!dryRun) {
  console.log('✅ All backgrounds converted successfully.')
  console.log(`   The sync engine will now download ${outMime} files when restoring from remote.`)
}
