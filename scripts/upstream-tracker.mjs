#!/usr/bin/env node

/**
 * scripts/upstream-tracker.mjs
 *
 * Automated Upstream & Fork Radar Reconnaissance Engine.
 *
 * Inspects commits and diffs from upstream/main (moeru-ai/airi) or sister forks
 * (e.g. 7n1m4/airi via --7n1m4) relative to the last reviewed baseline commit,
 * classifies changes by AIRI architectural subsystem, and maintains rolling logs:
 *   - Upstream: docs/UPSTREAM_RADAR.md (state: .upstream-tracker-state.json)
 *   - 7n1m4 Fork: docs/7N1M4_RADAR.md (state: .7n1m4-tracker-state.json)
 *
 * Designed to be executed directly or called unattended via Antigravity Scheduled Tasks.
 *
 * Zero Working-Tree Impact: Strictly uses `git fetch <remote> main --quiet`
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

const WATCHED_UPSTREAM_PRS = [
  {
    number: 2634,
    title: 'feat(cortico-bridge): embed Cortico persona core as AIRI\'s brain',
    focus: 'External Cortico daemon vs in-process native memory; track maintainer reaction to 2-process / web breakage',
  },
  {
    number: 2672,
    title: 'refactor(stage-ui): bind conversations to window-local characters',
    focus: 'Window-local character selection, conversation scoping, standalone card profile page, shared CharacterCard',
  },
  {
    number: 2541,
    title: 'feat(plugins): drop in plugins and MCP-first tool architecture',
    focus: 'MCP stdio child processes & card-level tool scoping; track author rebase and explanation to maintainers regarding deleted in-process loader',
  },
  {
    number: 2290,
    title: 'feat(server): stream official ASR over WebSocket',
    focus: 'Official ASR streaming over WebSocket vs OpenAI-compatible HTTP SSE; track rebase and backend transport decisions',
  },
  {
    number: 2120,
    title: 'refactor(stage-pages): rebuild AIRI Card editor',
    focus: 'Card editor overhaul in stage-pages, dirty draft protection, route vs modal lifecycles',
  },
  {
    number: 2980,
    title: 'feat(stage-ui,stage-pages): add voiceprint enrollment',
    focus: 'Local speaker diarization & CAM++ voiceprint enrollment; track worker bundling, enrollment UX, and WASM performance for fork port',
  },
  {
    number: 2552,
    title: 'add bilingual subtitles',
    focus: 'Bilingual subtitle rendering in stage overlays; monitor for closure/merge to evaluate for fork adoption',
  },
  {
    number: 3000,
    title: 'feat(memory-eval): add identity-continuity evaluation package',
    focus: 'Mathematical metrics (Wasserstein-1, GMM BIC bimodality, fixed-point operator) for persona continuity during long-turn memory compression; monitor maintainer triage and package boundary placement',
  },
  {
    number: 3049,
    title: 'fix(stage-shared): parse Electron punctuation accelerators',
    focus: 'Global shortcut punctuation mapping; tracked for proposal-global-shortcuts.md piggyback',
  },
  {
    number: 3121,
    title: 'fix(stage-tamagotchi): read WebP screenshots in computer_use_read_image',
    focus: 'Chromium canvas WebP-to-PNG decoder via Eventa contract; companion tool to computer_use squatted in fork capability packs. Monitor where upstream lands upon closure.',
  },
]

const WATCHED_7N1M4_ITEMS = [
  {
    number: 7,
    title: 'feat(agentic): presence single source + nap & companion nap-chat',
    focus: 'Presence-derived idle state triggering autonomous peer-to-peer companion nap-chat over libp2p with memory write-back & recap',
  },
  {
    number: 6,
    title: 'feat(libp2p): complete pairing over the wire and paired-device management',
    focus: 'Wire pairing negotiation, multiaddr identity storage, and eventa message transport',
  },
  {
    number: 8,
    title: 'fix: migrate zod imports to default for Node 26 Vite SSR interop',
    focus: 'Vite SSR interop for Node 26 runtime',
  },
  {
    number: 1,
    title: 'wayfinder: Cloudflare Purge → libp2p Local Mesh → Agentic OS',
    focus: 'Violet\'s master roadmap and architectural milestone tracker',
  },
  {
    number: 4,
    title: 'Phase 3: Agentic OS Integration',
    focus: 'Autonomous mode toggle, memory-driven proactive intentions, Jev decision loop',
  },
]

const TARGET_CONFIGS = {
  'upstream': {
    id: 'upstream',
    name: 'Upstream',
    remote: 'upstream',
    branch: 'main',
    repo: 'moeru-ai/airi',
    remoteUrl: 'https://github.com/moeru-ai/airi.git',
    stateFile: path.join(REPO_ROOT, '.upstream-tracker-state.json'),
    radarLogFile: path.join(REPO_ROOT, 'docs', 'UPSTREAM_RADAR.md'),
    radarTitle: 'AIRI Upstream Radar',
    radarSubtitle: 'Tracks continuous delta from upstream (`moeru-ai/airi`) to inform selective, high-value forward-porting into `dasilva333/airi`.',
    watchedItems: WATCHED_UPSTREAM_PRS,
    trackIssues: false,
  },
  '7n1m4': {
    id: '7n1m4',
    name: '7n1m4 Fork',
    remote: '7n1m4',
    branch: 'main',
    repo: '7n1m4/airi',
    remoteUrl: 'https://github.com/7n1m4/airi.git',
    stateFile: path.join(REPO_ROOT, '.7n1m4-tracker-state.json'),
    radarLogFile: path.join(REPO_ROOT, 'docs', '7N1M4_RADAR.md'),
    radarTitle: 'AIRI 7n1m4 Fork Radar',
    radarSubtitle: 'Tracks continuous delta, PR activity, roadmap issues, and commits from the 7n1m4 sister fork (`7n1m4/airi`) to inform high-velocity cherry-picking and synchronization into `dasilva333/airi`.',
    watchedItems: WATCHED_7N1M4_ITEMS,
    trackIssues: true,
  },
}

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
    name: 'Deprecated Surfaces (Control Island / Chat Floating)',
    risk: '⚪ ignore / rejected in fork (decoupled into Control Strip)',
    patterns: [
      /stage-islands\/controls-island/,
      /chat-floating\.vue/,
    ],
  },
  {
    name: 'Wake Words & Voice Trigger',
    risk: '⚪ ignore / rejected in fork (no wake words in fork)',
    patterns: [
      /wake-word/,
      /wakeword/,
    ],
  },
  {
    name: 'Cloud Services, Billing & Auth',
    risk: '⚪ ignore / rejected in fork (offline-first architecture)',
    patterns: [
      /^server\//,
      /display-model-sync/,
      /file-transfer/,
      /display-models\.repo/,
    ],
  },
  {
    name: 'Auto-Updater & Packaging Infrastructure',
    risk: '⚪ ignore / rejected in fork (offline/local distribution)',
    patterns: [
      /services\/electron\/auto-updater/,
      /windows\/main\/hide-on-close/,
      /check-reproducible-build/,
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
function loadState(config) {
  if (fs.existsSync(config.stateFile)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(config.stateFile, 'utf8'))
      if (!parsed.tracked_prs)
        parsed.tracked_prs = {}
      if (!parsed.acknowledged_mentions)
        parsed.acknowledged_mentions = []
      return parsed
    }
    catch (err) {
      console.warn(`[${config.name}Tracker] Could not parse state file: ${err.message}. Initializing fresh.`)
    }
  }
  return {
    last_inspected_sha: null,
    last_run_timestamp: null,
    remote: config.remote,
    branch: config.branch,
    tracked_prs: {},
    acknowledged_mentions: [],
    history: [],
  }
}

function saveState(config, state) {
  fs.writeFileSync(config.stateFile, JSON.stringify(state, null, 2), 'utf8')
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

function fetchTarget(config) {
  try {
    const remotes = runGit('remote').split('\n').map(s => s.trim())
    if (!remotes.includes(config.remote) && config.remoteUrl) {
      runGit(`remote add ${config.remote} ${config.remoteUrl}`)
    }
    runGit(`fetch ${config.remote} ${config.branch} --quiet`)
  }
  catch (err) {
    console.warn(`[${config.name}Tracker] Warning: git fetch failed (${err.message}). Proceeding with existing local ref.`)
  }
}

function getTargetHeadSha(config) {
  return runGit(`rev-parse ${config.remote}/${config.branch}`)
}

// 5. GitHub PR & Issues Radar Queries
const COMBINED_GRAPHQL_QUERY = `
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
        totalCommentsCount
        url
        comments(last: 25) {
          nodes {
            author { login }
            body
            createdAt
            url
          }
        }
      }
    }
    issues(first: $limit, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes {
        number
        title
        state
        author { login }
        createdAt
        updatedAt
        closedAt
        comments(last: 25) {
          totalCount
          nodes {
            author { login }
            body
            createdAt
            url
          }
        }
        url
      }
    }
  }
}
`

function fetchTargetItems(config, limit = 50) {
  const [owner, name] = config.repo.split('/')
  try {
    const raw = execFileSync('gh', [
      'api',
      'graphql',
      '-f',
      `query=${COMBINED_GRAPHQL_QUERY}`,
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
    const prNodes = data?.data?.repository?.pullRequests?.nodes || []
    const issueNodes = config.trackIssues ? (data?.data?.repository?.issues?.nodes || []) : []

    const prs = prNodes.map(node => ({
      number: node.number,
      title: node.title,
      state: node.state,
      isDraft: Boolean(node.isDraft),
      author: node.author?.login || 'unknown',
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      mergedAt: node.mergedAt,
      closedAt: node.closedAt,
      commentsCount: node.totalCommentsCount ?? 0,
      url: node.url || `https://github.com/${config.repo}/pull/${node.number}`,
      type: 'PR',
      recentComments: (node.comments?.nodes || []).map(c => ({
        author: c.author?.login || 'unknown',
        body: c.body || '',
        createdAt: c.createdAt,
        url: c.url,
      })),
    }))

    const issues = issueNodes.map(node => ({
      number: node.number,
      title: node.title,
      state: node.state,
      isDraft: false,
      author: node.author?.login || 'unknown',
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      mergedAt: null,
      closedAt: node.closedAt,
      commentsCount: node.comments?.totalCount ?? 0,
      url: node.url || `https://github.com/${config.repo}/issues/${node.number}`,
      type: 'Issue',
      recentComments: (node.comments?.nodes || []).map(c => ({
        author: c.author?.login || 'unknown',
        body: c.body || '',
        createdAt: c.createdAt,
        url: c.url,
      })),
    }))

    return [...prs, ...issues]
  }
  catch (err) {
    const stderr = err.stderr ? err.stderr.toString().trim() : err.message
    console.warn(`[${config.name}Tracker] Warning: GitHub PR/Issue fetch via gh failed (${stderr}). Proceeding with Git commit checks only.`)
    return null
  }
}

function inspectPRDelta(trackedPrsMap, fetchedItems, lastRunTimestamp, acknowledgedMentions = []) {
  if (!fetchedItems) {
    return {
      available: false,
      newPrs: [],
      statusChanges: [],
      commentChanges: [],
      actionableMentions: [],
      totalChanges: 0,
      nextTrackedMap: trackedPrsMap || {},
    }
  }

  const hasTrackedBaseline = Boolean(trackedPrsMap && Object.keys(trackedPrsMap).length > 0)
  const nextTrackedMap = { ...trackedPrsMap }

  const newPrs = []
  const statusChanges = []
  const commentChanges = []
  const actionableMentions = []

  for (const item of fetchedItems) {
    // Scan recent comments for direct mentions of @dasilva333 or maintainer inquiries
    for (const c of item.recentComments || []) {
      const isMention = /@?dasilva333/i.test(c.body)
      const isMaintainer = ['7n1m4', 'vi70x3', 'vi'].includes(c.author?.toLowerCase())
      const isBot = ['anlmabot', 'github-actions', 'github-actions[bot]'].includes(c.author?.toLowerCase())
      const isSelf = c.author?.toLowerCase() === 'dasilva333'

      const isTargetedMention = isMention
      const isOpenMaintainerDiscussion = isMaintainer && !isBot && item.state === 'OPEN'

      if (!isSelf && (isTargetedMention || isOpenMaintainerDiscussion)) {
        const isAcked = acknowledgedMentions.includes(c.url)
        actionableMentions.push({
          itemNumber: item.number,
          itemTitle: item.title,
          itemType: item.type,
          itemUrl: item.url,
          author: c.author,
          createdAt: c.createdAt,
          commentUrl: c.url,
          bodyPreview: c.body.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 3).join(' ').slice(0, 300),
          isDirectMention: isMention,
          isAcknowledged: isAcked,
        })
      }
    }

    const key = `${item.type || 'PR'}:${item.number}`
    const prev = hasTrackedBaseline ? (trackedPrsMap[key] || trackedPrsMap[String(item.number)]) : null

    if (!prev) {
      if (!hasTrackedBaseline) {
        if (lastRunTimestamp && new Date(item.createdAt) >= new Date(lastRunTimestamp)) {
          newPrs.push(item)
        }
      }
      else {
        newPrs.push(item)
      }
    }
    else {
      const stateChanged = prev.state !== item.state
      const draftChanged = prev.isDraft !== item.isDraft
      if (stateChanged || draftChanged) {
        statusChanges.push({
          ...item,
          prevState: prev.state,
          toState: item.state,
          prevDraft: prev.isDraft,
          toDraft: item.isDraft,
        })
      }

      if (item.commentsCount !== prev.commentsCount) {
        commentChanges.push({
          ...item,
          prevCount: prev.commentsCount,
          newCount: item.commentsCount,
          delta: item.commentsCount - prev.commentsCount,
        })
      }
    }

    nextTrackedMap[key] = {
      title: item.title,
      state: item.state,
      isDraft: item.isDraft,
      author: item.author,
      commentsCount: item.commentsCount,
      updatedAt: item.updatedAt,
      url: item.url,
      type: item.type,
    }
  }

  const totalChanges = newPrs.length + statusChanges.length + commentChanges.length

  return {
    available: true,
    newPrs,
    statusChanges,
    commentChanges,
    actionableMentions,
    totalChanges,
    nextTrackedMap,
  }
}

// 6. Diff & Commit Analysis
function inspectDelta(fromSha, toSha) {
  const logRaw = runGit(`log --pretty=format:"%H|%h|%an|%ad|%s" --date=short ${fromSha}..${toSha}`)
  const commits = []
  if (logRaw) {
    const lines = logRaw.split('\n')
    for (const line of lines) {
      if (!line.trim())
        continue
      const [sha, shortSha, author, date, subject] = line.split('|')
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

// 7. Formatting
function formatTerminalBrief(config, delta, prDelta) {
  const { fromSha, toSha, commits, filesCount, groupedSubsystems } = delta
  const lines = []

  if (prDelta?.actionableMentions?.length > 0) {
    lines.push(`\n🚨 ACTION REQUIRED: DIRECT MENTION / MAINTAINER INQUIRY DETECTED:`)
    for (const m of prDelta.actionableMentions) {
      const ackBadge = m.isAcknowledged ? ' [ACKNOWLEDGED]' : ' ⚠️ [UNACKNOWLEDGED]'
      const mentionBadge = m.isDirectMention ? ' (tagged @dasilva333)' : ''
      lines.push(`  • [${m.itemType} #${m.itemNumber}] by @${m.author}${mentionBadge}${ackBadge} (${m.createdAt.slice(0, 10)}):`)
      lines.push(`    "${m.bodyPreview}"`)
      lines.push(`    ↳ ${m.commentUrl}`)
    }
  }

  const prChangesCount = prDelta?.totalChanges || 0
  const hasCommits = commits.length > 0
  const hasPRChanges = prChangesCount > 0

  if (hasCommits) {
    lines.push(`\n📡 ${config.radarTitle.toUpperCase()}: Delta from ${fromSha.slice(0, 8)} to ${toSha.slice(0, 8)}`)
    lines.push(`Found ${commits.length} new commit(s) across ${filesCount} file(s).`)
  }
  else if (hasPRChanges) {
    lines.push(`\n📡 ${config.radarTitle.toUpperCase()}: No new commits on ${config.remote}/${config.branch} (${toSha.slice(0, 8)}).`)
  }

  if (hasPRChanges) {
    lines.push(`Detected ${prChangesCount} Pull Request / Issue update(s): ${prDelta.newPrs.length} new, ${prDelta.statusChanges.length} status change(s), ${prDelta.commentChanges.length} discussion change(s).\n`)
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
    lines.push('\n📬 Activity Radar:')
    if (prDelta.newPrs.length > 0) {
      lines.push(`  🆕 New Items Opened (${prDelta.newPrs.length}):`)
      for (const item of prDelta.newPrs) {
        const draftStr = item.isDraft ? ' [Draft]' : ''
        const typeStr = item.type ? `[${item.type}] ` : ''
        lines.push(`      • ${typeStr}#${item.number}: ${item.title} by @${item.author}${draftStr} (${item.commentsCount} comments)`)
        lines.push(`        ${item.url}`)
      }
    }
    if (prDelta.statusChanges.length > 0) {
      lines.push(`  🔄 Status & Lifecycle Changes (${prDelta.statusChanges.length}):`)
      for (const item of prDelta.statusChanges) {
        const stateTransition = item.prevState !== item.toState ? `${item.prevState} ➔ ${item.toState}` : ''
        const draftTransition = item.prevDraft !== item.toDraft ? (item.toDraft ? '➔ Draft' : 'Draft ➔ Ready') : ''
        const changeDesc = [stateTransition, draftTransition].filter(Boolean).join(', ')
        const typeStr = item.type ? `[${item.type}] ` : ''
        lines.push(`      • ${typeStr}#${item.number}: ${item.title} (${changeDesc})`)
        lines.push(`        ${item.url}`)
      }
    }
    if (prDelta.commentChanges.length > 0) {
      lines.push(`  💬 Discussion Activity (${prDelta.commentChanges.length}):`)
      for (const item of prDelta.commentChanges) {
        const sign = item.delta > 0 ? `+${item.delta}` : `${item.delta}`
        const typeStr = item.type ? `[${item.type}] ` : ''
        lines.push(`      • ${typeStr}#${item.number}: ${item.title} (${sign} new comments, total ${item.newCount})`)
        lines.push(`        ${item.url}`)
      }
    }
  }

  if (config.watchedItems.length > 0 && prDelta?.nextTrackedMap) {
    lines.push(`\n👁️ Watched ${config.name} Radar:`)
    const tracked = prDelta.nextTrackedMap
    for (const w of config.watchedItems) {
      const info = tracked[`PR:${w.number}`] || tracked[`Issue:${w.number}`] || tracked[String(w.number)]
      if (info) {
        const stateStr = info.isDraft ? 'Draft' : info.state
        const commentChange = prDelta?.commentChanges?.find(c => c.number === w.number)
        const updateNotice = commentChange ? ` 🚨 (+${commentChange.delta} comments, ${commentChange.newCount} total!)` : ''
        const typeStr = info.type ? `[${info.type}] ` : ''
        lines.push(`  • ${typeStr}#${w.number} [${stateStr}] (${info.commentsCount} comments)${updateNotice}: ${info.title}`)
        lines.push(`    ↳ ${w.focus}`)
        lines.push(`    ↳ ${info.url}`)
      }
      else {
        lines.push(`  • #${w.number}: ${w.title}`)
        lines.push(`    ↳ ${w.focus}`)
      }
    }
  }

  return lines.join('\n')
}

function formatMarkdownSection(config, delta, prDelta, customNotes = '') {
  const { fromSha, toSha, commits, filesCount, groupedSubsystems } = delta
  const today = new Date().toISOString().split('T')[0]
  const lines = []

  const prChangesCount = prDelta?.totalChanges || 0
  const hasCommits = commits.length > 0
  const hasPRChanges = prChangesCount > 0

  if (hasCommits) {
    const prPart = hasPRChanges ? `, ${prChangesCount} update(s)` : ''
    lines.push(`\n## [${today}] ${config.name} Delta: \`${fromSha.slice(0, 8)}..${toSha.slice(0, 8)}\` (${commits.length} commits, ${filesCount} files${prPart})`)
  }
  else {
    lines.push(`\n## [${today}] ${config.name} Activity: \`${toSha.slice(0, 8)}\` (${prChangesCount} update(s))`)
  }
  lines.push('')

  if (prDelta?.actionableMentions?.length > 0) {
    lines.push('### 🚨 Action Required: Direct Mentions & Maintainer Inquiries')
    for (const m of prDelta.actionableMentions) {
      const ackStr = m.isAcknowledged ? ' *(Acknowledged)*' : ' **(Pending Reply)**'
      const typeStr = m.itemType ? `[${m.itemType}] ` : ''
      lines.push(`- ${typeStr}[#${m.itemNumber}](${m.itemUrl}) \`${m.itemTitle}\` — Comment by **@${m.author}**${ackStr} ([view comment](${m.commentUrl})):`)
      lines.push(`  > "${m.bodyPreview.replace(/"/g, '\\"')}"`)
    }
    lines.push('')
  }

  if (customNotes) {
    lines.push('### 🎯 Executive Highlights')
    lines.push(customNotes.trim())
    lines.push('')
  }

  if (hasCommits) {
    lines.push(`### 📋 ${config.name} Commits`)
    for (const c of commits) {
      const prLink = c.prNumber
        ? `[#${c.prNumber}](https://github.com/${config.repo}/pull/${c.prNumber})`
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
    lines.push(`### 📬 ${config.name} Activity Radar`)
    if (prDelta.newPrs.length > 0) {
      lines.push(`#### 🆕 New Items Opened (${prDelta.newPrs.length})`)
      for (const item of prDelta.newPrs) {
        const draftStr = item.isDraft ? ' *(Draft)*' : ''
        const typeStr = item.type ? `[${item.type}] ` : ''
        lines.push(`- ${typeStr}[#${item.number}](${item.url}) \`${item.title}\` by **@${item.author}**${draftStr} *(${item.commentsCount} comments)*`)
      }
      lines.push('')
    }
    if (prDelta.statusChanges.length > 0) {
      lines.push(`#### 🔄 Status & Lifecycle Changes (${prDelta.statusChanges.length})`)
      for (const item of prDelta.statusChanges) {
        const stateTransition = item.prevState !== item.toState ? `\`${item.prevState}\` ➔ \`${item.toState}\`` : ''
        const draftTransition = item.prevDraft !== item.toDraft ? (item.toDraft ? '➔ `Draft`' : '`Draft` ➔ `Ready`') : ''
        const changeDesc = [stateTransition, draftTransition].filter(Boolean).join(', ')
        const typeStr = item.type ? `[${item.type}] ` : ''
        lines.push(`- ${typeStr}[#${item.number}](${item.url}) \`${item.title}\` — ${changeDesc}`)
      }
      lines.push('')
    }
    if (prDelta.commentChanges.length > 0) {
      lines.push(`#### 💬 Discussion Activity (${prDelta.commentChanges.length})`)
      for (const item of prDelta.commentChanges) {
        const sign = item.delta > 0 ? `+${item.delta}` : `${item.delta}`
        const typeStr = item.type ? `[${item.type}] ` : ''
        lines.push(`- ${typeStr}[#${item.number}](${item.url}) \`${item.title}\` — *${sign} comments (${item.prevCount} ➔ ${item.newCount} total)*`)
      }
      lines.push('')
    }
  }

  if (config.watchedItems.length > 0 && prDelta?.nextTrackedMap) {
    lines.push(`### 👁️ Watched ${config.name} Monitor`)
    const tracked = prDelta.nextTrackedMap
    for (const w of config.watchedItems) {
      const info = tracked[`PR:${w.number}`] || tracked[`Issue:${w.number}`] || tracked[String(w.number)]
      if (info) {
        const stateStr = info.isDraft ? 'Draft' : info.state
        const commentChange = prDelta?.commentChanges?.find(c => c.number === w.number)
        const updateNotice = commentChange ? ` — 🚨 **+${commentChange.delta} comments** (${commentChange.newCount} total)` : ` — *(${info.commentsCount} comments)*`
        const typeStr = info.type ? `[${info.type}] ` : ''
        lines.push(`- ${typeStr}[#${w.number}](${info.url}) \`${info.title}\` [${stateStr}]${updateNotice}`)
        lines.push(`  - *Focus*: ${w.focus}`)
      }
      else {
        lines.push(`- [#${w.number}](https://github.com/${config.repo}/pull/${w.number}) \`${w.title}\``)
        lines.push(`  - *Focus*: ${w.focus}`)
      }
    }
    lines.push('')
  }

  lines.push('---')
  return lines.join('\n')
}

function ensureRadarLogHeader(config) {
  if (!fs.existsSync(config.radarLogFile)) {
    const dir = path.dirname(config.radarLogFile)
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })
    const initialContent = `# ${config.radarTitle}

> **Living Intelligence Ledger**: ${config.radarSubtitle}
> Generated and maintained by Antigravity Scheduled Tasks via \`scripts/upstream-tracker.mjs${config.id === 'upstream' ? '' : ` --${config.id}`}\`.

---

<!-- RADAR_ENTRIES -->
`
    fs.writeFileSync(config.radarLogFile, initialContent, 'utf8')
  }
}

function appendToRadarLog(config, markdownSection) {
  ensureRadarLogHeader(config)
  const currentContent = fs.readFileSync(config.radarLogFile, 'utf8')
  const marker = '<!-- RADAR_ENTRIES -->'
  const markerIndex = currentContent.indexOf(marker)
  if (markerIndex !== -1) {
    const header = currentContent.slice(0, markerIndex + marker.length)
    const rest = currentContent.slice(markerIndex + marker.length)
    const updated = `${header}\n\n${markdownSection.trim()}\n${rest.trimStart()}`
    fs.writeFileSync(config.radarLogFile, updated, 'utf8')
    return
  }

  const headerSplit = currentContent.indexOf('---')
  if (headerSplit !== -1) {
    const header = currentContent.slice(0, headerSplit + 3)
    const rest = currentContent.slice(headerSplit + 3)
    const updated = `${header}\n${markdownSection}\n${rest.trimStart()}`
    fs.writeFileSync(config.radarLogFile, updated, 'utf8')
  }
  else {
    fs.appendFileSync(config.radarLogFile, `\n${markdownSection}\n`, 'utf8')
  }
}

// 8. CLI Main
async function main() {
  const options = {
    '7n1m4': { type: 'boolean', default: false },
    'fork': { type: 'string' },
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
    'ack-mention': { type: 'string' },
    'json': { type: 'boolean', default: false },
    'help': { type: 'boolean', short: 'h', default: false },
  }

  const { values } = parseArgs({ args: process.argv.slice(2), options, allowPositionals: true })

  const is7n1m4 = Boolean(values['7n1m4'] || values.fork === '7n1m4')
  const config = is7n1m4 ? TARGET_CONFIGS['7n1m4'] : TARGET_CONFIGS.upstream

  if (values.help) {
    console.log(`
Usage: node scripts/upstream-tracker.mjs [options]

Target Selection:
  --7n1m4                 Target the 7n1m4/airi fork (writes to docs/7N1M4_RADAR.md).
  --fork <name>           Target specific fork config ('7n1m4' supported).

Commands:
  --init                  Seed state file with current target HEAD and PR snapshot.
  --check                 Fetch target remote and check for delta since last snapshot.
  --since <sha>           Test diff from a specific commit instead of state file.
  --skip-prs              Bypass GitHub PR/issue checking (pure git commit checks only).
  --append-log            Append the delta summary to radar log file.
  --notes <string>        Executive summary notes to embed in the radar log entry.
  --update-state          Advance baseline SHA and PR state to current target state.
  --ack-mention <url>     Mark a specific direct mention / inquiry as acknowledged.
  --json                  Output result in JSON format.
  --format <brief|md>     Output format (brief text or Markdown).
  --dry-run               Do not write to state file or radar markdown file.
`)
    process.exit(0)
  }

  const state = loadState(config)

  if (values['ack-mention']) {
    if (!state.acknowledged_mentions)
      state.acknowledged_mentions = []
    if (!state.acknowledged_mentions.includes(values['ack-mention'])) {
      state.acknowledged_mentions.push(values['ack-mention'])
      saveState(config, state)
      console.log(`✅ [${config.name}Tracker] Marked mention as acknowledged: ${values['ack-mention']}`)
    }
    else {
      console.log(`ℹ️ [${config.name}Tracker] Mention already acknowledged: ${values['ack-mention']}`)
    }
    process.exit(0)
  }

  // Mode 1: Initialization
  if (values.init) {
    console.log(`[${config.name}Tracker] Fetching ${config.remote}...`)
    fetchTarget(config)
    const targetSha = values.sha || getTargetHeadSha(config)
    state.last_inspected_sha = targetSha
    state.last_run_timestamp = new Date().toISOString()

    let itemCount = 0
    if (!values['skip-prs']) {
      const items = fetchTargetItems(config)
      if (items) {
        state.tracked_prs = {}
        for (const item of items) {
          const key = `${item.type || 'PR'}:${item.number}`
          state.tracked_prs[key] = {
            title: item.title,
            state: item.state,
            isDraft: item.isDraft,
            author: item.author,
            commentsCount: item.commentsCount,
            updatedAt: item.updatedAt,
            url: item.url,
            type: item.type,
          }
        }
        itemCount = items.length
      }
    }

    if (!values['dry-run']) {
      saveState(config, state)
      ensureRadarLogHeader(config)
    }
    console.log(`✅ [${config.name}Tracker] Initialized snapshot baseline at: ${targetSha} (tracking ${itemCount} items)`)
    process.exit(0)
  }

  // Mode 2: Check & Diff
  fetchTarget(config)
  const currentHeadSha = getTargetHeadSha(config)
  const rawBaseSha = values.since || state.last_inspected_sha

  if (!rawBaseSha) {
    console.error(`❌ [${config.name}Tracker] No baseline SHA found. Run with \`--init\` first to snapshot current state.`)
    process.exit(1)
  }

  let baseSha = rawBaseSha
  try {
    baseSha = runGit(`rev-parse ${rawBaseSha}`)
  }
  catch {
    baseSha = rawBaseSha
  }

  // PR & Issue Activity Check
  const fetchedItems = values['skip-prs'] ? null : fetchTargetItems(config)
  const prDelta = inspectPRDelta(state.tracked_prs, fetchedItems, state.last_run_timestamp, state.acknowledged_mentions || [])

  const isShaUnchanged = baseSha === currentHeadSha
  const hasNoCommits = isShaUnchanged
  const hasNoPRChanges = prDelta.totalChanges === 0
  const hasUnackedMentions = prDelta.actionableMentions?.some(m => !m.isAcknowledged) || false

  if (hasNoCommits && hasNoPRChanges && !hasUnackedMentions) {
    if (values.json) {
      console.log(JSON.stringify({ status: 'UP_TO_DATE', sha: currentHeadSha, commits: 0, prChanges: 0 }))
    }
    else {
      console.log(`🟢 UP_TO_DATE: ${config.name} is unchanged at ${currentHeadSha.slice(0, 8)}. 0 new commits and 0 PR/Issue changes since last check.`)
    }
    if (!values['dry-run'] && prDelta.available && Object.keys(state.tracked_prs).length === 0) {
      state.tracked_prs = prDelta.nextTrackedMap
      saveState(config, state)
    }
    process.exit(0)
  }

  const delta = isShaUnchanged
    ? { fromSha: baseSha, toSha: currentHeadSha, commits: [], filesCount: 0, groupedSubsystems: {} }
    : inspectDelta(baseSha, currentHeadSha)

  if (values.json) {
    console.log(JSON.stringify({
      status: 'NEW_ACTIVITY',
      sha: { from: baseSha, to: currentHeadSha },
      commits: delta.commits,
      filesCount: delta.filesCount,
      subsystems: delta.groupedSubsystems,
      prs: prDelta,
    }, null, 2))
  }
  else if (values.format === 'md') {
    const md = formatMarkdownSection(config, delta, prDelta, values.notes)
    console.log(md)
  }
  else {
    console.log(formatTerminalBrief(config, delta, prDelta))
  }

  if (values['append-log'] && !values['dry-run']) {
    const md = formatMarkdownSection(config, delta, prDelta, values.notes)
    appendToRadarLog(config, md)
    console.log(`\n📝 [${config.name}Tracker] Prepending entry to ${path.relative(process.cwd(), config.radarLogFile)}`)
  }

  const shouldUpdateState = !values['dry-run'] && (values['update-state'] || (values['append-log'] && !values.since))
  if (shouldUpdateState) {
    state.last_inspected_sha = currentHeadSha
    state.last_run_timestamp = new Date().toISOString()
    if (prDelta.available) {
      state.tracked_prs = prDelta.nextTrackedMap
    }
    state.history.push({
      date: new Date().toISOString(),
      from_sha: baseSha,
      to_sha: currentHeadSha,
      commits_count: delta.commits.length,
      files_count: delta.filesCount,
      pr_changes_count: prDelta.totalChanges,
    })
    saveState(config, state)
    console.log(`✅ [${config.name}Tracker] Advanced baseline SHA to ${currentHeadSha.slice(0, 8)} (tracking ${Object.keys(state.tracked_prs).length} items)`)
  }
}

main().catch((err) => {
  console.error(`❌ [Tracker] Error: ${err.message}`)
  process.exit(1)
})
