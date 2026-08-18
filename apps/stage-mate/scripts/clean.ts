import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CANONICAL_MATE_ENGINE_COMMIT } from './setup.js'

const here = fileURLToPath(new URL('.', import.meta.url))
const rootStageMate = join(here, '..')
const mateEngineDir = join(rootStageMate, 'mate-engine')

export function cleanMateEngine(): boolean {
  console.log(`[clean] Resetting mate-engine to canonical commit (${CANONICAL_MATE_ENGINE_COMMIT.slice(0, 8)})...`)

  if (!existsSync(mateEngineDir)) {
    console.log('[clean] mate-engine directory does not exist, nothing to clean.')
    return true
  }

  // 1. Reset all tracked files
  const resetRes = spawnSync('git', ['-C', mateEngineDir, 'reset', '--hard', CANONICAL_MATE_ENGINE_COMMIT], {
    stdio: 'inherit',
  })
  if (resetRes.status !== 0) {
    console.error('[clean] Failed to hard reset mate-engine.')
    return false
  }

  // 2. Clean all untracked files & directories
  const cleanRes = spawnSync('git', ['-C', mateEngineDir, 'clean', '-fd'], {
    stdio: 'inherit',
  })
  if (cleanRes.status !== 0) {
    console.error('[clean] Failed to clean untracked files in mate-engine.')
    return false
  }

  console.log('[clean] mate-engine is 100% clean and pristine!')
  return true
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  cleanMateEngine()
}
