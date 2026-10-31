#!/usr/bin/env node

/**
 * Test Catalog Freshness & Integrity Auditor
 *
 * Verifies that:
 * 1. Every test file referenced in `docs/project-testing-parity.md` exists on disk.
 * 2. Every active test file discovered by Vitest is documented in the catalog.
 * 3. Relative markdown links are well-formed and resolvable.
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const CATALOG_PATH = path.resolve(REPO_ROOT, 'docs/project-testing-parity.md')

if (!fs.existsSync(CATALOG_PATH)) {
  console.error(`❌ Catalog not found at: ${CATALOG_PATH}`)
  process.exit(1)
}

console.log('🔍 Auditing Test Catalog against repository state...')

const catalogContent = fs.readFileSync(CATALOG_PATH, 'utf8')

// Match markdown links pointing to .test.ts, .spec.ts, or .test.js files
// Supports both `[...](path)` and markdown table cell paths
const linkRegex = /\[([^\]]+)\]\(([^)]+\.(?:test|spec)\.(?:ts|js|vue))\)/g
const tablePathRegex = /\|\s*`?((?:packages|apps)\/[^`|\s]+\.(?:test|spec)\.(?:ts|js|vue))`?\s*\|/g

const catalogFiles = new Set()
let match

while ((match = linkRegex.exec(catalogContent)) !== null) {
  let target = match[2]
  // Normalize relative link from docs/ directory
  if (target.startsWith('../')) {
    target = target.replace(/^\.\.\//, '')
  }
  else if (target.startsWith('./')) {
    target = path.join('docs', target.replace(/^\.\//, ''))
  }
  catalogFiles.add(path.normalize(target))
}

while ((match = tablePathRegex.exec(catalogContent)) !== null) {
  catalogFiles.add(path.normalize(match[1]))
}

console.log(`📋 Discovered ${catalogFiles.size} unique test suite paths in catalog.`)

// 1. Verify all catalog files exist on disk
let missingFiles = 0
for (const relPath of catalogFiles) {
  const fullPath = path.resolve(REPO_ROOT, relPath)
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Catalog references non-existent file: ${relPath}`)
    missingFiles++
  }
}

// 2. Discover actual test suites in repository via Vitest
//
// Vitest is invoked directly through its resolved bin entry instead of via
// `pnpm exec`. When pnpm is asked to verify dependencies before running
// (`npm_config_verify_deps_before_run`, which pnpm itself sets on nested
// `exec` calls), it prints an "Unsupported engine" WARN banner on STDOUT if the
// local Node version falls outside the workspace `engines.node` range. The
// banner lands in front of the JSON payload and breaks `JSON.parse`.
//
// This bypasses pnpm entirely, so no banner can contaminate stdout regardless of
// pnpm's environment. The discovered file set is identical to what `pnpm exec`
// and `pnpm --silent exec` return, so the parity verdict is unchanged.
let vitestSuites = []
try {
  const localRequire = createRequire(path.join(REPO_ROOT, 'package.json'))
  const vitestPackageJson = localRequire.resolve('vitest/package.json')
  const { bin } = JSON.parse(fs.readFileSync(vitestPackageJson, 'utf8'))
  const vitestEntry = path.resolve(path.dirname(vitestPackageJson), typeof bin === 'string' ? bin : bin.vitest)

  const discovery = spawnSync(process.execPath, [vitestEntry, 'list', '--json'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  })

  if (discovery.error)
    throw discovery.error
  if (discovery.status !== 0) {
    const detail = String(discovery.stderr).trim() || String(discovery.stdout).trim()
    throw new Error(`vitest exited with code ${discovery.status}: ${detail.slice(0, 500)}`)
  }

  const tests = JSON.parse(discovery.stdout)
  const uniqueVitestFiles = new Set(tests.map(t => path.relative(REPO_ROOT, t.file)))
  vitestSuites = [...uniqueVitestFiles]
}
catch (err) {
  console.error('❌ Vitest test suite discovery failed:', err.message)
  process.exit(1)
}

if (vitestSuites.length === 0) {
  console.error('❌ Vitest discovery returned 0 test suites. Cannot verify catalog parity.')
  process.exit(1)
}

let untrackedSuites = 0
if (vitestSuites.length > 0) {
  for (const suite of vitestSuites) {
    if (!catalogFiles.has(suite)) {
      console.warn(`⚠️ Active Vitest suite NOT listed in catalog: ${suite}`)
      untrackedSuites++
    }
  }
}

console.log('\n=== Test Catalog Audit Results ===')
console.log(`Total cataloged test files: ${catalogFiles.size}`)
console.log(`Missing file errors:        ${missingFiles}`)
console.log(`Uncataloged Vitest suites:  ${untrackedSuites}`)

if (missingFiles > 0) {
  console.error('\n❌ Audit FAILED: Catalog contains dead or broken file links.')
  process.exit(1)
}

if (untrackedSuites > 0) {
  console.warn('\n⚠️ Warning: Some active test suites are missing from the catalog.')
}
else {
  console.log('\n✅ Audit PASSED: 100% of active test suites match catalog inventory.')
}
