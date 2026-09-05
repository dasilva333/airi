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

import { execFileSync, execSync } from 'node:child_process'
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
const UPSTREAM_REPO = 'moeru-ai/airi'

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
      const parsed = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'))
      if (!parsed.tracked_prs)
        parsed.tracked_prs = {}
      return parsed
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
    tracked_prs: {},
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

// 5. GitHub PR Radar & Activity Queries
const PR_GRAPHQL_QUERY = `
query($owner: String!, $repo: String!, $limit: Int!) {
  repository(owner: $owner, name: $repo) {
    pullRequests(first: $limit, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number
        title
        state
        isDraft
        author { login }
        createdAt
        updatedAt
        mergedAt
        closedAt
        comments { totalCount }
        url
      }
    }
  }
}
`

function fetchUpstreamPRs(repo = UPSTREAM_REPO, limit = 100) {
  const [owner, name] = repo.split('/')
  try {
    const raw = execFileSync('gh', [
      'api',
      'graphql',
      '-f',
      `query=${PR_GRAPHQL_QUERY}`,
      '-F',
      `owner=${owner}`,
      '-F',
      `repo=${name}`,
      '-F',
      `limit=${limit}`,
    ], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const data = JSON.parse(raw)
    const nodes = data?.data?.repository?.pullRequests?.nodes || []
    return nodes.map(node => ({
      number: node.number,
      title: node.title,
      state: node.state,
      isDraft: Boolean(node.isDraft),
      author: node.author?.login || 'unknown',
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      mergedAt: node.mergedAt,
      closedAt: node.closedAt,
      commentsCount: node.comments?.totalCount || 0,
      url: node.url || `https://github.com/${repo}/pull/${node.number}`,
    }))
  }
  catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message
    console.warn(`[UpstreamTracker] Warning: GitHub PR fetch via gh failed (${stderr}). Proceeding with Git commit checks only.`)
    return null
  }
}

function inspectPRDelta(trackedPrsMap, fetchedPrs, lastRunTimestamp) {
  if (!fetchedPrs) {
    return {
      available: false,
      newPrs: [],
      statusChanges: [],
      commentChanges: [],
      totalChanges: 0,
      nextTrackedMap: trackedPrsMap || {},
    }
  }

  const hasTrackedBaseline = Boolean(trackedPrsMap && Object.keys(trackedPrsMap).length > 0)
  const nextTrackedMap = { ...trackedPrsMap }

  const newPrs = []
  const statusChanges = []
  const commentChanges = []

  for (const pr of fetchedPrs) {
    const key = String(pr.number)
    const prev = hasTrackedBaseline ? trackedPrsMap[key] : null

    if (!prev) {
      if (!hasTrackedBaseline) {
        // Initial baseline seed: flag only PRs created since lastRunTimestamp if known
        if (lastRunTimestamp && new Date(pr.createdAt) >= new Date(lastRunTimestamp)) {
          newPrs.push(pr)
        }
      }
      else {
        newPrs.push(pr)
      }
    }
    else {
      // Check for state / draft changes (Gap 3)
      const stateChanged = prev.state !== pr.state
      const draftChanged = prev.isDraft !== pr.isDraft
      if (stateChanged || draftChanged) {
        statusChanges.push({
          ...pr,
          prevState: prev.state,
          toState: pr.state,
          prevDraft: prev.isDraft,
          toDraft: pr.isDraft,
        })
      }

      // Check for comment count changes (Gap 4)
      if (pr.commentsCount !== prev.commentsCount) {
        commentChanges.push({
          ...pr,
          prevCount: prev.commentsCount,
          newCount: pr.commentsCount,
          delta: pr.commentsCount - prev.commentsCount,
        })
      }
    }

    // Always update snapshot entry
    nextTrackedMap[key] = {
      title: pr.title,
      state: pr.state,
      isDraft: pr.isDraft,
      author: pr.author,
      commentsCount: pr.commentsCount,
      updatedAt: pr.updatedAt,
      url: pr.url,
    }
  }

  const totalChanges = newPrs.length + statusChanges.length + commentChanges.length

  return {
    available: true,
    newPrs,
    statusChanges,
    commentChanges,
    totalChanges,
    nextTrackedMap,
  }
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
function formatTerminalBrief(delta, prDelta) {
  const { fromSha, toSha, commits, filesCount, groupedSubsystems } = delta
  const lines = []

  const prChangesCount = prDelta?.totalChanges || 0
  const hasCommits = commits.length > 0
  const hasPRChanges = prChangesCount > 0

  if (hasCommits) {
    lines.push(`\n📡 UPSTREAM RADAR: Delta from ${fromSha.slice(0, 8)} to ${toSha.slice(0, 8)}`)
    lines.push(`Found ${commits.length} new commit(s) across ${filesCount} file(s).`)
  }
  else if (hasPRChanges) {
    lines.push(`\n📡 UPSTREAM RADAR: No new commits on upstream/main (${toSha.slice(0, 8)}).`)
  }

  if (hasPRChanges) {
    lines.push(`Detected ${prChangesCount} Pull Request update(s): ${prDelta.newPrs.length} new, ${prDelta.statusChanges.length} status change(s), ${prDelta.commentChanges.length} discussion change(s).\n`)
  }
  else {
    lines.push('')
  }

  if (hasCommits) {
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
  }

  if (hasPRChanges) {
    lines.push('\n📬 Pull Request Activity:')
    if (prDelta.newPrs.length > 0) {
      lines.push(`  🆕 New PRs Opened (${prDelta.newPrs.length}):`)
      for (const pr of prDelta.newPrs) {
        const draftStr = pr.isDraft ? ' [Draft]' : ''
        lines.push(`      • #${pr.number}: ${pr.title} by @${pr.author}${draftStr} (${pr.commentsCount} comments)`)
        lines.push(`        ${pr.url}`)
      }
    }
    if (prDelta.statusChanges.length > 0) {
      lines.push(`  🔄 Status & Lifecycle Changes (${prDelta.statusChanges.length}):`)
      for (const pr of prDelta.statusChanges) {
        const stateTransition = pr.prevState !== pr.toState ? `${pr.prevState} ➔ ${pr.toState}` : ''
        const draftTransition = pr.prevDraft !== pr.toDraft ? (pr.toDraft ? '➔ Draft' : 'Draft ➔ Ready') : ''
        const changeDesc = [stateTransition, draftTransition].filter(Boolean).join(', ')
        lines.push(`      • #${pr.number}: ${pr.title} (${changeDesc})`)
        lines.push(`        ${pr.url}`)
      }
    }
    if (prDelta.commentChanges.length > 0) {
      lines.push(`  💬 Discussion Activity (${prDelta.commentChanges.length}):`)
      for (const pr of prDelta.commentChanges) {
        const sign = pr.delta > 0 ? `+${pr.delta}` : `${pr.delta}`
        lines.push(`      • #${pr.number}: ${pr.title} (${sign} new comments, total ${pr.newCount})`)
        lines.push(`        ${pr.url}`)
      }
    }
  }

  return lines.join('\n')
}

function formatMarkdownSection(delta, prDelta, customNotes = '') {
  const { fromSha, toSha, commits, filesCount, groupedSubsystems } = delta
  const today = new Date().toISOString().split('T')[0]
  const lines = []

  const prChangesCount = prDelta?.totalChanges || 0
  const hasCommits = commits.length > 0
  const hasPRChanges = prChangesCount > 0

  if (hasCommits) {
    const prPart = hasPRChanges ? `, ${prChangesCount} PR update(s)` : ''
    lines.push(`\n## [${today}] Upstream Delta: \`${fromSha.slice(0, 8)}..${toSha.slice(0, 8)}\` (${commits.length} commits, ${filesCount} files${prPart})`)
  }
  else {
    lines.push(`\n## [${today}] Upstream PR Activity: \`${toSha.slice(0, 8)}\` (${prChangesCount} PR update(s))`)
  }
  lines.push('')

  if (customNotes) {
    lines.push('### 🎯 Executive Highlights')
    lines.push(customNotes.trim())
    lines.push('')
  }

  if (hasCommits) {
    lines.push('### 📋 Upstream Commits')
    for (const c of commits) {
      const prLink = c.prNumber
        ? `[#${c.prNumber}](https://github.com/${UPSTREAM_REPO}/pull/${c.prNumber})`
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
  }

  if (hasPRChanges) {
    lines.push('### 📬 Upstream PR Radar')
    if (prDelta.newPrs.length > 0) {
      lines.push(`#### 🆕 New PRs Opened (${prDelta.newPrs.length})`)
      for (const pr of prDelta.newPrs) {
        const draftStr = pr.isDraft ? ' *(Draft)*' : ''
        lines.push(`- [#${pr.number}](${pr.url}) \`${pr.title}\` by **@${pr.author}**${draftStr} *(${pr.commentsCount} comments)*`)
      }
      lines.push('')
    }
    if (prDelta.statusChanges.length > 0) {
      lines.push(`#### 🔄 PR Status & Lifecycle Changes (${prDelta.statusChanges.length})`)
      for (const pr of prDelta.statusChanges) {
        const stateTransition = pr.prevState !== pr.toState ? `\`${pr.prevState}\` ➔ \`${pr.toState}\`` : ''
        const draftTransition = pr.prevDraft !== pr.toDraft ? (pr.toDraft ? '➔ `Draft`' : '`Draft` ➔ `Ready`') : ''
        const changeDesc = [stateTransition, draftTransition].filter(Boolean).join(', ')
        lines.push(`- [#${pr.number}](${pr.url}) \`${pr.title}\` — ${changeDesc}`)
      }
      lines.push('')
    }
    if (prDelta.commentChanges.length > 0) {
      lines.push(`#### 💬 Discussion Activity (${prDelta.commentChanges.length})`)
      for (const pr of prDelta.commentChanges) {
        const sign = pr.delta > 0 ? `+${pr.delta}` : `${pr.delta}`
        lines.push(`- [#${pr.number}](${pr.url}) \`${pr.title}\` — *${sign} comments (${pr.prevCount} ➔ ${pr.newCount} total)*`)
      }
      lines.push('')
    }
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
    'skip-prs': { type: 'boolean', default: false },
    'json': { type: 'boolean', default: false },
    'help': { type: 'boolean', short: 'h', default: false },
  }

  const { values } = parseArgs({ args: process.argv.slice(2), options, allowPositionals: true })

  if (values.help) {
    console.log(`
Usage: node scripts/upstream-tracker.mjs [options]

Commands:
  --init                  Seed state file with current upstream/main HEAD and PR snapshot.
  --check                 Fetch upstream and check for delta since last snapshot.
  --since <sha>           Test diff from a specific commit instead of state file.
  --skip-prs              Bypass GitHub PR checking (pure git commit checks only).
  --append-log            Append the delta summary to docs/UPSTREAM_RADAR.md.
  --notes <string>        Executive summary notes to embed in the radar log entry.
  --update-state          Advance baseline SHA and PR state to current upstream state.
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

    let prCount = 0
    if (!values['skip-prs']) {
      const prs = fetchUpstreamPRs()
      if (prs) {
        state.tracked_prs = {}
        for (const pr of prs) {
          state.tracked_prs[String(pr.number)] = {
            title: pr.title,
            state: pr.state,
            isDraft: pr.isDraft,
            author: pr.author,
            commentsCount: pr.commentsCount,
            updatedAt: pr.updatedAt,
            url: pr.url,
          }
        }
        prCount = prs.length
      }
    }

    if (!values['dry-run']) {
      saveState(state)
      ensureRadarLogHeader()
    }
    console.log(`✅ [UpstreamTracker] Initialized snapshot baseline at: ${targetSha} (tracking ${prCount} PRs)`)
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

  // PR Activity Check
  const fetchedPrs = values['skip-prs'] ? null : fetchUpstreamPRs()
  const prDelta = inspectPRDelta(state.tracked_prs, fetchedPrs, state.last_run_timestamp)

  const isShaUnchanged = baseSha === currentUpstreamSha
  const hasNoCommits = isShaUnchanged
  const hasNoPRChanges = prDelta.totalChanges === 0

  if (hasNoCommits && hasNoPRChanges) {
    if (values.json) {
      console.log(JSON.stringify({ status: 'UP_TO_DATE', sha: currentUpstreamSha, commits: 0, prChanges: 0 }))
    }
    else {
      console.log(`🟢 UP_TO_DATE: Upstream is unchanged at ${currentUpstreamSha.slice(0, 8)}. 0 new commits and 0 PR changes since last check.`)
    }
    // Update baseline PR map if we just performed an initial baseline population
    if (!values['dry-run'] && prDelta.available && Object.keys(state.tracked_prs).length === 0) {
      state.tracked_prs = prDelta.nextTrackedMap
      saveState(state)
    }
    process.exit(0)
  }

  const delta = isShaUnchanged
    ? { fromSha: baseSha, toSha: currentUpstreamSha, commits: [], filesCount: 0, groupedSubsystems: {} }
    : inspectDelta(baseSha, currentUpstreamSha)

  if (values.json) {
    console.log(JSON.stringify({
      status: 'NEW_ACTIVITY',
      sha: { from: baseSha, to: currentUpstreamSha },
      commits: delta.commits,
      filesCount: delta.filesCount,
      subsystems: delta.groupedSubsystems,
      prs: prDelta,
    }, null, 2))
  }
  else if (values.format === 'md') {
    const md = formatMarkdownSection(delta, prDelta, values.notes)
    console.log(md)
  }
  else {
    console.log(formatTerminalBrief(delta, prDelta))
  }

  if (values['append-log'] && !values['dry-run']) {
    const md = formatMarkdownSection(delta, prDelta, values.notes)
    appendToRadarLog(md)
    console.log(`\n📝 [UpstreamTracker] Prepending entry to ${path.relative(process.cwd(), RADAR_LOG_FILE)}`)
  }

  const shouldUpdateState = !values['dry-run'] && (values['update-state'] || (values['append-log'] && !values.since))
  if (shouldUpdateState) {
    state.last_inspected_sha = currentUpstreamSha
    state.last_run_timestamp = new Date().toISOString()
    if (prDelta.available) {
      state.tracked_prs = prDelta.nextTrackedMap
    }
    state.history.push({
      date: new Date().toISOString(),
      from_sha: baseSha,
      to_sha: currentUpstreamSha,
      commits_count: delta.commits.length,
      files_count: delta.filesCount,
      pr_changes_count: prDelta.totalChanges,
    })
    saveState(state)
    console.log(`✅ [UpstreamTracker] Advanced baseline SHA to ${currentUpstreamSha.slice(0, 8)} (tracking ${Object.keys(state.tracked_prs).length} PRs)`)
  }
}

main().catch((err) => {
  console.error(`❌ [UpstreamTracker] Error: ${err.message}`)
  process.exit(1)
})
