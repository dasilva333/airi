/**
 * LevelDB Integrity Guard for Electron Main Process
 *
 * Intercepts and detects LevelDB checksum mismatches and Write-Ahead Log (WAL)
 * corruptions in IndexedDB *before* Chromium's storage process attempts to open
 * the database.
 *
 * Architectural rationale:
 * Chromium's content layer (content/browser/indexed_db/instance/leveldb/backing_store.cc)
 * treats IndexedDB as an ephemeral browser cache. If LevelDB reports a checksum mismatch
 * on startup, Chromium's hardcoded behavior is to permanently delete the entire LevelDB
 * directory (`DestroyDatabase`), obliterating user chat histories and localforage assets.
 *
 * By running this pre-flight guard before any renderer window is created, AIRI catches
 * corruptions, creates a forensic diagnostic dump, presents a clear user warning,
 * and halts the process before Chromium can nuke the data.
 */

import fs from 'node:fs'
import path from 'node:path'

import { dialog } from 'electron'

// ============================================================================
// Castagnoli CRC32C Engine (Matching LevelDB specification)
// ============================================================================

const CRC32C_POLYNOMIAL = 0x82F63B78
const crc32cTable = new Uint32Array(256)

for (let i = 0; i < 256; i++) {
  let crc = i
  for (let j = 0; j < 8; j++) {
    crc = (crc & 1) ? (CRC32C_POLYNOMIAL ^ (crc >>> 1)) : (crc >>> 1)
  }
  crc32cTable[i] = crc >>> 0
}

export function computeCrc32c(buf: Buffer, offset = 0, length = buf.length): number {
  let crc = 0xFFFFFFFF
  for (let i = offset; i < offset + length; i++) {
    crc = crc32cTable[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

const K_MASK_DELTA = 0xA282EAD8 >>> 0

export function unmaskCrc32c(masked: number): number {
  const rot = (masked - K_MASK_DELTA) >>> 0
  return ((rot >>> 17) | (rot << 15)) >>> 0
}

// ============================================================================
// LevelDB WAL Log Validator
// ============================================================================

export interface WalValidationResult {
  valid: boolean
  totalRecords: number
  lastValidOffset: number
  error?: string
}

const LEVELDB_BLOCK_SIZE = 32768 // 32 KB

export function validateWalBuffer(buf: Buffer): WalValidationResult {
  let offset = 0
  let recordCount = 0
  let lastValidOffset = 0

  while (offset < buf.length) {
    const blockRemaining = LEVELDB_BLOCK_SIZE - (offset % LEVELDB_BLOCK_SIZE)

    // LevelDB record header is 7 bytes: 4 bytes CRC + 2 bytes length + 1 byte type
    if (blockRemaining < 7) {
      // Trailing zero-padding at block end
      offset += blockRemaining
      continue
    }

    if (offset + 7 > buf.length) {
      return {
        valid: false,
        totalRecords: recordCount,
        lastValidOffset,
        error: `Incomplete record header at file tail (offset ${offset})`,
      }
    }

    const maskedCrc = buf.readUInt32LE(offset)
    const length = buf.readUInt16LE(offset + 4)
    const type = buf.readUInt8(offset + 6)

    // Zero-type padding
    if (type === 0 && length === 0) {
      offset += blockRemaining
      continue
    }

    if (7 + length > blockRemaining) {
      return {
        valid: false,
        totalRecords: recordCount,
        lastValidOffset,
        error: `Record length ${length} exceeds block boundary at offset ${offset}`,
      }
    }

    if (offset + 7 + length > buf.length) {
      return {
        valid: false,
        totalRecords: recordCount,
        lastValidOffset,
        error: `Truncated record payload at offset ${offset} (expected ${7 + length} bytes, file ends early)`,
      }
    }

    const expectedCrc = unmaskCrc32c(maskedCrc)
    const actualCrc = computeCrc32c(buf, offset + 6, 1 + length)

    if (expectedCrc !== actualCrc) {
      return {
        valid: false,
        totalRecords: recordCount,
        lastValidOffset,
        error: `CRC32C checksum mismatch at offset ${offset} (expected 0x${expectedCrc.toString(16)}, got 0x${actualCrc.toString(16)})`,
      }
    }

    recordCount++
    offset += 7 + length
    lastValidOffset = offset
  }

  return {
    valid: true,
    totalRecords: recordCount,
    lastValidOffset,
  }
}

export function validateLevelDbWalLog(filePath: string): WalValidationResult {
  try {
    const buf = fs.readFileSync(filePath)
    return validateWalBuffer(buf)
  }
  catch (err) {
    return {
      valid: false,
      totalRecords: 0,
      lastValidOffset: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Valid 7-byte empty LevelDB record header (type 1, length 0, CRC computed).
 * Used to safely replace isolated corrupted headers without breaking subsequent records.
 */
const ZERO_RECORD_HEADER = Buffer.from('052b2843000001', 'hex')

export interface WalRepairResult {
  repaired: boolean
  repairedBuf?: Buffer
  totalRecords?: number
  strategy?: 'zero_header_patch' | 'truncation'
}

/**
 * Attempts non-destructive repairs on a corrupted LevelDB WAL buffer:
 * 1. Zero-header patch: if a 7-byte header was corrupted but subsequent records remain valid.
 * 2. Truncation: truncates cleanly to the last valid record boundary (dropping only incomplete tail writes).
 */
export function attemptWalRepair(buf: Buffer, lastValidOffset: number): WalRepairResult {
  // Strategy 1: Test replacing 7 corrupted bytes at lastValidOffset with a zero-length record
  if (lastValidOffset + 7 <= buf.length) {
    const candidate = Buffer.from(buf)
    ZERO_RECORD_HEADER.copy(candidate, lastValidOffset)
    const testResult = validateWalBuffer(candidate)
    if (testResult.valid) {
      return {
        repaired: true,
        repairedBuf: candidate,
        totalRecords: testResult.totalRecords,
        strategy: 'zero_header_patch',
      }
    }
  }

  // Strategy 2: Clean truncation to last valid offset
  if (lastValidOffset > 0) {
    const candidate = Buffer.from(buf.subarray(0, lastValidOffset))
    const testResult = validateWalBuffer(candidate)
    if (testResult.valid) {
      return {
        repaired: true,
        repairedBuf: candidate,
        totalRecords: testResult.totalRecords,
        strategy: 'truncation',
      }
    }
  }

  return { repaired: false }
}

// ============================================================================
// Main Pre-flight Interceptor
// ============================================================================

const WARNING_FLAG_FILENAME = '.db-corruption-warning-presented'

/**
 * Checks all IndexedDB LevelDB databases in userData for corruption.
 * If corruption is detected, saves a forensic diagnostic snapshot,
 * attempts non-destructive auto-repair, or presents an informative OS dialog
 * and halts the app before Chromium can delete the database.
 *
 * Returns `true` if safe to proceed, or halts the application and returns `false`.
 */
export function ensureLevelDBIntegrityOrHalt(userDataPath: string): boolean {
  try {
    const indexedDbDir = path.join(userDataPath, 'IndexedDB')
    if (!fs.existsSync(indexedDbDir)) {
      return true
    }

    const warningFlagPath = path.join(userDataPath, WARNING_FLAG_FILENAME)

    // If the user was already warned on the previous launch, allow Chromium to proceed
    if (fs.existsSync(warningFlagPath)) {
      console.warn('[LevelDBGuard] Prior corruption warning flag found. User acknowledged restart; allowing boot.')
      try {
        fs.unlinkSync(warningFlagPath)
      }
      catch {}
      return true
    }

    const entries = fs.readdirSync(indexedDbDir, { withFileTypes: true })
    const levelDbDirs = entries
      .filter(e => e.isDirectory() && e.name.endsWith('.leveldb'))
      .map(e => path.join(indexedDbDir, e.name))

    for (const dbDir of levelDbDirs) {
      const currentPath = path.join(dbDir, 'CURRENT')
      if (!fs.existsSync(currentPath)) {
        continue // Database not yet initialized
      }

      // Check log files
      const dbFiles = fs.readdirSync(dbDir)
      const logFiles = dbFiles.filter(f => f.endsWith('.log'))

      for (const logFile of logFiles) {
        const fullLogPath = path.join(dbDir, logFile)
        const result = validateLevelDbWalLog(fullLogPath)

        if (!result.valid) {
          console.error(`[LevelDBGuard] CRITICAL: Corrupted LevelDB WAL detected in ${logFile}: ${result.error}`)

          // 1. Create forensic diagnostic copy of the untouched corrupt database
          const timestamp = Date.now()
          const diagDir = path.join(userDataPath, 'diagnostics', `corrupted-indexeddb-${timestamp}`)
          try {
            fs.mkdirSync(diagDir, { recursive: true })
            fs.cpSync(dbDir, diagDir, { recursive: true })
          }
          catch (copyErr) {
            console.error('[LevelDBGuard] Failed to write diagnostic copy:', copyErr)
          }

          // 2. Attempt non-destructive auto-repair
          const rawBuf = fs.readFileSync(fullLogPath)
          const repair = attemptWalRepair(rawBuf, result.lastValidOffset)

          if (repair.repaired && repair.repairedBuf) {
            console.log(
              `[LevelDBGuard] Auto-repair succeeded using strategy '${repair.strategy}'! `
              + `Preserved ${repair.totalRecords} records in ${logFile}. `
              + `Forensic snapshot saved to ${diagDir}. Continuing startup safely.`,
            )
            fs.writeFileSync(fullLogPath, repair.repairedBuf)
            continue
          }

          // 3. If unrepairable, write warning flag so next start knows the warning was shown
          try {
            fs.writeFileSync(
              warningFlagPath,
              JSON.stringify({
                timestamp,
                database: path.basename(dbDir),
                file: logFile,
                error: result.error,
                lastValidOffset: result.lastValidOffset,
                diagnosticDump: diagDir,
              }, null, 2),
            )
          }
          catch {}

          // 4. Present native OS error dialog and halt before Chromium deletes it
          const message
            = `AIRI caught a LevelDB corruption before Chromium could delete your database!\n\n`
              + `Database: ${path.basename(dbDir)}\n`
              + `File: ${logFile}\n`
              + `Cause: ${result.error}\n\n`
              + `To protect your chat history and models from being permanently wiped by Chromium, AIRI has safely halted.\n\n`
              + `A diagnostic snapshot has been preserved at:\n${diagDir}\n\n`
              + `If you launch AIRI again, it will allow Chromium to recreate the database or you can restore from Cloud Sync.`

          console.error(`\n${'='.repeat(70)}`)
          console.error('[LevelDBGuard] FATAL: UNRECOVERABLE DATABASE CORRUPTION')
          console.error(`[LevelDBGuard] Diagnostic snapshot preserved at: ${diagDir}`)
          console.error(`${'='.repeat(70)}\n`)

          try {
            dialog.showErrorBox('Database Corruption Intercepted', message)
          }
          catch {}

          process.exit(1)
        }
      }
    }

    console.log('[LevelDBGuard] IndexedDB LevelDB integrity verified (clean).')
    return true
  }
  catch (err) {
    console.warn('[LevelDBGuard] Error during pre-flight LevelDB scan (continuing):', err)
    return true
  }
}
