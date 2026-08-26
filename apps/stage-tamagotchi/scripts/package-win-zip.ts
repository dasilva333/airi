import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { getPath7za } from 'builder-util'

const here = path.dirname(fileURLToPath(import.meta.url))
const tamagotchiDir = path.resolve(here, '..')
const distDir = path.join(tamagotchiDir, 'dist')
const winUnpackedDir = path.join(distDir, 'win-unpacked')
const stageFolderName = 'AIRI'
const stagedDir = path.join(distDir, stageFolderName)

async function resolve7za(): Promise<string> {
  try {
    const p = await getPath7za()
    if (fs.existsSync(p))
      return p
  }
  catch {}

  // Fallback to system binaries
  for (const cmd of ['7za', '7z']) {
    try {
      execSync(`${cmd} --help`, { stdio: 'ignore' })
      return cmd
    }
    catch {}
  }

  throw new Error('Could not find 7za executable. Please ensure builder-util is installed.')
}

async function main() {
  console.log('\n📦 [package-win-zip] Creating high-compatibility Windows ZIP archive...')

  if (!fs.existsSync(winUnpackedDir)) {
    console.error(`❌ Error: Unpacked Windows directory does not exist at: ${winUnpackedDir}`)
    process.exit(1)
  }

  const pkgJsonPath = path.join(tamagotchiDir, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'))
  const version = pkg.version
  const zipFilename = `AIRI-${version}-windows-x64.zip`
  const zipPath = path.join(distDir, zipFilename)

  if (fs.existsSync(zipPath)) {
    console.log(`  • Removing existing archive: ${zipFilename}`)
    fs.rmSync(zipPath, { force: true })
  }

  const sevenZipBin = await resolve7za()
  console.log(`  • Using 7za engine: ${sevenZipBin}`)
  console.log(`  • Wrapping unpacked directory inside root "${stageFolderName}/" folder...`)

  // Stage dist/win-unpacked as dist/AIRI temporarily so archive contains top-level root folder
  let wasRenamed = false
  if (fs.existsSync(stagedDir)) {
    fs.rmSync(stagedDir, { recursive: true, force: true })
  }

  try {
    fs.renameSync(winUnpackedDir, stagedDir)
    wasRenamed = true

    // -tzip: standard ZIP archive
    // -mx=7: Deflate compression level 7
    // -mm=Deflate: explicit standard Deflate compression method
    // -mcu=on: UTF-8 encoding for filenames
    const cmd = `"${sevenZipBin}" a -tzip -mx=7 -mm=Deflate -mcu=on "${zipPath}" "${stageFolderName}"`
    console.log(`  • Running: ${cmd}`)
    execSync(cmd, { cwd: distDir, stdio: 'inherit' })
  }
  finally {
    if (wasRenamed && fs.existsSync(stagedDir)) {
      fs.renameSync(stagedDir, winUnpackedDir)
    }
  }

  if (!fs.existsSync(zipPath)) {
    console.error(`❌ Error: Failed to generate ${zipPath}`)
    process.exit(1)
  }

  const stats = fs.statSync(zipPath)
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2)
  console.log(`✅ [package-win-zip] Successfully packaged Windows ZIP: ${zipFilename} (${sizeMb} MB)`)
}

main().catch((err) => {
  console.error('❌ [package-win-zip] Error packaging zip:', err)
  process.exit(1)
})
