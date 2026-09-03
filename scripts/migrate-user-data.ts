import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

function formatBytes(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function calculateDirectorySize(dirPath: string): number {
  let total = 0
  try {
    if (!fs.existsSync(dirPath))
      return 0
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += calculateDirectorySize(fullPath)
      }
      else if (entry.isFile()) {
        total += fs.statSync(fullPath).size
      }
    }
  }
  catch {}
  return total
}

function directoryContainsUserData(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath))
      return false
    const hasIndexedDb = fs.existsSync(path.join(dirPath, 'IndexedDB'))
    const hasLocalStorage = fs.existsSync(path.join(dirPath, 'Local Storage'))
    const hasAppConfig = fs.existsSync(path.join(dirPath, 'app-config.json'))
    if (hasIndexedDb || hasLocalStorage || hasAppConfig)
      return true

    const entries = fs.readdirSync(dirPath)
    return entries.some(f => f.endsWith('.json') && f !== 'package.json')
  }
  catch {
    return false
  }
}

function runMigration() {
  const platform = process.platform
  const home = os.homedir()

  let candidates: string[] = []
  let targetDir = ''

  if (platform === 'darwin') {
    const appSupport = path.join(home, 'Library', 'Application Support')
    targetDir = path.join(appSupport, 'ai.moeru.airi.dasilva333')
    candidates = [
      path.join(appSupport, '@proj-airi', 'stage-tamagotchi'),
      path.join(appSupport, 'ai.moeru.airi'),
      path.join(appSupport, 'ai.moeru.airi-fork'),
      path.join(appSupport, 'AIRI'),
      path.join(appSupport, 'airi'),
    ]
  }
  else if (platform === 'linux') {
    const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
    targetDir = path.join(configDir, 'ai.moeru.airi.dasilva333')
    candidates = [
      path.join(configDir, '@proj-airi', 'stage-tamagotchi'),
      path.join(configDir, 'ai.moeru.airi'),
      path.join(configDir, 'ai.moeru.airi-fork'),
      path.join(configDir, 'AIRI'),
      path.join(configDir, 'airi'),
    ]
  }
  else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    targetDir = path.join(appData, 'ai.moeru.airi.dasilva333')
    candidates = [
      path.join(appData, '@proj-airi', 'stage-tamagotchi'),
      path.join(appData, 'ai.moeru.airi'),
      path.join(appData, 'ai.moeru.airi-fork'),
      path.join(appData, 'AIRI'),
      path.join(appData, 'airi'),
    ]
  }
  else {
    console.error(`[Error] Unsupported platform: ${platform}`)
    process.exit(1)
  }

  console.log('========================================================')
  console.log(' AIRI Fork - User Data Instant Migration Tool')
  console.log('========================================================')
  console.log(`Target Isolated Directory: ${targetDir}`)

  if (fs.existsSync(targetDir) && directoryContainsUserData(targetDir)) {
    console.log(`\n✓ Target directory already exists and contains active user data.`)
    console.log(`  No migration needed. Your fork profile is already isolated!`)
    return
  }

  // Find candidate directories that exist and have user data, sorted by newest mtime
  const validCandidates = candidates
    .filter(p => fs.existsSync(p) && directoryContainsUserData(p))
    .map((p) => {
      try {
        return { path: p, mtime: fs.statSync(p).mtimeMs }
      }
      catch {
        return { path: p, mtime: 0 }
      }
    })
    .sort((a, b) => b.mtime - a.mtime)

  if (validCandidates.length === 0) {
    console.log('\nNotice: No existing legacy AIRI data directory found to migrate.')
    console.log('A fresh isolated profile will be created automatically on first launch.')
    return
  }

  const selectedSource = validCandidates[0].path
  const profileSize = calculateDirectorySize(selectedSource)

  console.log(`\nDetected active profile: ${selectedSource}`)
  console.log(`Profile Size:           ${formatBytes(profileSize)}`)
  console.log(`Operation:              Atomic Move (0 bytes extra disk space, 0 ms copy time)`)

  try {
    // If target directory exists but is empty, remove it before renaming
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    // Ensure parent directory of target exists
    fs.mkdirSync(path.dirname(targetDir), { recursive: true })

    // Atomic move
    fs.renameSync(selectedSource, targetDir)

    // Write migration complete marker
    const markerPath = path.join(targetDir, '.migration-complete')
    fs.writeFileSync(
      markerPath,
      JSON.stringify(
        {
          mode: 'atomic-move',
          migratedFrom: selectedSource,
          migratedTo: targetDir,
          profileSizeBytes: profileSize,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    )

    console.log('\n========================================================')
    console.log(' Migration Successful!')
    console.log(` - Source: ${selectedSource} -> [MOVED]`)
    console.log(` - Target: ${targetDir}`)
    console.log(` - Data:   ${formatBytes(profileSize)} preserved without duplication`)
    console.log(' - Status: Isolated and ready for AIRI (dasilva333)!')
    console.log('========================================================')
  }
  catch (err) {
    console.error('\n[Error] Failed to atomically move directory:', err)
    process.exit(1)
  }
}

runMigration()
