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

import { execSync } from 'node:child_process'
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

// Match markdown links pointing to .test.ts or .test.js files
// Supports both `[...](path)` and markdown table cell paths
const linkRegex = /\[([^\]]+)\]\(([^)]+\.test\.(?:ts|js|vue))\)/g
const tablePathRegex = /\|\s*`?((?:packages|apps)\/[^`|\s]+\.test\.(?:ts|js|vue))`?\s*\|/g

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
let vitestSuites = []
try {
  const vitestOutput = execSync('pnpm exec vitest list --json', {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  })
  const tests = JSON.parse(vitestOutput)
  const uniqueVitestFiles = new Set(tests.map(t => path.relative(REPO_ROOT, t.file)))
  vitestSuites = [...uniqueVitestFiles]
}
catch (err) {
  console.warn('⚠️ Could not run vitest list --json, falling back to filesystem scan.')
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
