import { readFileSync, writeFileSync } from 'node:fs'

import { isMap, isScalar, LineCounter, parseDocument } from 'yaml'

const args = process.argv.slice(2)
const command = args[0]
const filePath = args[1]

if (!command || !filePath) {
  console.log('Usage: node scripts/yaml-manager.js <command> <file> [args]')
  console.log('Commands:')
  console.log('  view-lines <file> <start> <end>    - Print lines with line numbers (1-indexed)')
  console.log('  search  <file> <string>            - Find all lines containing <string>')
  console.log('  find-key <file> <key>              - Find all instances of a YAML key')
  console.log('  clean   <file>                     - Strips trailing garbage by re-saving valid document')
  console.log('  fix-syntax <file>                  - Quotes scalars that contain colons')
  console.log('  truncate <file> <string>           - Truncates file after the first occurrence of <string>')
  console.log('  truncate-at-line <file> <ln>       - Truncates file keeping only up to line <ln>')
  console.log('  replace-line <file> <ln> <val>     - Replaces specific line (1-indexed) with <val>')
  console.log('  insert-line <file> <ln> <val>      - Inserts <val> before specific line (1-indexed)')
  console.log('  update  <file> <path> <val>        - Update/Insert value at path')
  console.log('  analyze <file>                     - Show compact tree structure')
  console.log('  audit   <file>                     - Check for duplicate keys')
  console.log('  sync    <src> <dest>               - Find keys in <src> missing from <dest>')
  process.exit(1)
}

function analyze(doc, maxDepth = 5) {
  const contents = doc.contents
  if (!contents) return

  function printNode(node, path = [], indent = 0) {
    if (isMap(node)) {
      node.items.forEach((item) => {
        const key = item.key.toString()
        let line = '?'
        try {
          if (item.key.range && doc.lineCounter) {
            line = doc.lineCounter.linePos(item.key.range[0]).line
          }
        } catch {}

        console.log(`${'  '.repeat(indent)}${[...path, key].join('.')} (line ${line})`)

        if (indent / 2 < maxDepth) {
          printNode(item.value, [...path, key], indent + 2)
        }
      })
    }
  }

  printNode(contents)
}

function audit(doc) {
  const errors = []
  const contents = doc.contents

  function checkMap(map, path = []) {
    if (!isMap(map)) return

    const keys = new Set()
    map.items.forEach((item) => {
      const key = item.key.toString()

      if (keys.has(key)) {
        const line = item.key.range ? doc.lineCounter.linePos(item.key.range[0]).line : '?'
        errors.push(`Duplicate key "${key}" at path "${path.join('.')}" (line ${line})`)
      }
      keys.add(key)

      if (isMap(item.value)) {
        checkMap(item.value, [...path, key])
      }
    })
  }

  checkMap(contents)

  if (errors.length === 0) {
    console.log('✅ No duplicate keys found.')
  } else {
    console.log('❌ Found duplicate keys:')
    errors.forEach((err) => console.log(err))
    process.exit(1)
  }
}

function fixSyntax(node) {
  let count = 0
  if (isMap(node)) {
    node.items.forEach((item) => {
      count += fixSyntax(item.value)
    })
  } else if (isScalar(node)) {
    if (typeof node.value === 'string' && node.value.includes(':')) {
      // Force quoting by setting type to PLAIN if it wasn't, or just rely on toString()
      // Actually, setting it to a double-quoted scalar if it has a colon
      if (node.type !== 'QUOTE_DOUBLE' && node.type !== 'QUOTE_SINGLE' && node.type !== 'BLOCK_LITERAL') {
        node.type = 'QUOTE_DOUBLE'
        count++
      }
    }
  }
  return count
}

function getKeys(node, path = [], keys = new Set()) {
  if (isMap(node)) {
    node.items.forEach((item) => {
      const key = item.key.toString()
      keys.add([...path, key].join('.'))
      getKeys(item.value, [...path, key], keys)
    })
  }
  return keys
}

try {
  const fileContent = readFileSync(filePath, 'utf8')
  const RAW_COMMANDS = [
    'truncate',
    'truncate-at-line',
    'replace-line',
    'insert-line',
    'view-lines',
    'search',
    'find-key',
  ]
  const isRaw = RAW_COMMANDS.includes(command)

  if (isRaw) {
    const rawLines = fileContent.split('\n')
    switch (command) {
      case 'view-lines': {
        const start = Math.max(1, Number.parseInt(args[2], 10) || 1)
        const end = Math.min(rawLines.length, Number.parseInt(args[3], 10) || rawLines.length)
        for (let i = start; i <= end; i++) {
          console.log(`${String(i).padStart(6)}: ${rawLines[i - 1]}`)
        }
        break
      }
      case 'search': {
        const term = args[2]
        if (!term) {
          console.error('Usage: search <file> <string>')
          process.exit(1)
        }
        let found = 0
        rawLines.forEach((line, i) => {
          if (line.includes(term)) {
            console.log(`${String(i + 1).padStart(6)}: ${line}`)
            found++
          }
        })
        if (found === 0) console.log(`❌ Not found: "${term}"`)
        else console.log(`\n✅ ${found} match(es)`)
        break
      }
      case 'find-key': {
        const keyName = args[2]
        if (!keyName) {
          console.error('Usage: find-key <file> <key>')
          process.exit(1)
        }
        // Match "  key:" or "- key:" patterns
        const pattern = new RegExp(`(^|\\s|-)${keyName}\\s*:`)
        let found = 0
        rawLines.forEach((line, i) => {
          if (pattern.test(line)) {
            console.log(`${String(i + 1).padStart(6)}: ${line}`)
            found++
          }
        })
        if (found === 0) console.log(`❌ Key not found: "${keyName}"`)
        else console.log(`\n✅ ${found} match(es)`)
        break
      }
      case 'truncate': {
        const searchStr = args[2]
        if (!searchStr) {
          console.error('Usage: truncate <file> <string>')
          process.exit(1)
        }
        const findIndex = fileContent.indexOf(searchStr)
        if (findIndex === -1) {
          console.error(`❌ String "${searchStr}" not found in ${filePath}`)
          process.exit(1)
        }
        const linesAfter = fileContent.substring(findIndex).split('\n')
        const truncated = fileContent.substring(0, findIndex + linesAfter[0].length)
        writeFileSync(filePath, `${truncated.trim()}\n`)
        console.log(`✅ Truncated ${filePath} after "${searchStr}"`)
        break
      }
      case 'truncate-at-line': {
        const keepLines = Number.parseInt(args[2], 10)
        if (isNaN(keepLines) || keepLines < 1) {
          console.error('Usage: truncate-at-line <file> <line_no>')
          process.exit(1)
        }
        writeFileSync(filePath, `${rawLines.slice(0, keepLines).join('\n').trimEnd()}\n`)
        console.log(`✅ Truncated ${filePath} to ${keepLines} lines`)
        break
      }
      case 'replace-line': {
        const lineNo = Number.parseInt(args[2], 10)
        const lineVal = args[3]
        if (isNaN(lineNo) || lineVal === undefined) {
          console.error('Usage: replace-line <file> <line_no> <value>')
          process.exit(1)
        }
        if (lineNo < 1 || lineNo > rawLines.length) {
          console.error(`❌ Line number ${lineNo} out of range (1-${rawLines.length})`)
          process.exit(1)
        }
        rawLines[lineNo - 1] = lineVal
        writeFileSync(filePath, rawLines.join('\n'))
        console.log(`✅ Replaced line ${lineNo} in ${filePath}`)
        break
      }
      case 'insert-line': {
        const insLineNo = Number.parseInt(args[2], 10)
        const insLineVal = args[3]
        if (isNaN(insLineNo) || insLineVal === undefined) {
          console.error('Usage: insert-line <file> <line_no> <value>')
          process.exit(1)
        }
        if (insLineNo < 1 || insLineNo > rawLines.length + 1) {
          console.error(`❌ Line number ${insLineNo} out of range (1-${rawLines.length + 1})`)
          process.exit(1)
        }
        rawLines.splice(insLineNo - 1, 0, insLineVal)
        writeFileSync(filePath, rawLines.join('\n'))
        console.log(`✅ Inserted line at ${insLineNo} in ${filePath}`)
        break
      }
    }
    process.exit(0)
  }

  const lineCounter = new LineCounter()
  const doc = parseDocument(fileContent, { keepSourceTokens: true, lineCounter })
  doc.lineCounter = lineCounter

  const hasErrors = doc.errors.length > 0
  const isFixing = command === 'clean' || command === 'fix-syntax'

  if (hasErrors && !isFixing) {
    console.error('❌ YAML Parse Errors:')
    doc.errors.forEach((err) => console.error(err))
    process.exit(1)
  }

  if (hasErrors && isFixing) {
    console.warn('⚠️ YAML Parse Errors found, attempting best-effort fix/clean...')
  }

  switch (command) {
    case 'analyze':
      analyze(doc)
      break
    case 'audit':
      audit(doc)
      break
    case 'sync': {
      const destPath = args[2]
      if (!destPath) {
        console.error('Usage: sync <src> <dest>')
        process.exit(1)
      }
      const destContent = readFileSync(destPath, 'utf8')
      const destDoc = parseDocument(destContent)
      const srcKeys = getKeys(doc.contents)
      const destKeys = getKeys(destDoc.contents)

      const missing = [...srcKeys].filter((k) => !destKeys.has(k))
      if (missing.length === 0) {
        console.log(`✅ No missing keys in ${destPath}`)
      } else {
        console.log(`❌ Missing keys in ${destPath}:`)
        missing.forEach((k) => console.log(`  - ${k}`))
      }
      break
    }
    case 'clean':
      // doc.toString() will only output the first valid document
      try {
        writeFileSync(filePath, `${doc.toString().trim()}\n`)
        console.log(`✅ Cleaned ${filePath} (stripped trailing garbage)`)
      } catch (e) {
        console.error(`❌ Error cleaning ${filePath}: ${e.message}`)
        console.log('Retry with a manual operation if the file is too corrupted for the parser.')
        process.exit(1)
      }
      break
    case 'truncate': {
      const searchStr = args[2]
      if (!searchStr) {
        console.error('Usage: truncate <file> <string>')
        process.exit(1)
      }
      const findIndex = fileContent.indexOf(searchStr)
      if (findIndex === -1) {
        console.error(`❌ String "${searchStr}" not found in ${filePath}`)
        process.exit(1)
      }
      // Truncate after the line containing the search string
      const linesAfter = fileContent.substring(findIndex).split('\n')
      const truncated = fileContent.substring(0, findIndex + linesAfter[0].length)
      writeFileSync(filePath, `${truncated.trim()}\n`)
      console.log(`✅ Truncated ${filePath} after "${searchStr}"`)
      break
    }
    case 'replace-line': {
      const lineNo = Number.parseInt(args[2], 10)
      const lineVal = args[3]
      if (isNaN(lineNo) || lineVal === undefined) {
        console.error('Usage: replace-line <file> <line_no> <value>')
        process.exit(1)
      }
      const lines = fileContent.split('\n')
      if (lineNo < 1 || lineNo > lines.length) {
        console.error(`❌ Line number ${lineNo} out of range (1-${lines.length})`)
        process.exit(1)
      }
      lines[lineNo - 1] = lineVal
      writeFileSync(filePath, lines.join('\n'))
      console.log(`✅ Replaced line ${lineNo} in ${filePath}`)
      break
    }
    case 'insert-line': {
      const insLineNo = Number.parseInt(args[2], 10)
      const insLineVal = args[3]
      if (isNaN(insLineNo) || insLineVal === undefined) {
        console.error('Usage: insert-line <file> <line_no> <value>')
        process.exit(1)
      }
      const insLines = fileContent.split('\n')
      if (insLineNo < 1 || insLineNo > insLines.length + 1) {
        console.error(`❌ Line number ${insLineNo} out of range (1-${insLines.length + 1})`)
        process.exit(1)
      }
      insLines.splice(insLineNo - 1, 0, insLineVal)
      writeFileSync(filePath, insLines.join('\n'))
      console.log(`✅ Inserted line at ${insLineNo} in ${filePath}`)
      break
    }
    case 'fix-syntax': {
      const fixedCount = fixSyntax(doc.contents)
      writeFileSync(filePath, doc.toString())
      console.log(`✅ Fixed syntax in ${filePath} (${fixedCount} scalars quoted)`)
      break
    }
    case 'update': {
      const targetPath = args[2]
      const value = args[3]
      if (!targetPath || value === undefined) {
        console.error('Usage: update <file> <path> <value>')
        process.exit(1)
      }
      doc.setIn(targetPath.split('.'), value)
      writeFileSync(filePath, doc.toString())
      console.log(`✅ Updated ${targetPath} to "${value}"`)
      break
    }
    default:
      console.error(`Unknown command: ${command}`)
      process.exit(1)
  }
} catch (err) {
  console.error(`Error: ${err.message}`)
  process.exit(1)
}
