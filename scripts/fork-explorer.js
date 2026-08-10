#!/usr/bin/env node

/**
 * Project Fork Explorer — Automated Upstream R&D Reconnaissance & API Fingerprinting
 *
 * Scans GitHub forks of moeru-ai/airi for structural innovations, API method calls,
 * and package additions across curated fingerprint profiles.
 */

import fs from 'node:fs'
import path from 'node:path'

import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const CACHE_FILE = path.join(ROOT_DIR, '.fork-explorer-cache.json')
const DEFAULT_REPORT_FILE = path.join(ROOT_DIR, 'docs', 'fork-harvest-report.md')

// ── Curated Fingerprint Profiles ──
const PROFILES = {
  'telegram-modern': {
    name: 'Modern Telegram Integration',
    description: 'In-app Telegram bot engine or Eventa SDK ingestion (excluding legacy sidecar)',
    signatures: ['grammy', 'telegraf', '@proj-airi/plugin-telegram', 'telegram-bot-api', 'TelegramBot', 'TelegramClient'],
    excludePaths: ['services/telegram/'],
  },
  'browser-ml': {
    name: 'In-Browser Machine Learning & WebGPU',
    description: 'Local WebGPU / WASM ML models and pipeline execution',
    signatures: ['@huggingface/transformers', '@xenova/transformers', 'tesseract.js', 'onnxruntime-web', '@mlc-ai/web-llm'],
    excludePaths: [],
  },
  'live2d-dsl': {
    name: 'Live2D DSL & State Machine Runtime',
    description: 'VarFloats, intimacy sandbox, and Live2D manifest VM',
    signatures: ['varfloats', 'VarFloats', 'intimacy', 'dslActive', 'motion3.json', 'cubism-sdk', 'expression_map'],
    excludePaths: [],
  },
  'vrm-touch-ik': {
    name: 'VRM 3D Touch, Raycasting & Kinematics',
    description: 'Direct 3D VRM mouse dragging, body part raycasting, and IK solvers',
    signatures: ['Raycaster.intersectObject', 'getNormalizedBoneNode', 'setFromNormalAndCoplanarPoint', 'ikTarget', 'draggedPart'],
    excludePaths: [],
  },
  'rwkv-vector-rag': {
    name: 'WebGPU RWKV & Vector RAG Engine',
    description: 'State delta salience, safetensors loading, or local vector indexing',
    signatures: ['web-rwkv', 'safetensors', 'perLayerCosine', 'voy-search', 'duckdb-wasm', 'hnswlib'],
    excludePaths: [],
  },
}

// Parse CLI Args
const args = process.argv.slice(2)
function getArg(flag, defaultValue = null) {
  const idx = args.indexOf(flag)
  if (idx !== -1 && idx + 1 < args.length)
    return args[idx + 1]
  return defaultValue
}
const hasFlag = flag => args.includes(flag)

const profileArg = getArg('--profile', 'all')
const limitArg = Number.parseInt(getArg('--limit', '15'), 10)
const daysArg = Number.parseInt(getArg('--days', '30'), 10)
const outputFile = getArg('--output', DEFAULT_REPORT_FILE)
const isDryRun = hasFlag('--dry-run')
const skipValidate = hasFlag('--skip-validate')

// GitHub Token / Auth Helper
function getGitHubToken() {
  if (process.env.GITHUB_TOKEN)
    return process.env.GITHUB_TOKEN
  try {
    return execSync('gh auth token', { encoding: 'utf-8' }).trim()
  }
  catch {
    console.error('❌ Error: No GitHub authentication found. Please set GITHUB_TOKEN or run `gh auth login`.')
    process.exit(1)
  }
}

function ghApi(endpoint) {
  try {
    const raw = execSync(`gh api "${endpoint}"`, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 })
    return JSON.parse(raw)
  }
  catch (err) {
    return null
  }
}

// ── Pre-Flight Upstream Baseline Validation Pass ──
function validateSignaturesAgainstBaseline(activeProfiles) {
  console.log('\n⚡ Executing Pre-Flight Upstream Baseline Validation Pass...')
  const suppressed = new Map()

  for (const [profileKey, profile] of Object.entries(activeProfiles)) {
    const validSigs = []
    for (const sig of profile.signatures) {
      try {
        // Search local repository for signature
        const grepRes = execSync(`grep -rn "${sig}" --include="*.ts" --include="*.vue" --include="*.json" "${ROOT_DIR}/packages" "${ROOT_DIR}/apps" 2>/dev/null | grep -v node_modules | head -n 1`, { encoding: 'utf-8' }).trim()
        if (grepRes) {
          console.warn(`  🚨 Baseline Warning: Signature "${sig}" already exists in upstream main! (Suppression active)`)
          if (!suppressed.has(profileKey))
            suppressed.set(profileKey, [])
          suppressed.get(profileKey).push(sig)
        }
        else {
          validSigs.push(sig)
        }
      }
      catch {
        validSigs.push(sig)
      }
    }
    profile.activeSignatures = validSigs
  }
  return suppressed
}

// Cache Management
function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
    }
    catch {}
  }
  return { last_run: null, scanned_repositories: {} }
}

function saveCache(cache) {
  if (isDryRun)
    return
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8')
}

// Main Execution
async function main() {
  console.log('====================================================')
  console.log('🛰️  PROJECT FORK EXPLORER — ECOSYSTEM RECONNAISSANCE')
  console.log('====================================================')

  const token = getGitHubToken()
  console.log(`✓ GitHub Token verified via gh CLI`)

  // Active profiles selection
  let selectedProfiles = {}
  if (profileArg === 'all') {
    selectedProfiles = PROFILES
  }
  else {
    const keys = profileArg.split(',').map(s => s.trim())
    for (const k of keys) {
      if (PROFILES[k]) {
        selectedProfiles[k] = PROFILES[k]
      }
      else {
        console.warn(`⚠️ Warning: Unknown profile "${k}". Skipping.`)
      }
    }
  }

  if (!skipValidate) {
    validateSignaturesAgainstBaseline(selectedProfiles)
  }
  else {
    for (const p of Object.values(selectedProfiles)) {
      p.activeSignatures = p.signatures
    }
  }

  const cache = loadCache()
  const cutoffDate = new Date(Date.now() - daysArg * 24 * 60 * 60 * 1000)

  console.log(`\n🔍 Fetching top-starred forks from moeru-ai/airi via REST API (Limit: ${limitArg}, Cutoff: ${daysArg} days)...`)

  // Use REST API to list forks sorted by stargazers
  const forksRes = ghApi(`repos/moeru-ai/airi/forks?sort=stargazers&per_page=${Math.min(limitArg, 100)}`) || []
  const forkNodes = forksRes.map(f => ({
    nameWithOwner: f.full_name,
    pushedAt: f.pushed_at,
    stargazerCount: f.stargazers_count,
    defaultBranch: f.default_branch || 'main',
  }))

  console.log(`✓ Found ${forkNodes.length} candidate forks to inspect.`)

  const matchesByProfile = {}
  for (const pKey of Object.keys(selectedProfiles)) {
    matchesByProfile[pKey] = []
  }

  let inspectedCount = 0
  for (const fork of forkNodes) {
    const fullName = fork.nameWithOwner
    const pushedAt = new Date(fork.pushedAt)

    inspectedCount++
    console.log(`\n[${inspectedCount}/${forkNodes.length}] Inspecting ${fullName} (Stars: ${fork.stargazerCount}, Pushed: ${fork.pushedAt})...`)

    // Check compare diff against moeru-ai:main
    const compareRes = ghApi(`repos/moeru-ai/airi/compare/main...${fullName.replace('/', ':')}:${fork.defaultBranch}`)
    if (!compareRes || !compareRes.commits || compareRes.commits.length === 0) {
      console.log(`  └─ No commits ahead of upstream main.`)
      continue
    }

    console.log(`  └─ Ahead by ${compareRes.commits.length} commits (${compareRes.files?.length || 0} modified files).`)

    const matchedForFork = []

    for (const [pKey, profile] of Object.entries(selectedProfiles)) {
      const activeSigs = profile.activeSignatures || profile.signatures
      if (activeSigs.length === 0)
        continue

      const matchesInFork = []

      // 1. Check Commit Messages
      for (const commit of compareRes.commits) {
        const msg = commit.commit.message
        for (const sig of activeSigs) {
          if (msg.toLowerCase().includes(sig.toLowerCase())) {
            matchesInFork.push({ type: 'commit', sig, detail: msg.split('\n')[0] })
          }
        }
      }

      // 2. Check File Paths & Diff Filenames
      if (compareRes.files) {
        for (const file of compareRes.files) {
          if (profile.excludePaths.some(ex => file.filename.includes(ex))) {
            continue
          }

          for (const sig of activeSigs) {
            if (file.filename.toLowerCase().includes(sig.toLowerCase())) {
              matchesInFork.push({ type: 'filename', sig, detail: file.filename })
            }
            if (file.patch && file.patch.toLowerCase().includes(sig.toLowerCase())) {
              matchesInFork.push({ type: 'code_patch', sig, detail: file.filename })
            }
          }
        }
      }

      if (matchesInFork.length > 0) {
        const resultItem = {
          repo: fullName,
          pushedAt: fork.pushedAt,
          stars: fork.stargazerCount,
          commitsAhead: compareRes.commits.length,
          compareUrl: `https://github.com/moeru-ai/airi/compare/main...${fullName.replace('/', ':')}:${fork.defaultBranch}`,
          matches: matchesInFork,
        }
        matchesByProfile[pKey].push(resultItem)
        matchedForFork.push(pKey)
        console.log(`  🎯 MATCHED PROFILE [${pKey}]! (${matchesInFork.length} hits)`)
      }
    }
  }

  // ── Global Signature Code Search ──
  console.log('\n🔎 Executing Global Signature Code Search across AIRI forks...')
  for (const [pKey, profile] of Object.entries(selectedProfiles)) {
    const activeSigs = profile.activeSignatures || profile.signatures
    for (const sig of activeSigs) {
      console.log(`  └─ Querying GitHub Code Search for signature "${sig}" in AIRI forks...`)
      const searchRes = ghApi(`search/code?q=${encodeURIComponent(sig)}+fork:only+airi`)
      if (searchRes && searchRes.items && searchRes.items.length > 0) {
        for (const item of searchRes.items.slice(0, 10)) {
          const repoName = item.repository?.full_name
          if (!repoName || repoName === 'moeru-ai/airi' || repoName === 'dasilva333/airi')
            continue

          if (profile.excludePaths.some(ex => item.path.includes(ex)))
            continue

          const resultItem = {
            repo: repoName,
            pushedAt: item.repository?.updated_at || 'Recent',
            stars: item.repository?.stargazers_count || 0,
            commitsAhead: 1,
            compareUrl: `https://github.com/moeru-ai/airi/compare/main...${repoName.replace('/', ':')}:main`,
            matches: [{ type: 'code_search', sig, detail: item.path }],
          }

          const existing = matchesByProfile[pKey].find(m => m.repo === repoName)
          if (!existing) {
            matchesByProfile[pKey].push(resultItem)
            console.log(`    🎯 FOUND IN AIRI FORK [${repoName}] -> ${item.path}`)
          }
        }
      }
    }
  }

  cache.last_run = new Date().toISOString()
  saveCache(cache)

  // Generate Markdown Report
  console.log('\n====================================================')
  console.log('📊 GENERATING RECONNAISSANCE HARVEST REPORT')
  console.log('====================================================')

  let markdown = `# AIRI Ecosystem R&D Harvest Report\n\n`
  markdown += `* **Generated At**: ${new Date().toLocaleString()}\n`
  markdown += `* **Scanned Range**: Top ${inspectedCount} forks updated in last ${daysArg} days\n\n`
  markdown += `---\n\n`

  let totalHits = 0
  for (const [pKey, profile] of Object.entries(selectedProfiles)) {
    const hits = matchesByProfile[pKey] || []
    totalHits += hits.length

    markdown += `## Profile: ${profile.name} (\`${pKey}\`)\n`
    markdown += `*${profile.description}*\n\n`

    if (hits.length === 0) {
      markdown += `*No matching fork candidates found in current scan window.*\n\n`
      continue
    }

    for (const item of hits) {
      markdown += `### 🎯 [${item.repo}](https://github.com/${item.repo})\n`
      markdown += `* **Last Pushed**: \`${item.pushedAt}\` | **Commits Ahead**: \`${item.commitsAhead}\` | **Stars**: \`${item.stars}\`\n`
      markdown += `* **Compare Diff**: [View Diff vs Upstream](${item.compareUrl})\n`
      markdown += `* **Matched Signatures**:\n`

      const uniqueMatches = new Map()
      for (const m of item.matches) {
        uniqueMatches.set(`${m.type}:${m.sig}:${m.detail}`, m)
      }

      for (const m of uniqueMatches.values()) {
        markdown += `  - \`[${m.type.toUpperCase()}]\` Signature **\`${m.sig}\`** in \`${m.detail}\`\n`
      }
      markdown += `\n`
    }
    markdown += `---\n\n`
  }

  if (!isDryRun) {
    fs.mkdirSync(path.dirname(outputFile), { recursive: true })
    fs.writeFileSync(outputFile, markdown, 'utf-8')
    console.log(`\n✅ Harvest Report successfully saved to: ${outputFile}`)
  }
  else {
    console.log(`\n[Dry Run] Report generated in-memory (${totalHits} total candidate hits).`)
  }

  console.log(`✓ Fork Explorer scan completed cleanly.\n`)
}

main().catch((err) => {
  console.error('❌ Fatal Execution Error:', err)
  process.exit(1)
})
