import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const mode = process.argv[2] ?? 'runtime'

function getDeepLogPath(): string {
  const platform = process.platform
  const homedir = os.homedir()

  if (platform === 'win32') {
    return path.join(homedir, 'AppData', 'LocalLow', 'Shinymoon', 'MateEngineX', 'Player.log')
  }
  else if (platform === 'darwin') {
    return path.join(homedir, 'Library', 'Logs', 'Shinymoon', 'MateEngineX', 'Player.log')
  }
  else {
    return path.join(homedir, '.config', 'unity3d', 'Shinymoon', 'MateEngineX', 'Player.log')
  }
}

function getRuntimeLogPath(): string {
  return path.resolve(import.meta.dirname, '..', 'mate-engine', 'Build', 'stagemate-runtime.log')
}

const targetFile = mode === 'deep' ? getDeepLogPath() : getRuntimeLogPath()

console.log(`[logs] Viewing ${mode === 'deep' ? 'deep (Player.log)' : 'runtime (stagemate-runtime.log)'}:`)
console.log(`[logs] Target: ${targetFile}\n`)

if (!fs.existsSync(targetFile)) {
  console.log(`[logs] Log file does not exist yet. Run StageMate to generate logs.`)
  process.exit(0)
}

// Tail last 50 lines
const content = fs.readFileSync(targetFile, 'utf8')
const lines = content.split(/\r?\n/)
const tailLines = lines.slice(Math.max(0, lines.length - 50))
console.log(tailLines.join('\n'))
