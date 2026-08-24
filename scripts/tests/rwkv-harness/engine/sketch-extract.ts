/**
 * Phase 7 sketch extraction: turn raw RWKV output into a runnable p5 sketch.
 * Shared by the live experiment and offline re-render tooling.
 */

/** Prefer fenced code blocks, then fall back to a `function setup` tail slice. */
export function extractSketch(raw: string): string | null {
  const candidates: string[] = []
  for (const m of raw.matchAll(/```[\w-]*\s*([\s\S]*?)```/g))
    candidates.push(m[1])
  // Unterminated fence (output truncated by the token budget): take the tail.
  const open = raw.lastIndexOf('```')
  if (open >= 0 && !raw.slice(open + 3).includes('```'))
    candidates.push(raw.slice(open + 3).replace(/^[\w-]*\n/, ''))
  const idx = raw.indexOf('function setup')
  if (idx >= 0)
    candidates.push(raw.slice(idx))
  if (raw.includes('createCanvas'))
    candidates.push(raw)

  for (const c of candidates) {
    const repaired = repairTruncatedProgram(c.trim())
    if (repaired)
      return repaired
  }
  return null
}

/**
 * Make a (possibly token-budget-truncated) program runnable:
 *  - cut at the last clean statement boundary (newline with balanced parens,
 *    outside strings/comments), dropping any partial trailing call like
 *    `brush.fill(`;
 *  - auto-close unclosed braces so truncated painting bodies still execute.
 * The old balance-clip kept only brace-balanced prefixes, which silently threw
 * away the truncated draw/paint body (attempt-1 finding, 2026-08-24).
 */
export function repairTruncatedProgram(code: string): string | null {
  if (!code)
    return null
  let lastClean = 0
  {
    let paren = 0
    let inStr: string | null = null
    for (let i = 0; i < code.length; i++) {
      const ch = code[i]
      if (inStr) {
        if (ch === '\\') { i++; continue }
        if (ch === inStr)
          inStr = null
        continue
      }
      if (ch === '"' || ch === '\'' || ch === '`') { inStr = ch; continue }
      if (ch === '/' && code[i + 1] === '/') {
        const nl = code.indexOf('\n', i)
        if (nl < 0)
          break
        i = nl
        continue
      }
      if (ch === '/' && code[i + 1] === '*') {
        const end = code.indexOf('*/', i + 2)
        if (end < 0)
          break
        i = end + 1
        continue
      }
      if (ch === '(' || ch === '[')
        paren++
      else if (ch === ')' || ch === ']')
        paren = Math.max(0, paren - 1)
      if (ch === '\n' && paren === 0)
        lastClean = i
    }
  }

  const body = code.slice(0, lastClean > 0 ? lastClean : code.length)
  if (!/createCanvas\s*\(/.test(body) || !/\bsetup\b|\bdraw\b/.test(body))
    return null

  // Recompute brace depth of the kept body (string/comment aware) and close it.
  let depth = 0
  let inStr: string | null = null
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (inStr) {
      if (ch === '\\') { i++; continue }
      if (ch === inStr)
        inStr = null
      continue
    }
    if (ch === '"' || ch === '\'' || ch === '`') { inStr = ch; continue }
    if (ch === '/' && body[i + 1] === '/') {
      const nl = body.indexOf('\n', i)
      if (nl < 0)
        break
      i = nl
      continue
    }
    if (ch === '{')
      depth++
    else if (ch === '}')
      depth = Math.max(0, depth - 1)
  }
  return `${body.trimEnd()}\n${'}'.repeat(depth)}`
}
