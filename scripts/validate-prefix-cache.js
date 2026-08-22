#!/usr/bin/env node

/**
 * Script: validate-prefix-cache.js
 * Purpose: Compare two LLM payload requests (e.g. Turn N vs Turn N+1, or Chat Turn vs Producer/Heartbeat Turn)
 *          to calculate the exact prefix cache overlap ratio and locate divergence points.
 *
 * Usage:
 *   node scripts/validate-prefix-cache.js [fileA] [fileB]
 */

import fs from 'node:fs'

function estimateTokens(input) {
  if (!input)
    return 0
  const len = typeof input === 'number' ? input : input.length
  return Math.ceil(len / 3.8)
}

function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    return JSON.parse(raw)
  }
  catch (err) {
    console.error(`❌ Failed to parse JSON from: ${filePath}\n   ${err.message}`)
    process.exit(1)
  }
}

function extractMessageText(msg) {
  if (!msg)
    return ''
  if (typeof msg.content === 'string')
    return msg.content
  if (Array.isArray(msg.content)) {
    return msg.content.map(p => typeof p === 'string' ? p : p?.text || '').join('')
  }
  return ''
}

function main() {
  const args = process.argv.slice(2)
  const defaultA = '/Users/richardpinedo/Projects.nosync/airi/personal_airi/logs.txt'
  const defaultB = '/Users/richardpinedo/Projects.nosync/airi/personal_airi/suggestions_round.json'

  const fileA = args[0] || defaultA
  const fileB = args[1] || defaultB

  console.log('\n======================================================')
  console.log('🔍 AIRI LLM Prefix-Cache Alignment Validator')
  console.log('======================================================')
  console.log(`📄 Payload A: ${fileA}`)
  console.log(`📄 Payload B: ${fileB}\n`)

  if (!fs.existsSync(fileA)) {
    console.error(`❌ File A does not exist: ${fileA}`)
    process.exit(1)
  }
  if (!fs.existsSync(fileB)) {
    console.error(`❌ File B does not exist: ${fileB}`)
    process.exit(1)
  }

  const payloadA = loadJson(fileA)
  const payloadB = loadJson(fileB)

  const messagesA = Array.isArray(payloadA) ? payloadA : (payloadA.messages || [])
  const messagesB = Array.isArray(payloadB) ? payloadB : (payloadB.messages || [])

  console.log(`📊 Total Messages: Payload A = ${messagesA.length} | Payload B = ${messagesB.length}`)

  // 1. Strict Leading Prefix Overlap
  let commonPrefixIndex = 0
  let strictMatchedChars = 0
  const maxLen = Math.min(messagesA.length, messagesB.length)

  for (let i = 0; i < maxLen; i++) {
    const msgA = messagesA[i]
    const msgB = messagesB[i]

    if (msgA.role !== msgB.role) {
      break
    }

    const textA = extractMessageText(msgA)
    const textB = extractMessageText(msgB)

    if (textA === textB) {
      commonPrefixIndex++
      strictMatchedChars += textA.length
    }
    else {
      let commonLen = 0
      const minTextLen = Math.min(textA.length, textB.length)
      while (commonLen < minTextLen && textA[commonLen] === textB[commonLen]) {
        commonLen++
      }
      if (commonLen > 0) {
        strictMatchedChars += commonLen
      }
      break
    }
  }

  // 2. Deep Sectional & Dialogue History Overlap
  let identicalHistoryCount = 0
  let matchedHistoryChars = 0

  // Check how many turns in the conversation history match exactly
  for (let i = 2; i < maxLen - 2; i++) {
    const msgA = messagesA[i]
    const msgB = messagesB[i]
    if (msgA && msgB && msgA.role === msgB.role && extractMessageText(msgA) === extractMessageText(msgB)) {
      identicalHistoryCount++
      matchedHistoryChars += extractMessageText(msgA).length
    }
  }

  const totalCharsA = messagesA.reduce((sum, m) => sum + extractMessageText(m).length, 0)
  const totalCharsB = messagesB.reduce((sum, m) => sum + extractMessageText(m).length, 0)

  const tokensA = estimateTokens(messagesA.map(extractMessageText).join(''))
  const tokensB = estimateTokens(messagesB.map(extractMessageText).join(''))

  const msg0A = extractMessageText(messagesA[0])
  const msg0B = extractMessageText(messagesB[0])

  let msg0CommonChars = 0
  const min0 = Math.min(msg0A.length, msg0B.length)
  while (msg0CommonChars < min0 && msg0A[msg0CommonChars] === msg0B[msg0CommonChars]) {
    msg0CommonChars++
  }

  console.log('\n------------------------------------------------------')
  console.log('📈 Layer-by-Layer Prefix Alignment Breakdown')
  console.log('------------------------------------------------------')

  console.log(`1. SYSTEM / PERSONA PROMPT (Message [0]):`)
  console.log(`   - Payload A Length: ${msg0A.length.toLocaleString()} chars (~${estimateTokens(msg0A)} tokens)`)
  console.log(`   - Payload B Length: ${msg0B.length.toLocaleString()} chars (~${estimateTokens(msg0B)} tokens)`)
  console.log(`   - Shared Persona Prefix: ${msg0CommonChars.toLocaleString()} chars (~${estimateTokens(msg0CommonChars)} tokens) [${((msg0CommonChars / Math.max(msg0A.length, msg0B.length)) * 100).toFixed(1)}% Identical]`)

  if (msg0A.length !== msg0B.length) {
    const extra = msg0A.length > msg0B.length ? 'Payload A' : 'Payload B'
    const extraText = msg0A.length > msg0B.length ? msg0A.slice(msg0CommonChars) : msg0B.slice(msg0CommonChars)
    const firstLine = extraText.trim().split('\n')[0]
    console.log(`   ℹ️  Divergence in Message [0]: ${extra} appended extra section: "${firstLine.slice(0, 60)}..."`)
  }

  console.log(`\n2. CONVERSATION HISTORY TURNS:`)
  console.log(`   - Identical Dialogue Turns: ${identicalHistoryCount} turns aligned`)
  console.log(`   - Shared Dialogue Text:     ${matchedHistoryChars.toLocaleString()} chars (~${estimateTokens(matchedHistoryChars).toLocaleString()} tokens)`)

  console.log(`\n3. VOLATILE CONTEXT / SENSORS / TAIL:`)
  const tailA = messagesA[messagesA.length - 1]
  const tailB = messagesB[messagesB.length - 1]
  console.log(`   - Payload A Tail: [${tailA?.role}] "${extractMessageText(tailA).slice(0, 60).replace(/\n+/g, ' ')}..."`)
  console.log(`   - Payload B Tail: [${tailB?.role}] "${extractMessageText(tailB).slice(0, 60).replace(/\n+/g, ' ')}..."`)

  const effectiveShared = msg0CommonChars + matchedHistoryChars
  const effectiveRatio = ((effectiveShared / Math.max(totalCharsA, totalCharsB)) * 100).toFixed(2)

  console.log('\n------------------------------------------------------')
  console.log('🎯 Efficiency Summary')
  console.log('------------------------------------------------------')
  console.log(`⚡ Shared Content Volume:    ${effectiveShared.toLocaleString()} / ${Math.max(totalCharsA, totalCharsB).toLocaleString()} chars (~${estimateTokens(effectiveShared).toLocaleString()} tokens)`)
  console.log(`🚀 Effective Context Reuse:   ${effectiveRatio}%`)

  if (Number.parseFloat(effectiveRatio) >= 70) {
    console.log('\n🏆 VERDICT: EXCELLENT CONTEXT RETENTION & PREFIX COMPLIANCE')
    console.log('   The conversation history and core persona are preserved with high fidelity.')
  }
  else {
    console.log('\n👍 VERDICT: PARTIAL PREFIX ALIGNMENT')
  }
  console.log('======================================================\n')
}

main()
