import type {
  RouteTargetExpression,
  WebSocketBaseEvent,
  WebSocketEventOf,
  WebSocketEvents,
} from '@proj-airi/server-shared/types'
import { describe, expect, it } from 'vitest'
import type { AuthenticatedPeer } from '../types'

import { collectDestinations, createPolicyMiddleware, isDevtoolsPeer, matchesDestinations } from './route'
import { matchesLabelSelector, matchesLabelSelectors, matchesRouteExpression } from './route/match-expression'

function createPeer(options: {
  id: string
  name: string
  plugin?: string
  instanceId?: string
  labels?: Record<string, string>
}): AuthenticatedPeer {
  return {
    authenticated: true,
    identity:
      options.plugin && options.instanceId
        ? { id: options.instanceId, kind: 'plugin', labels: options.labels, plugin: { id: options.plugin } }
        : undefined,
    name: options.name,
    peer: { id: options.id, send: () => 0 },
  }
}

function createSparkNotifyEvent(
  overrides: Partial<WebSocketEventOf<'spark:notify'>> = {},
): WebSocketBaseEvent<'spark:notify', WebSocketEvents['spark:notify'], any> {
  const data: WebSocketEvents['spark:notify'] = {
    destinations: ['module:character'],
    eventId: 'spark-1',
    headline: 'hello',
    id: 'evt-1',
    kind: 'ping',
    urgency: 'soon',
    ...overrides.data,
  }

  return {
    data,
    metadata: overrides.metadata ?? {
      event: { id: data.id },
      source: { id: 'test', kind: 'plugin', plugin: { id: 'server-runtime' } },
    },
    route: overrides.route,
    type: 'spark:notify',
  } as WebSocketBaseEvent<'spark:notify', WebSocketEvents['spark:notify'], any>
}

describe('match-expression', () => {
  it('matches label selectors', () => {
    expect(matchesLabelSelector('env=prod', { env: 'prod' })).toBe(true)
    expect(matchesLabelSelector('env=prod', { env: 'dev' })).toBe(false)
    expect(matchesLabelSelector('feature', { feature: 'on' })).toBe(true)
    expect(matchesLabelSelector('missing', { env: 'prod' })).toBe(false)
  })

  it('matches label selector list', () => {
    expect(matchesLabelSelectors(['env=prod', 'tier=backend'], { env: 'prod', tier: 'backend' })).toBe(true)
    expect(matchesLabelSelectors(['env=prod', 'tier=backend'], { env: 'prod', tier: 'frontend' })).toBe(false)
  })

  it('matches route expressions', () => {
    const peer = createPeer({
      id: 'peer-1',
      instanceId: 'stage-ui-1',
      labels: { env: 'prod' },
      name: 'stage-ui',
      plugin: 'stage-ui',
    })

    const expression: RouteTargetExpression = { selectors: ['env=prod'], type: 'label' }
    expect(matchesRouteExpression(expression, peer)).toBe(true)

    const globExpression: RouteTargetExpression = { glob: 'stage-*', type: 'glob' }
    expect(matchesRouteExpression(globExpression, peer)).toBe(true)
  })
})

describe('route middleware', () => {
  it('collects destinations from route before data', () => {
    const event = createSparkNotifyEvent({
      data: {
        destinations: ['module:character'],
        eventId: 'spark-2',
        headline: 'hello',
        id: 'evt-2',
        kind: 'ping',
        urgency: 'soon',
      },
      route: { destinations: ['label:env=prod'] },
    })

    expect(collectDestinations(event)).toEqual(['label:env=prod'])
  })
  it('respects explicit empty destinations as an override', () => {
    const event = createSparkNotifyEvent({
      data: {
        destinations: ['module:character'],
        eventId: 'spark-3',
        headline: 'hello',
        id: 'evt-3',
        kind: 'ping',
        urgency: 'soon',
      },
      route: { destinations: [] },
    })

    expect(collectDestinations(event)).toEqual([])
  })

  it('treats an explicit empty route destination list as the override', () => {
    const event = createSparkNotifyEvent({
      data: {
        destinations: ['module:character'],
        eventId: 'spark-override',
        headline: 'hello',
        id: 'evt-override',
        kind: 'ping',
        urgency: 'soon',
      },
      route: { destinations: [] },
    })

    expect(collectDestinations(event)).toEqual([])
  })

  it('matches destinations by label selector', () => {
    const peer = createPeer({
      id: 'peer-2',
      instanceId: 'telegram-1',
      labels: { app: 'telegram', env: 'prod' },
      name: 'telegram-bot',
      plugin: 'telegram-bot',
    })

    expect(matchesDestinations(['label:app=telegram'], peer)).toBe(true)
    expect(matchesDestinations(['label:env=dev'], peer)).toBe(false)
  })

  it('policy middleware filters targets', () => {
    const peers = new Map<string, AuthenticatedPeer>([
      [
        'peer-1',
        createPeer({
          id: 'peer-1',
          instanceId: 'telegram-1',
          labels: { env: 'prod' },
          name: 'telegram',
          plugin: 'telegram-bot',
        }),
      ],
      [
        'peer-2',
        createPeer({
          id: 'peer-2',
          instanceId: 'stage-ui-1',
          labels: { env: 'dev' },
          name: 'stage-ui',
          plugin: 'stage-ui',
        }),
      ],
    ])

    const policy = createPolicyMiddleware({ allowLabels: ['env=prod'] })
    const decision = policy({
      destinations: undefined,
      event: createSparkNotifyEvent(),
      fromPeer: peers.get('peer-1')!,
      peers,
    })

    expect(decision).toBeDefined()
    if (!decision) return

    expect(decision?.type).toBe('targets')
    if (decision.type !== 'targets') return

    expect([...decision!.targetIds]).toEqual(['peer-1'])
  })

  it('devtools peer detection uses label', () => {
    const peer = createPeer({
      id: 'peer-3',
      instanceId: 'debug-ui-1',
      labels: { devtools: 'true' },
      name: 'debug-ui',
      plugin: 'debug-ui',
    })

    expect(isDevtoolsPeer(peer)).toBe(true)
  })
})
