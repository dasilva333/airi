import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const rootStageMate = join(here, '..')
const unitySrcDir = join(rootStageMate, 'unity-src')
const mateEngineDir = join(rootStageMate, 'mate-engine')
const targetStageMateAssets = join(mateEngineDir, 'Assets', 'StageMate')

export function setupMateEngine(): boolean {
  console.log('[setup] Initializing Stage-Mate workspace...')

  // 1. Clone upstream Mate-Engine if not present
  if (!existsSync(mateEngineDir)) {
    console.log('[setup] Cloning upstream shinyflvre/Mate-Engine...')
    const cloneRes = spawnSync('git', ['clone', 'https://github.com/shinyflvre/Mate-Engine.git', mateEngineDir], {
      stdio: 'inherit',
    })
    if (cloneRes.status !== 0) {
      console.error('[setup] Failed to clone Mate-Engine repository.')
      return false
    }
  }

  // 2. Ensure target Assets/StageMate folder exists
  if (!existsSync(targetStageMateAssets)) {
    mkdirSync(targetStageMateAssets, { recursive: true })
  }

  // 3. Overlay unity-src/ into Assets/StageMate/
  if (existsSync(unitySrcDir)) {
    console.log('[setup] Syncing unity-src/ -> mate-engine/Assets/StageMate/...')
    cpSync(unitySrcDir, targetStageMateAssets, { recursive: true, force: true })
  }

  // 4. Apply cross-platform macOS P/Invoke compilation fixes if needed
  patchMacCompatibility()

  console.log('[setup] Stage-Mate workspace ready.')
  return true
}

function patchMacCompatibility() {
  const windowHandlerPath = join(mateEngineDir, 'Assets', 'MATE ENGINE - Scripts', 'AvatarHandlers', 'AvatarWindowHandler.cs')
  if (existsSync(windowHandlerPath)) {
    let content = readFileSync(windowHandlerPath, 'utf8')
    // Remove conflicting #if UNITY_STANDALONE_WIN wraps on struct declarations if present
    if (content.includes('#if UNITY_STANDALONE_WIN\r\n    [StructLayout(LayoutKind.Sequential)]\r\n    struct RECT')
      || content.includes('#if UNITY_STANDALONE_WIN\n    [StructLayout(LayoutKind.Sequential)]\n    struct RECT')) {
      content = content.replace(/#if UNITY_STANDALONE_WIN\r?\n\s*(\[StructLayout\(LayoutKind\.Sequential\)\]\r?\n\s*struct RECT)/g, '$1')
      content = content.replace(/(struct MONITORINFO\s*\{[\s\S]*?\})\s*#endif/g, '$1')
      writeFileSync(windowHandlerPath, content, 'utf8')
      console.log('[setup] Applied macOS struct declaration fix to AvatarWindowHandler.cs')
    }
  }
}

// Allow direct CLI execution: tsx scripts/setup.ts
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const ok = setupMateEngine()
  process.exit(ok ? 0 : 1)
}
