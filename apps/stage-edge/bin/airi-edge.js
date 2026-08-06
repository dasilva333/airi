#!/usr/bin/env node
import path from 'node:path'

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const cliScript = path.resolve(__dirname, '../src/cli.ts')

const child = spawn('npx', ['tsx', cliScript, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: true,
})

child.on('exit', (code) => {
  process.exit(code || 0)
})
