import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { env, platform } from 'node:process'
import { fileURLToPath } from 'node:url'

import { setupMateEngine } from './setup'

const here = fileURLToPath(new URL('.', import.meta.url))
const mateEngineDir = join(here, '../mate-engine')

// Ensure workspace is initialized and unity-src is overlaid into mate-engine
setupMateEngine()

function findUnityExecutable(): string | null {
  if (env.UNITY_PATH && existsSync(env.UNITY_PATH))
    return env.UNITY_PATH

  if (platform === 'win32') {
    const candidates = [
      'C:\\Program Files\\Unity\\Hub\\Editor\\6000.2.6f2\\Editor\\Unity.exe',
      'C:\\Program Files\\Unity 6000.2.6f2\\Editor\\Unity.exe',
      'C:\\Program Files\\Unity\\Editor\\Unity.exe',
    ]
    for (const cand of candidates) {
      if (existsSync(cand))
        return cand
    }
  }
  else if (platform === 'darwin') {
    const candidates = [
      '/Applications/Unity/Hub/Editor/6000.2.6f2/Unity.app/Contents/MacOS/Unity',
      '/Applications/Unity/Unity.app/Contents/MacOS/Unity',
    ]
    for (const cand of candidates) {
      if (existsSync(cand))
        return cand
    }
  }
  else if (platform === 'linux') {
    const candidates = [
      '/opt/unity/hub/editor/6000.2.6f2/Editor/Unity',
      `${env.HOME}/Unity/Hub/Editor/6000.2.6f2/Editor/Unity`,
    ]
    for (const cand of candidates) {
      if (existsSync(cand))
        return cand
    }
  }

  return null
}

const targetArg = process.argv[2] ?? 'all'
let executeMethod = 'MateSidecarBuild.Build'

if (targetArg === 'original' || targetArg === 'main')
  executeMethod = 'MateSidecarBuild.BuildOriginalWindows'
else if (targetArg === 'win' || targetArg === 'windows')
  executeMethod = 'MateSidecarBuild.BuildWindows'
else if (targetArg === 'linux')
  executeMethod = 'MateSidecarBuild.BuildLinux'
else if (targetArg === 'mac' || targetArg === 'osx')
  executeMethod = 'MateSidecarBuild.BuildMac'
else if (targetArg === 'all')
  executeMethod = 'MateSidecarBuild.BuildAll'

const unityPath = findUnityExecutable()
if (!unityPath) {
  console.error('[build] Unity executable not found. Please install Unity 6000.2.6f2 via Unity Hub or set UNITY_PATH environment variable.')
  process.exit(1)
}

console.log(`[build] Found Unity: ${unityPath}`)
console.log(`[build] Project Path: ${mateEngineDir}`)
console.log(`[build] Executing Build Method: ${executeMethod}`)

const args = [
  '-batchmode',
  '-quit',
  '-projectPath',
  mateEngineDir,
  '-executeMethod',
  executeMethod,
  '-logFile',
  join(mateEngineDir, 'Build', 'build.log'),
]

// Ensure Build directory exists for log
const buildDir = join(mateEngineDir, 'Build')
if (!existsSync(buildDir)) {
  const { mkdirSync } = await import('node:fs')
  mkdirSync(buildDir, { recursive: true })
}

const result = spawnSync(unityPath, args, { stdio: 'inherit' })
if (result.status === 0) {
  console.log(`[build] Build completed successfully for ${targetArg}!`)
}
else {
  console.error(`[build] Unity build exited with status ${result.status}. Check apps/stage-mate/mate-engine/Build/build.log for details.`)
  process.exit(result.status ?? 1)
}
