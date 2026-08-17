import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
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

  // 2. Overlay unity-src/Assets/ -> mate-engine/Assets/
  const unityAssetsSrc = join(unitySrcDir, 'Assets')
  if (existsSync(unityAssetsSrc)) {
    console.log('[setup] Syncing unity-src/Assets/ -> mate-engine/Assets/...')
    cpSync(unityAssetsSrc, join(mateEngineDir, 'Assets'), { recursive: true, force: true })
  }

  // 3. Overlay unity-src/Patches/ -> mate-engine/Assets/MATE ENGINE - Scripts/
  const patchesSrc = join(unitySrcDir, 'Patches')
  const targetScripts = join(mateEngineDir, 'Assets', 'MATE ENGINE - Scripts')
  if (existsSync(patchesSrc) && existsSync(targetScripts)) {
    console.log('[setup] Applying patches -> mate-engine/Assets/MATE ENGINE - Scripts/...')
    cpSync(patchesSrc, targetScripts, { recursive: true, force: true })
  }

  // 3b. Overlay unity-src/Packages/ -> mate-engine/Assets/MATE ENGINE - Packages/
  const packagesSrc = join(unitySrcDir, 'Packages')
  const targetPackages = join(mateEngineDir, 'Assets', 'MATE ENGINE - Packages')
  if (existsSync(packagesSrc) && existsSync(targetPackages)) {
    console.log('[setup] Applying package patches -> mate-engine/Assets/MATE ENGINE - Packages/...')
    cpSync(packagesSrc, targetPackages, { recursive: true, force: true })
  }

  // 4. Overlay unity-src/ProjectSettings/ -> mate-engine/ProjectSettings/
  const projectSettingsSrc = join(unitySrcDir, 'ProjectSettings')
  if (existsSync(projectSettingsSrc)) {
    console.log('[setup] Syncing ProjectSettings -> mate-engine/ProjectSettings/...')
    cpSync(projectSettingsSrc, join(mateEngineDir, 'ProjectSettings'), { recursive: true, force: true })
  }

  // 5. Apply cross-platform macOS P/Invoke compilation fixes if needed
  patchMacCompatibility()

  // 6. Apply UI cleanup (disable AI section and Steam/DLC promo cards)
  patchSettingsMenuUI()

  console.log('[setup] Stage-Mate workspace ready.')
  return true
}

function patchSettingsMenuUI() {
  const scenePath = join(mateEngineDir, 'Assets', 'MATE ENGINE - Scenes', 'Mate Engine Main.unity')
  if (existsSync(scenePath)) {
    let content = readFileSync(scenePath, 'utf8')
    let modified = false

    // 1. Disable category sections and promo card graphic containers
    const targetNames = [
      '= FOOD SYSTEM',
      '= Steam Exklusives',
      '= STEAM DLC',
      '= MINECRAFT',
      '= AI',
      'Food System',
      'MinecraftPanel',
      'SteamContent',
      'STEAM_DLC',
      'STEAM_FS',
      'STEAM_MC',
    ]

    for (const name of targetNames) {
      const pattern = new RegExp(`(m_Name: ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?\\n[\\s\\S]*?m_IsActive:) 1`, 'g')
      if (pattern.test(content)) {
        content = content.replace(pattern, '$1 0')
        modified = true
      }
    }

    // 2. Disable Category Background card frames: Image (10) [AI], Image (12) [Steam DLC], Image (13) [Minecraft], Image (14) [Food]
    const targetBackgroundGOs = [
      '1420350588', // Image (10) - AI card frame
      '1409282222', // Image (12) - Steam DLC card frame
      '1922270003', // Image (13) - Minecraft card frame
      '839638719', // Image (14) - Food System card frame
    ]

    for (const goId of targetBackgroundGOs) {
      const pattern = new RegExp(`(--- !u!1 &${goId}\\r?\\n[\\s\\S]*?m_IsActive:) 1`, 'g')
      if (pattern.test(content)) {
        content = content.replace(pattern, '$1 0')
        modified = true
      }
    }

    // 3. Shift DEBUG section and its background card Image (11) up into the AI slot
    // Shift DEBUG RT 976934797 from y=-3418 to y=-2604
    const debugRtPattern = /(--- !u!224 &976934797\r?\n[\s\S]*?m_AnchoredPosition: \{x: [^,]+, y:) -3418(\})/g
    if (debugRtPattern.test(content)) {
      content = content.replace(debugRtPattern, '$1 -2604$2')
      modified = true
    }

    // Shift Image (11) RT 820205948 from y=-3643.0002 to y=-2828
    const img11RtPattern = /(--- !u!224 &820205948\r?\n[\s\S]*?m_AnchoredPosition: \{x: [^,]+, y:) -3643\.0002(\})/g
    if (img11RtPattern.test(content)) {
      content = content.replace(img11RtPattern, '$1 -2828$2')
      modified = true
    }

    // 4. Resize scrollable content height from 5000px to 3100px
    const scrollContentPattern = /(--- !u!224 &6157687972013927576\r?\n[\s\S]*?m_SizeDelta: \{x: [^,]+, y:) 5000(\})/g
    if (scrollContentPattern.test(content)) {
      content = content.replace(scrollContentPattern, '$1 3100$2')
      modified = true
    }

    if (modified) {
      writeFileSync(scenePath, content, 'utf8')
      console.log('[setup] Cleaned up settings menu UI framing, backgrounds, and scroll bounds in Mate Engine Main.unity')
    }
  }
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
