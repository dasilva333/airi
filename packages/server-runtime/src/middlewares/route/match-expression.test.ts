import type { RouteTargetExpression } from '@proj-airi/server-shared/types'

import type { AuthenticatedPeer } from '../../types'

import { describe, expect, it } from 'vitest'

import { matchesDestination, matchesDestinations, matchesLabelSelector, matchesLabelSelectors, matchesRouteExpression } from './match-expression'

function peer(overrides: Partial<AuthenticatedPeer> = {}): AuthenticatedPeer {
  return {
    name: 'mod',
    index: 0,
    peer: { id: 'p1', send: () => 0 } as unknown as AuthenticatedPeer['peer'],
    authenticated: true,
    identity: { id: 'inst1', plugin: { id: 'plug', labels: { devtools: 'true' } }, labels: { foo: 'bar' } } as unknown as AuthenticatedPeer['identity'],
    ...overrides,
  } as AuthenticatedPeer
}

describe('match-expression comprehensive', () => {
  it('label selector', () => {
    expect(matchesLabelSelector('foo', { foo: 'bar' })).toBe(true)
    expect(matchesLabelSelector('foo=bar', { foo: 'bar' })).toBe(true)
    expect(matchesLabelSelector('foo=baz', { foo: 'bar' })).toBe(false)
    expect(matchesLabelSelector('', { foo: 'bar' })).toBe(false)
  })
  it('label selectors every', () => {
    expect(matchesLabelSelectors(['foo=bar'], { foo: 'bar' })).toBe(true)
  })
  it('route expressions', () => {
    const p = peer()
    const andExpr = { type: 'and', all: [{ type: 'module', modules: ['mod'] }] } as unknown as RouteTargetExpression
    const orExpr = { type: 'or', any: [{ type: 'module', modules: ['x'] }] } as unknown as RouteTargetExpression
    const globExpr = { type: 'glob', glob: 'm*' } as unknown as RouteTargetExpression
    const globInv = { type: 'glob', glob: 'x*', inverted: true } as unknown as RouteTargetExpression
    const idsInv = { type: 'ids', ids: ['p1'], inverted: true } as unknown as RouteTargetExpression
    const pluginExpr = { type: 'plugin', plugins: ['plug'] } as unknown as RouteTargetExpression
    const instanceExpr = { type: 'instance', instances: ['inst1'] } as unknown as RouteTargetExpression
    const labelExpr = { type: 'label', selectors: ['foo=bar'] } as unknown as RouteTargetExpression
    const moduleExpr = { type: 'module', modules: ['mod'] } as unknown as RouteTargetExpression
    const sourceExpr = { type: 'source', sources: ['mod'] } as unknown as RouteTargetExpression
    expect(matchesRouteExpression(andExpr, p)).toBe(true)
    expect(matchesRouteExpression(orExpr, p)).toBe(false)
    expect(matchesRouteExpression(globExpr, p)).toBe(true)
    expect(matchesRouteExpression(globInv, p)).toBe(true)
    expect(matchesRouteExpression(idsInv, p)).toBe(false)
    expect(matchesRouteExpression(pluginExpr, p)).toBe(true)
    expect(matchesRouteExpression(instanceExpr, p)).toBe(true)
    expect(matchesRouteExpression(labelExpr, p)).toBe(true)
    expect(matchesRouteExpression(moduleExpr, p)).toBe(true)
    expect(matchesRouteExpression(sourceExpr, p)).toBe(true)
    expect(matchesRouteExpression({ type: 'unknown' } as unknown as RouteTargetExpression, p)).toBe(false)
  })
  it('destinations', () => {
    const p = peer()
    expect(matchesDestination('*', p)).toBe(true)
    expect(matchesDestination('plugin:plug', p)).toBe(true)
    expect(matchesDestination('instance:inst1', p)).toBe(true)
    expect(matchesDestination('label:foo=bar', p)).toBe(true)
    expect(matchesDestination('peer:p1', p)).toBe(true)
    expect(matchesDestination('module:mod', p)).toBe(true)
    expect(matchesDestination('source:mod', p)).toBe(true)
    // 'glob:mod' not a special prefix, may be false; skip
    expect(matchesDestinations(['module:mod'], p)).toBe(true)
    const expr = { type: 'module', modules: ['mod'] } as unknown as RouteTargetExpression
    expect(matchesDestination(expr, p)).toBe(true)
  })
  it('prefixed destinations with colon-containing values', () => {
    const p = peer({ name: 'x:y', identity: { id: 'inst1', plugin: { id: 'proj-airi:stage-tamagotchi', labels: { devtools: 'true' } }, labels: { foo: 'bar' } } as unknown as AuthenticatedPeer['identity'] })
    // plugin:<id> with colon-containing id
    expect(matchesDestination('plugin:proj-airi:stage-tamagotchi', p)).toBe(true)
    expect(matchesDestination('plugin:proj-airi:stage-web', p)).toBe(false)
    // module:<name> with colon-containing name
    expect(matchesDestination('module:x:y', p)).toBe(true)
    // label: destinations unaffected
    expect(matchesDestination('label:foo=bar', p)).toBe(true)
    // colon-less prefixed destinations still work
    expect(matchesDestination('plugin:plug', peer())).toBe(true)
    // plain colon-less destination behavior unchanged
    expect(matchesDestination('mod*', peer())).toBe(true)
  })
})
