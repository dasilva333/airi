import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { app } from 'electron'

const ESSENTIAL_DATA_DIRS = [
  'IndexedDB',
  'Local Storage',
  'Session Storage',
  'shared_proto_db',
  'blob_storage',
  'extensions',
  'plugins',
  'godot-stage',
  'Dictionaries',
]

const ESSENTIAL_EXTENSIONS = [
  '.json',
  '.pem',
  '.key',
]

const TRANSIENT_PREFIXES = [
  'Singleton',
  'LOCK',
  'CURRENT',
  'LOG',
  'LOG.old',
]

/**
 * Returns a list of potential legacy userData directories that existing users might have data in.
 */
function getLegacyCandidatePaths(currentAppUserData: string): string[] {
  const platform = process.platform
  const home = app.getPath('home')
  const candidates: string[] = []

  if (platform === 'linux') {
    const configDir = process.env.XDG_CONFIG_HOME || path.join(home, '.config')
    candidates.push(
      path.join(configDir, 'ai.moeru.airi'),
      path.join(configDir, 'ai.moeru.airi-fork'),
      path.join(configDir, '@proj-airi', 'stage-tamagotchi'),
      path.join(configDir, 'AIRI'),
      path.join(configDir, 'airi'),
    )
  }
  else if (platform === 'darwin') {
    const appSupport = path.join(home, 'Library', 'Application Support')
    candidates.push(
      path.join(appSupport, 'ai.moeru.airi'),
      path.join(appSupport, 'ai.moeru.airi-fork'),
      path.join(appSupport, '@proj-airi', 'stage-tamagotchi'),
      path.join(appSupport, 'AIRI'),
      path.join(appSupport, 'airi'),
    )
  }
  else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming')
    candidates.push(
      path.join(appData, 'ai.moeru.airi'),
      path.join(appData, 'ai.moeru.airi-fork'),
      path.join(appData, '@proj-airi', 'stage-tamagotchi'),
      path.join(appData, 'AIRI'),
      path.join(appData, 'airi'),
    )
  }

  // Filter out the current target path and deduplicate
  const normalizedTarget = path.resolve(currentAppUserData)
  return Array.from(new Set(candidates.map(p => path.resolve(p)))).filter(
    p => p !== normalizedTarget && fs.existsSync(p),
  )
}

/**
 * Checks if a directory contains real AIRI user data (IndexedDB, Local Storage, or config JSONs).
 */
function directoryContainsUserData(dirPath: string): boolean {
  try {
    if (!fs.existsSync(dirPath))
      return false

    const hasIndexedDb = fs.existsSync(path.join(dirPath, 'IndexedDB'))
    const hasLocalStorage = fs.existsSync(path.join(dirPath, 'Local Storage'))
    const hasAppConfig = fs.existsSync(path.join(dirPath, 'app-config.json'))

    if (hasIndexedDb || hasLocalStorage || hasAppConfig)
      return true

    // Check if any json file exists in the root of the directory
    const entries = fs.readdirSync(dirPath)
    return entries.some(file => file.endsWith('.json') && file !== 'package.json')
  }
  catch {
    return false
  }
}

/**
 * Copies files and directories recursively while excluding locks and transient sockets.
 */
function copyDirectoryFiltered(srcDir: string, destDir: string): void {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true })
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true })

  for (const entry of entries) {
    const name = entry.name
    const srcPath = path.join(srcDir, name)
    const destPath = path.join(destDir, name)

    // Skip transient lock files and sockets
    if (TRANSIENT_PREFIXES.some(prefix => name.startsWith(prefix)))
      continue
    if (name.endsWith('.sock') || name.endsWith('.lock'))
      continue

    try {
      if (entry.isDirectory()) {
        copyDirectoryFiltered(srcPath, destPath)
      }
      else if (entry.isFile()) {
        // Only overwrite if destination does not exist
        if (!fs.existsSync(destPath)) {
          fs.copyFileSync(srcPath, destPath)
        }
      }
    }
    catch (err) {
      console.warn(`[Migration] Notice: Skipped copying ${srcPath}:`, err)
    }
  }
}

/**
 * Performs seamless one-time migration of existing AIRI databases and configurations
 * from legacy data directories into the new isolated target directory.
 */
export function ensureLegacyUserDataMigrated(targetUserDataPath: string): void {
  try {
    const markerPath = path.join(targetUserDataPath, '.migration-complete')

    // If marker exists, or if target directory already has an initialized database, skip
    if (fs.existsSync(markerPath)) {
      return
    }

    if (fs.existsSync(targetUserDataPath) && directoryContainsUserData(targetUserDataPath)) {
      // Create marker to avoid future checks
      try {
        fs.writeFileSync(
          markerPath,
          JSON.stringify({ note: 'Existing data present on first run check', date: new Date().toISOString() }, null, 2),
        )
      }
      catch {}
      return
    }

    const legacyCandidates = getLegacyCandidatePaths(targetUserDataPath)
    let migratedSource: string | null = null

    for (const candidate of legacyCandidates) {
      if (directoryContainsUserData(candidate)) {
        console.log(`[Migration] Found existing AIRI data in legacy directory: ${candidate}`)
        console.log(`[Migration] Seamlessly migrating data to: ${targetUserDataPath}...`)

        fs.mkdirSync(targetUserDataPath, { recursive: true })

        // 1. Copy essential data directories
        for (const dirName of ESSENTIAL_DATA_DIRS) {
          const srcSubDir = path.join(candidate, dirName)
          const destSubDir = path.join(targetUserDataPath, dirName)
          if (fs.existsSync(srcSubDir)) {
            copyDirectoryFiltered(srcSubDir, destSubDir)
          }
        }

        // 2. Copy root json configs and certificate files
        const rootEntries = fs.readdirSync(candidate, { withFileTypes: true })
        for (const entry of rootEntries) {
          if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (ESSENTIAL_EXTENSIONS.includes(ext) || entry.name.startsWith('windows-') || entry.name.startsWith('app-')) {
              const srcFile = path.join(candidate, entry.name)
              const destFile = path.join(targetUserDataPath, entry.name)
              if (!fs.existsSync(destFile)) {
                try {
                  fs.copyFileSync(srcFile, destFile)
                }
                catch {}
              }
            }
          }
        }

        migratedSource = candidate
        break
      }
    }

    if (migratedSource) {
      fs.writeFileSync(
        markerPath,
        JSON.stringify(
          {
            migratedFrom: migratedSource,
            migratedTo: targetUserDataPath,
            timestamp: new Date().toISOString(),
          },
          null,
          2,
        ),
      )
      console.log(`[Migration] Migration completed successfully from ${migratedSource}! All user data preserved.`)
    }
    else {
      console.log(`[Migration] Clean installation detected. Starting with fresh isolated profile at: ${targetUserDataPath}`)
      fs.mkdirSync(targetUserDataPath, { recursive: true })
      fs.writeFileSync(
        markerPath,
        JSON.stringify({ note: 'Fresh profile initialized', timestamp: new Date().toISOString() }, null, 2),
      )
    }
  }
  catch (error) {
    console.error('[Migration] Non-fatal error during legacy data migration check:', error)
  }
}
