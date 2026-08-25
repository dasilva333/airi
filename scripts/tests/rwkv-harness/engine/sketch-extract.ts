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
 *  - auto-sanitize common raw token slips (unquoted #hex colors, brush.blend -> brush.bleed);
 *  - auto-close unclosed parens and braces so truncated painting bodies still execute.
 */
export function repairTruncatedProgram(code: string): string | null {
  if (!code)
    return null

  // 1. Sanitize common raw LLM token slips
  const sanitized = code
    // Fix unquoted #hex color tokens (e.g. brush.set("HB", #f4e8a1) -> brush.set("HB", "#f4e8a1"))
    .replace(/([,(]\s*)(#[0-9a-f]{3,8})(\s*[,)])/gi, '$1"$2"$3')
    // Fix common hallucinated method names
    .replace(/\bbrush\.blend\s*\(/g, 'brush.bleed(')
    .replace(/\bbrush\.noStroke\s*\(\s*\)/g, 'noStroke()')
    .replace(/\bbrush\.endShape\s*\(\s*CLOSE\s*\)/gi, 'brush.endShape("close")')

  let lastClean = 0
  let paren = 0
  let inStr: string | null = null

  for (let i = 0; i < sanitized.length; i++) {
    const ch = sanitized[i]
    if (inStr) {
      if (ch === '\\') { i++; continue }
      if (ch === inStr)
        inStr = null
      continue
    }
    if (ch === '"' || ch === '\'' || ch === '`') { inStr = ch; continue }
    if (ch === '/' && sanitized[i + 1] === '/') {
      const nl = sanitized.indexOf('\n', i)
      if (nl < 0)
        break
      i = nl
      continue
    }
    if (ch === '/' && sanitized[i + 1] === '*') {
      const end = sanitized.indexOf('*/', i + 2)
      if (end < 0)
        break
      i = end + 1
      continue
    }
    if (ch === '(' || ch === '[')
      paren++
    else if (ch === ')' || ch === ']')
      paren = Math.max(0, paren - 1)

    // Clean boundary: statement end with balanced parens
    if ((ch === '\n' || ch === ';') && paren === 0)
      lastClean = i + 1
  }

  const body = sanitized.slice(0, lastClean > 0 ? lastClean : sanitized.length)
  if (!/createCanvas\s*\(/.test(body) || !/\bsetup\b|\bdraw\b/.test(body))
    return null

  // Recompute brace and paren depth of the kept body (string/comment aware) and close it.
  let braceDepth = 0
  let parenDepth = 0
  inStr = null

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
    if (ch === '(')
      parenDepth++
    else if (ch === ')')
      parenDepth = Math.max(0, parenDepth - 1)
    else if (ch === '{')
      braceDepth++
    else if (ch === '}')
      braceDepth = Math.max(0, braceDepth - 1)
  }

  const closingParens = ')'.repeat(parenDepth)
  const closingBraces = '}'.repeat(braceDepth)
  return `${body.trimEnd()}${closingParens ? `${closingParens};` : ''}\n${closingBraces}`
}
