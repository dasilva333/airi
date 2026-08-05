import { describe, expect, it } from 'vitest'

import { interpolate } from '../src/dsl/template'
import { ReactiveVarStore } from '../src/dsl/var-store'

function makeCtx() {
  const vars = new ReactiveVarStore()
  vars.set('IntimacyVI', 5)
  vars.set('OpenChat', 1)
  vars.set('InENV', 3)
  return { vars, intimacy: 6500, now: 1700000000000 }
}

describe('interpolate — template tags', () => {
  it('interpolates {$vi_*} heap reads', () => {
    expect(interpolate('闲聊开关: {$vi_OpenChat}', makeCtx())).toBe('闲聊开关: 1')
  })

  it('interpolates {$vf_*} heap reads (debug text)', () => {
    expect(interpolate('InENV: {$vf_InENV}', makeCtx())).toBe('InENV: 3')
  })

  it('{$vi_} and {$vf_} read the same variable', () => {
    expect(interpolate('{$vi_IntimacyVI}|{$vf_IntimacyVI}', makeCtx())).toBe('5|5')
  })

  it('interpolates {$intimacy}', () => {
    expect(interpolate('当前好感度: {$intimacy}', makeCtx())).toBe('当前好感度: 6500')
  })

  it('interpolates {$timenow}', () => {
    expect(interpolate('timenow: {$timenow}', makeCtx())).toBe('timenow: 1700000000000')
  })

  it('{$timenow} renders empty when no clock provided', () => {
    const ctx = { vars: new ReactiveVarStore(), intimacy: 0 } // no `now`
    expect(interpolate('[{$timenow}]', ctx)).toBe('[]')
  })

  it('interpolates {$br} as a newline', () => {
    expect(interpolate('菜单{$br}好感度: {$vi_IntimacyVI}', makeCtx())).toBe('菜单\n好感度: 5')
  })

  it('toBe the full debug dump from the menu entry', () => {
    const r = interpolate('菜单{$br}好感度: {$vi_IntimacyVI}', makeCtx())
    expect(r.split('\n')).toHaveLength(2)
  })

  it('absent variables render as 0', () => {
    expect(interpolate('{$vi_MissingVar}', makeCtx())).toBe('0')
  })

  it('unknown tags are left verbatim', () => {
    expect(interpolate('hello {$unknown_tag} world', makeCtx())).toBe('hello {$unknown_tag} world')
    expect(interpolate('{$vi_}', makeCtx())).toBe('0') // empty name -> get('') -> 0
  })

  it('interpolates multiple tags in one string', () => {
    expect(
      interpolate('[{$vi_IntimacyVI}] {$timenow} {$intimacy}', makeCtx()),
    ).toBe('[5] 1700000000000 6500')
  })
})
