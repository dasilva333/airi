import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const docsDir = path.join(projectRoot, 'docs')
const skillsDir = path.join(projectRoot, '.agents', 'skills')

function getAllMarkdownFiles(dir, fileList = []) {
  if (!fs.existsSync(dir))
    return fileList
  const files = fs.readdirSync(dir)
  for (const file of files) {
    if (file === 'node_modules')
      continue
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      getAllMarkdownFiles(filePath, fileList)
    }
    else if (file.endsWith('.md')) {
      fileList.push(filePath)
    }
  }
  return fileList
}

function getSkillsMap() {
  const map = new Map()
  if (!fs.existsSync(skillsDir))
    return map
  const skillFolders = fs.readdirSync(skillsDir)

  for (const folder of skillFolders) {
    const skillMdPath = path.join(skillsDir, folder, 'SKILL.md')
    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, 'utf-8')
      map.set(folder, {
        path: skillMdPath,
        content,
      })
    }
  }
  return map
}

function runAudit() {
  console.log('🔍 Running Skill-Documentation Coverage Audit...\n')

  const docs = getAllMarkdownFiles(docsDir)
  const skills = getSkillsMap()

  console.log(`Found ${docs.length} documentation files in docs/`)
  console.log(`Found ${skills.size} skill definitions in .agents/skills/\n`)

  const coverage = new Map()
  const unreferencedDocs = []

  for (const docPath of docs) {
    const relativeDocPath = path.relative(projectRoot, docPath)
    const docBasename = path.basename(docPath)
    const stem = docBasename.replace(/\.md$/, '').toLowerCase()

    const matchingSkills = []

    for (const [skillName, skillData] of skills.entries()) {
      const content = skillData.content.toLowerCase()
      if (
        content.includes(relativeDocPath.toLowerCase())
        || content.includes(docBasename.toLowerCase())
        || (stem.length > 5 && content.includes(stem))
      ) {
        matchingSkills.push(skillName)
      }
    }

    if (matchingSkills.length > 0) {
      coverage.set(relativeDocPath, matchingSkills)
    }
    else {
      unreferencedDocs.push(relativeDocPath)
    }
  }

  console.log('====================================================')
  console.log('📌 COVERAGE REPORT SUMMARY')
  console.log('====================================================\n')

  console.log(`✅ ${coverage.size} / ${docs.length} documentation files matched skills.`)
  console.log(`⚠️ ${unreferencedDocs.length} documentation files unreferenced by name or keyword.\n`)

  return { coverage, unreferencedDocs, skills, docs }
}

runAudit()
