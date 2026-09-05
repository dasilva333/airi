#!/usr/bin/env node

/**
 * scripts/upstream-tracker.mjs
 *
 * Automated Upstream Radar & Reconnaissance Engine.
 *
 * Inspects commits and diffs from upstream/main (moeru-ai/airi) relative to the
 * last reviewed baseline commit, classifies changes by AIRI architectural subsystem,
 * and maintains the single rolling log in docs/UPSTREAM_RADAR.md.
 *
 * Designed to be executed directly or called unattended via Antigravity Scheduled Tasks.
 *
 * Zero Working-Tree Impact: Strictly uses `git fetch upstream main --quiet`
 * and read-only queries (git log, git diff). Does not touch checked-out branch or index.
 */

import fs from 'node:fs'
import path from 'node:path'

import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 1. Resolve Repository Root
function resolveRepoRoot() {
  try {
    const stdout = execSync('git rev-parse --show-toplevel', {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (stdout)
      return stdout
  }
  catch {
    // fallback to parent of scripts
  }
  return path.resolve(__dirname, '..')
}

const REPO_ROOT = resolveRepoRoot()
const STATE_FILE = path.join(REPO_ROOT, '.upstream-tracker-state.json')
const RADAR_LOG_FILE = path.join(REPO_ROOT, 'docs', 'UPSTREAM_RADAR.md')

// 2. Subsystem Definitions & Selective-Sync Classification
// Aligned with docs/project-selective-upstream-sync-protocol.md
const SUBSYSTEM_RULES = [
  {
    name: 'Telemetry & Analytics',
    risk: '⚪ ignore / rejected in fork',
    patterns: [
      /analytics/,
      /telemetry/,
    ],
  },
  {
    name: 'Cognitive & Consciousness',
    risk: '⚠️ hand-merge',
    patterns: [
      /packages\/stage-ui\/src\/stores\/(llm|chat|memory|proactivity|live-session)/,
      /packages\/stage-ui\/src\/composables\/(llm|use-producer|use-vision|.*prompt.*)/,
      /packages\/stage-ui\/src\/types\/(card|memory)/,
    ],
  },
  {
    name: 'Core Agent Runtime',
    risk: '🔍 inspect',
    patterns: [
      /packages\/core-agent/,
    ],
  },
  {
    name: 'Stage Layouts & Shells',
    risk: '🔍 inspect',
    patterns: [
      /packages\/stage-layouts/,
    ],
  },
  {
    name: '3D, Live2D & Motion',
    risk: '🔍 inspect',
    patterns: [
      /packages\/stage-ui-three/,
      /packages\/stage-ui-live2d/,
      /packages\/stage-ui\/src\/components\/(scenes|avatar|widgets)/,
      /packages\/stage-ui\/src\/stores\/(background|artistry|generative-motion)/,
    ],
  },
  {
    name: 'Audio & Speech Pipeline',
    risk: '🔍 inspect',
    patterns: [
      /packages\/stage-ui\/src\/stores\/audio/,
      /packages\/stage-ui\/src\/composables\/use-(speech|audio|hearing)/,
      /packages\/stage-ui\/src\/libs\/audio/,
    ],
  },
  {
    name: 'Provider & Model Integrations',
    risk: '📦 import / inspect',
    patterns: [
      /packages\/stage-ui\/src\/stores\/providers/,
      /packages\/stage-ui\/src\/modules\/providers/,
      /packages\/stage-ui\/src\/constants\/providers/,
    ],
  },
  {
    name: 'UI Primitives & Pages',
    risk: '📦 import / inspect',
    patterns: [
      /packages\/stage-pages/,
      /packages\/ui/,
      /packages\/stage-ui\/src\/components\/ui/,
    ],
  },
  {
    name: 'Electron Desktop Shell',
    risk: '⚠️ hand-merge',
    patterns: [
      /apps\/stage-tamagotchi/,
    ],
  },
  {
    name: 'Mobile & Web Platforms',
    risk: '⚪ ignore / low-priority',
    patterns: [
      /apps\/stage-pocket/,
      /apps\/stage-web/,
      /apps\/stage-edge/,
    ],
  },
  {
    name: 'Localization (i18n)',
    risk: '📦 import (additive only)',
    patterns: [
      /packages\/i18n/,
    ],
  },
  {
    name: 'Documentation & Scaffolding',
    risk: '⚪ ignore',
    patterns: [
      /^docs\//,
      /^\.github\//,
      /\.md$/,
      /LICENSE/,
    ],
  },
  {
    name: 'Root Build & Tooling',
    risk: '🔍 inspect',
    patterns: [
      /package\.json$/,
      /pnpm-lock\.yaml$/,
      /^scripts\//,
      /turbo\.json$/,
      /tsconfig.*\.json$/,
    ],
  },
]

function classifyFile(filePath) {
  for (const rule of SUBSYSTEM_RULES) {
    if (rule.patterns.some(p => p.test(filePath))) {
      return { subsystem: rule.name, risk: rule.risk }
    }
  }
  return { subsystem: 'Other / Uncategorized', risk: '🔍 inspect' }
}

// 3. State Management
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
    }
    catch (err) {
      console.warn(`[UpstreamTracker] Could not parse state file: ${err.message}. Initializing fresh.`)
    }
  }
  return {
    last_inspected_sha: null,
    last_run_timestamp: null,
    remote: 'upstream',
    branch: 'main',
    history: [],
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8')
}

// 4. Git Execution Utilities
function runGit(args, cwd = REPO_ROOT) {
  try {
    return execSync(`git ${args}`, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  }
  catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message
    throw new Error(`Git error (git ${args}): ${stderr}`)
  }
}

function fetchUpstream() {
  try {
    runGit('fetch upstream main --quiet')
  }
  catch (err) {
    console.warn(`[UpstreamTracker] Warning: git fetch failed (${err.message}). Proceeding with existing local ref.`)
  }
}

function getUpstreamHeadSha() {
  return runGit('rev-parse upstream/main')
}

// 5. Diff & Commit Analysis
function inspectDelta(fromSha, toSha) {
  // Commit list
  const logRaw = runGit(`log --pretty=format:"%H|%h|%an|%ad|%s" --date=short ${fromSha}..${toSha}`)
  const commits = []
  if (logRaw) {
    const lines = logRaw.split('\n')
    for (const line of lines) {
      if (!line.trim())
        continue
      const [sha, shortSha, author, date, subject] = line.split('|')
      // Extract PR number if present (#1234)
      const prMatch = subject.match(/#(\d+)/)
      const prNumber = prMatch ? prMatch[1] : null
      commits.push({
        sha,
        shortSha,
        author,
        date,
        subject,
        prNumber,
      })
    }
  }

  // Changed files
  const numstatRaw = runGit(`diff --numstat ${fromSha}..${toSha}`)
  const files = []
  if (numstatRaw) {
    const lines = numstatRaw.split('\n')
    for (const line of lines) {
      if (!line.trim())
        continue
      const [additions, deletions, filePath] = line.split('\t')
      if (!filePath)
        continue
      const { subsystem, risk } = classifyFile(filePath)
      files.push({
        filePath,
        additions: additions === '-' ? 0 : Number.parseInt(additions, 10),
        deletions: deletions === '-' ? 0 : Number.parseInt(deletions, 10),
        subsystem,
        risk,
      })
    }
  }

  // Group files by subsystem
  const groupedSubsystems = {}
  for (const file of files) {
    if (!groupedSubsystems[file.subsystem]) {
      groupedSubsystems[file.subsystem] = {
        risk: file.risk,
        files: [],
        totalAdditions: 0,
        totalDeletions: 0,
      }
    }
    groupedSubsystems[file.subsystem].files.push(file)
    groupedSubsystems[file.subsystem].totalAdditions += file.additions
    groupedSubsystems[file.subsystem].totalDeletions += file.deletions
  }

  return {
    fromSha,
    toSha,
    commits,
    filesCount: files.length,
    groupedSubsystems,
  }
}

// 6. Formatting
function formatTerminalBrief(delta) {
  const { fromSha, toSha, commits, filesCount, groupedSubsystems } = delta
  const lines = []
  lines.push(`\n📡 UPSTREAM RADAR: Delta from ${fromSha.slice(0, 8)} to ${toSha.slice(0, 8)}`)
  lines.push(`Found ${commits.length} new commit(s) across ${filesCount} file(s).\n`)

  lines.push('📋 Commits:')
  for (const c of commits) {
    const prStr = c.prNumber ? `(PR #${c.prNumber})` : ''
    lines.push(`  • [${c.shortSha}] ${c.subject} ${prStr} — ${c.author} (${c.date})`)
  }

  lines.push('\n🔬 Affected Subsystems:')
  for (const [subsystem, info] of Object.entries(groupedSubsystems)) {
    lines.push(`  • ${subsystem} [${info.risk}]: ${info.files.length} file(s) (+${info.totalAdditions}/-${info.totalDeletions})`)
    for (const f of info.files.slice(0, 5)) {
      lines.push(`      - ${f.filePath} (+${f.additions}/-${f.deletions})`)
    }
    if (info.files.length > 5) {
      lines.push(`      ... and ${info.files.length - 5} more file(s)`)
    }
  }

  return lines.join('\n')
}

function formatMarkdownSection(delta, customNotes = '') {
  const { fromSha, toSha, commits, filesCount, groupedSubsystems } = delta
  const today = new Date().toISOString().split('T')[0]
  const lines = []

  lines.push(`\n## [${today}] Upstream Delta: \`${fromSha.slice(0, 8)}..${toSha.slice(0, 8)}\` (${commits.length} commits, ${filesCount} files)`)
  lines.push('')

  if (customNotes) {
    lines.push('### 🎯 Executive Highlights')
    lines.push(customNotes.trim())
    lines.push('')
  }

  lines.push('### 📋 Upstream Commits')
  for (const c of commits) {
    const prLink = c.prNumber
      ? `[#${c.prNumber}](https://github.com/moeru-ai/airi/pull/${c.prNumber})`
      : ''
    lines.push(`- \`${c.shortSha}\` ${c.subject} ${prLink} _(${c.author}, ${c.date})_`)
  }
  lines.push('')

  lines.push('### 🔬 Subsystem Breakdown')
  for (const [subsystem, info] of Object.entries(groupedSubsystems)) {
    lines.push(`#### ${subsystem} (\`${info.risk}\`) — ${info.files.length} file(s) (+${info.totalAdditions}/-${info.totalDeletions})`)
    for (const f of info.files) {
      lines.push(`- \`${f.filePath}\` *(+${f.additions}/-${f.deletions})*`)
    }
    lines.push('')
  }

  lines.push('---')
  return lines.join('\n')
}

function ensureRadarLogHeader() {
  if (!fs.existsSync(RADAR_LOG_FILE)) {
    const dir = path.dirname(RADAR_LOG_FILE)
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })
    const initialContent = `# AIRI Upstream Radar

> **Living Intelligence Ledger**: Tracks continuous delta from upstream (\`moeru-ai/airi\`) to inform selective, high-value forward-porting into \`dasilva333/airi\`.
> Generated and maintained by Antigravity Scheduled Tasks via \`scripts/upstream-tracker.mjs\`.
> Guided by: [\`docs/project-selective-upstream-sync-protocol.md\`](./project-selective-upstream-sync-protocol.md).

---
`
    fs.writeFileSync(RADAR_LOG_FILE, initialContent, 'utf8')
  }
}

function appendToRadarLog(markdownSection) {
  ensureRadarLogHeader()
  const currentContent = fs.readFileSync(RADAR_LOG_FILE, 'utf8')
  // Prepend under the header
  const headerSplit = currentContent.indexOf('---')
  if (headerSplit !== -1) {
    const header = currentContent.slice(0, headerSplit + 3)
    const rest = currentContent.slice(headerSplit + 3)
    const updated = `${header}\n${markdownSection}\n${rest.trimStart()}`
    fs.writeFileSync(RADAR_LOG_FILE, updated, 'utf8')
  }
  else {
    fs.appendFileSync(RADAR_LOG_FILE, `\n${markdownSection}\n`, 'utf8')
  }
}

// 7. CLI Main
async function main() {
  const options = {
    'init': { type: 'boolean', default: false },
    'check': { type: 'boolean', default: false },
    'since': { type: 'string' },
    'sha': { type: 'string' },
    'format': { type: 'string', default: 'brief' },
    'dry-run': { type: 'boolean', default: false },
    'append-log': { type: 'boolean', default: false },
    'notes': { type: 'string', default: '' },
    'update-state': { type: 'boolean', default: false },
    'json': { type: 'boolean', default: false },
    'help': { type: 'boolean', short: 'h', default: false },
  }

  const { values } = parseArgs({ args: process.argv.slice(2), options, allowPositionals: true })

  if (values.help) {
    console.log(`
Usage: node scripts/upstream-tracker.mjs [options]

Commands:
  --init                  Seed state file with current upstream/main HEAD.
  --check                 Fetch upstream and check for delta since last snapshot.
  --since <sha>           Test diff from a specific commit instead of state file.
  --append-log            Append the delta summary to docs/UPSTREAM_RADAR.md.
  --notes <string>        Executive summary notes to embed in the radar log entry.
  --update-state          Advance the baseline SHA in state file to current upstream HEAD.
  --json                  Output result in JSON format.
  --format <brief|md>     Output format (brief text or Markdown).
  --dry-run               Do not write to state file or UPSTREAM_RADAR.md.
`)
    process.exit(0)
  }

  const state = loadState()

  // Mode 1: Initialization
  if (values.init) {
    console.log('[UpstreamTracker] Fetching upstream...')
    fetchUpstream()
    const targetSha = values.sha || getUpstreamHeadSha()
    state.last_inspected_sha = targetSha
    state.last_run_timestamp = new Date().toISOString()
    if (!values['dry-run']) {
      saveState(state)
      ensureRadarLogHeader()
    }
    console.log(`✅ [UpstreamTracker] Initialized snapshot baseline at: ${targetSha}`)
    process.exit(0)
  }

  // Mode 2: Check & Diff
  fetchUpstream()
  const currentUpstreamSha = getUpstreamHeadSha()
  const rawBaseSha = values.since || state.last_inspected_sha

  if (!rawBaseSha) {
    console.error('❌ [UpstreamTracker] No baseline SHA found. Run with `--init` first to snapshot current upstream state.')
    process.exit(1)
  }

  let baseSha = rawBaseSha
  try {
    baseSha = runGit(`rev-parse ${rawBaseSha}`)
  }
  catch {
    baseSha = rawBaseSha
  }

  if (baseSha === currentUpstreamSha) {
    if (values.json) {
      console.log(JSON.stringify({ status: 'UP_TO_DATE', sha: currentUpstreamSha, commits: 0 }))
    }
    else {
      console.log(`🟢 UP_TO_DATE: Upstream is unchanged at ${currentUpstreamSha.slice(0, 8)}. 0 new commits since last check.`)
    }
    process.exit(0)
  }

  const delta = inspectDelta(baseSha, currentUpstreamSha)

  if (values.json) {
    console.log(JSON.stringify({ status: 'NEW_COMMITS', ...delta }, null, 2))
  }
  else if (values.format === 'md') {
    const md = formatMarkdownSection(delta, values.notes)
    console.log(md)
  }
  else {
    console.log(formatTerminalBrief(delta))
  }

  if (values['append-log'] && !values['dry-run']) {
    const md = formatMarkdownSection(delta, values.notes)
    appendToRadarLog(md)
    console.log(`\n📝 [UpstreamTracker] Prepending entry to ${path.relative(process.cwd(), RADAR_LOG_FILE)}`)
  }

  const shouldUpdateState = !values['dry-run'] && (values['update-state'] || (values['append-log'] && !values.since))
  if (shouldUpdateState) {
    state.last_inspected_sha = currentUpstreamSha
    state.last_run_timestamp = new Date().toISOString()
    state.history.push({
      date: new Date().toISOString(),
      from_sha: baseSha,
      to_sha: currentUpstreamSha,
      commits_count: delta.commits.length,
      files_count: delta.filesCount,
    })
    saveState(state)
    console.log(`✅ [UpstreamTracker] Advanced baseline SHA to ${currentUpstreamSha.slice(0, 8)}`)
  }
}

main().catch((err) => {
  console.error(`❌ [UpstreamTracker] Error: ${err.message}`)
  process.exit(1)
})
