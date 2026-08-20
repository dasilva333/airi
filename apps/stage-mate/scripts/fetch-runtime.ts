import fs from 'node:fs'
import path from 'node:path'

import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(here, '..')
const binDir = path.resolve(rootDir, 'bin')

// Default GitHub release endpoint for prebuilt Stage-Mate companion binaries
const DEFAULT_TAG = 'stagemate-engine-v3.4'
const BASE_URL = process.env.STAGEMATE_RELEASE_URL || `https://github.com/dasilva333/airi/releases/download/${DEFAULT_TAG}`

function getPlatformAsset(): { name: string, url: string, expectedExe: string } {
  const platform = process.platform
  if (platform === 'darwin') {
    return {
      name: 'StageMate-macOS.zip',
      url: `${BASE_URL}/StageMate-macOS.zip`,
      expectedExe: path.join(binDir, 'StageMate.app', 'Contents', 'MacOS', 'StageMate'),
    }
  }
  if (platform === 'win32') {
    return {
      name: 'StageMate-Windows.zip',
      url: `${BASE_URL}/StageMate-Windows.zip`,
      expectedExe: path.join(binDir, 'StageMate.exe'),
    }
  }
  if (platform === 'linux') {
    return {
      name: 'StageMate-Linux.zip',
      url: `${BASE_URL}/StageMate-Linux.zip`,
      expectedExe: path.join(binDir, 'StageMate.x86_64'),
    }
  }
  throw new Error(`Unsupported platform for prebuilt Stage-Mate runtime: ${platform}`)
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  console.log(`[fetch-runtime] Connecting to ${url}...`)
  const response = await fetch(url, { redirect: 'follow' })

  if (!response.ok) {
    throw new Error(`Failed to download binary asset (HTTP ${response.status} ${response.statusText}): ${url}`)
  }

  const totalBytes = Number(response.headers.get('content-length') || 0)
  const fileStream = fs.createWriteStream(destPath)

  if (!response.body) {
    throw new Error('Response body is null')
  }

  let receivedBytes = 0
  let lastLoggedPercent = -1

  const reader = response.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done)
      break
    if (value) {
      receivedBytes += value.length
      fileStream.write(Buffer.from(value))

      if (totalBytes > 0) {
        const percent = Math.floor((receivedBytes / totalBytes) * 100)
        if (percent % 10 === 0 && percent !== lastLoggedPercent) {
          lastLoggedPercent = percent
          const mbReceived = (receivedBytes / (1024 * 1024)).toFixed(1)
          const mbTotal = (totalBytes / (1024 * 1024)).toFixed(1)
          console.log(`[fetch-runtime] Progress: ${percent}% (${mbReceived} MB / ${mbTotal} MB)`)
        }
      }
    }
  }

  await new Promise<void>((resolve, reject) => {
    fileStream.end(() => resolve())
    fileStream.on('error', reject)
  })
}

function extractZip(zipPath: string, targetDir: string): void {
  console.log(`[fetch-runtime] Extracting archive into ${targetDir}...`)
  fs.mkdirSync(targetDir, { recursive: true })

  if (process.platform === 'win32') {
    try {
      execSync(`tar -xf "${zipPath}" -C "${targetDir}"`, { stdio: 'inherit' })
    }
    catch {
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${targetDir}' -Force"`, { stdio: 'inherit' })
    }
  }
  else {
    execSync(`unzip -q -o "${zipPath}" -d "${targetDir}"`, { stdio: 'inherit' })
  }
}

async function main() {
  console.log('=== Stage-Mate Companion Runtime Fetcher ===')
  const asset = getPlatformAsset()

  fs.mkdirSync(binDir, { recursive: true })
  const tempZip = path.join(binDir, asset.name)

  try {
    await downloadFile(asset.url, tempZip)
    extractZip(tempZip, binDir)

    // Set execute permissions on macOS / Linux
    if (process.platform === 'darwin') {
      const candidates = [
        path.join(binDir, 'StageMate.app', 'Contents', 'MacOS', 'StageMate'),
        path.join(binDir, 'StageMate.app', 'Contents', 'MacOS', 'MateEngineX'),
        path.join(binDir, 'StageMate', 'StageMate.app', 'Contents', 'MacOS', 'StageMate'),
        path.join(binDir, 'StageMate', 'StageMate.app', 'Contents', 'MacOS', 'MateEngineX'),
      ]
      for (const cand of candidates) {
        if (fs.existsSync(cand)) {
          fs.chmodSync(cand, 0o755)
          console.log(`[fetch-runtime] Granted execution permission (+x) to ${cand}`)
        }
      }
    }
    else if (process.platform === 'linux') {
      const cand = path.join(binDir, 'StageMate.x86_64')
      if (fs.existsSync(cand)) {
        fs.chmodSync(cand, 0o755)
        console.log(`[fetch-runtime] Granted execution permission (+x) to ${cand}`)
      }
    }

    console.log(`[fetch-runtime] Stage-Mate companion runtime installed successfully to ${binDir}!`)
  }
  catch (err: any) {
    console.error(`[fetch-runtime] Error fetching runtime: ${err.message}`)
    process.exit(1)
  }
  finally {
    if (fs.existsSync(tempZip)) {
      try {
        fs.unlinkSync(tempZip)
      }
      catch {}
    }
  }
}

main()
