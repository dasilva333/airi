/**
 * Template compiler: interpolates dynamic tags in `Text`/choice labels before render.
 *
 * Supported tags observed in manifests:
 *   {$vi_Name}    — read variable Name from the VarFloats heap (display alias of $vf_)
 *   {$vf_Name}    — read variable Name from the VarFloats heap
 *   {$intimacy}   — persistent intimacy score
 *   {$timenow}    — current epoch ms (or formatted via the runtime clock)
 *   {$br}         — line break
 */

import type { ReactiveVarStore } from './var-store'

export interface TemplateContext {
  vars: ReactiveVarStore
  intimacy: number
  /** epoch ms, or undefined to render an empty substitution for {$timenow}. */
  now?: number
}

const TAG_RE = /\{\$([^{}]+)\}/g

/** Interpolate all `{$...}` tags in a text template. Unknown tags are left verbatim. */
export function interpolate(template: string, ctx: TemplateContext): string {
  return template.replace(TAG_RE, (whole, inner: string) => {
    const tag = inner.trim()

    if (tag === 'br')
      return '\n'
    if (tag === 'intimacy')
      return String(ctx.intimacy)
    if (tag === 'timenow')
      return ctx.now !== undefined ? String(ctx.now) : ''

    if (tag.startsWith('vi_'))
      return String(ctx.vars.get(tag.slice(3)))
    if (tag.startsWith('vf_'))
      return String(ctx.vars.get(tag.slice(3)))

    return whole
  })
}
