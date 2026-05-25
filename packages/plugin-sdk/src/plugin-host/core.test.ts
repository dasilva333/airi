import { join } from 'node:path'

import { createContext, defineEventa, defineInvoke, defineInvokeHandler } from '@moeru/eventa'
import { moduleCompatibilityResult, moduleStatus, registryModulesSync } from '@proj-airi/plugin-protocol/types'
import { describe, expect, it, vi } from 'vitest'
import { createApis } from '../plugin/apis/client'
import { protocolCapabilityWait, protocolProviders } from '../plugin/apis/protocol'
import { FileSystemLoader, PluginHost } from '.'

function reportPluginCapability(
  host: PluginHost,
  payload: { key: string; state: 'announced' | 'ready'; metadata?: Record<string, unknown> },
) {
  if (payload.state === 'announced') {
    return host.announceCapability(payload.key, payload.metadata)
  }

  return host.markCapabilityReady(payload.key, payload.metadata)
}

describe('for FileSystemPluginHost', () => {
  it('should load test-normal-plugin from manifest', async () => {
    const host = new FileSystemLoader()

    const pluginDef = await host.loadPluginFor(
      {
        apiVersion: 'v1',
        entrypoints: {
          electron: join(import.meta.dirname, 'testdata', 'test-normal-plugin.ts'),
        },
        kind: 'manifest.plugin.airi.moeru.ai',
        name: 'test-plugin',
      },
      { cwd: '', runtime: 'electron' },
    )

    const ctx = createContext()
    const apis = createApis(ctx)
    const onVitestCall = vi.fn()
    ctx.on(defineEventa('vitest-call:init'), onVitestCall)

    await expect(pluginDef.init?.({ apis, channels: { host: ctx } })).resolves.not.toThrow()
    expect(onVitestCall).toHaveBeenCalledTimes(1)
  })

  it('should resolve runtime-specific entrypoint with node fallback', async () => {
    const host = new FileSystemLoader()

    const pluginDef = await host.loadPluginFor(
      {
        apiVersion: 'v1',
        entrypoints: {
          node: join(import.meta.dirname, 'testdata', 'test-normal-plugin.ts'),
        },
        kind: 'manifest.plugin.airi.moeru.ai',
        name: 'test-plugin',
      },
      { cwd: '', runtime: 'node' },
    )

    expect(pluginDef).toBeDefined()
    expect(typeof pluginDef.init).toBe('function')
  })

  it('should be able to handle test-error-plugin from manifest', async () => {
    const host = new FileSystemLoader()

    await expect(
      host.loadPluginFor(
        {
          apiVersion: 'v1',
          entrypoints: {
            electron: join(import.meta.dirname, 'testdata', 'test-error-plugin.ts'),
          },
          kind: 'manifest.plugin.airi.moeru.ai',
          name: 'test-plugin',
        },
        { cwd: '', runtime: 'electron' },
      ),
    ).rejects.toThrow('Test error plugin always throws an error during loading.')
  })

  it('should resolve entrypoint by runtime then default then electron', () => {
    const host = new FileSystemLoader()
    const baseManifest = {
      apiVersion: 'v1' as const,
      kind: 'manifest.plugin.airi.moeru.ai' as const,
      name: 'test-plugin',
    }

    const runtimeEntryManifest = {
      ...baseManifest,
      entrypoints: {
        default: './default-entry.ts',
        electron: './electron-entry.ts',
        node: './node-entry.ts',
      },
    }
    const defaultFallbackManifest = {
      ...baseManifest,
      entrypoints: {
        default: './default-entry.ts',
        electron: './electron-entry.ts',
      },
    }
    const electronFallbackManifest = {
      ...baseManifest,
      entrypoints: {
        electron: './electron-entry.ts',
      },
    }

    expect(
      host.resolveEntrypointFor(runtimeEntryManifest, {
        cwd: '/tmp/plugin',
        runtime: 'node',
      }),
    ).toBe('/tmp/plugin/node-entry.ts')

    expect(
      host.resolveEntrypointFor(defaultFallbackManifest, {
        cwd: '/tmp/plugin',
        runtime: 'node',
      }),
    ).toBe('/tmp/plugin/default-entry.ts')

    expect(
      host.resolveEntrypointFor(electronFallbackManifest, {
        cwd: '/tmp/plugin',
        runtime: 'node',
      }),
    ).toBe('/tmp/plugin/electron-entry.ts')
  })

  it('should preserve absolute runtime entrypoints', () => {
    const host = new FileSystemLoader()

    expect(
      host.resolveEntrypointFor(
        {
          apiVersion: 'v1',
          entrypoints: {
            node: '/opt/plugins/entry.ts',
          },
          kind: 'manifest.plugin.airi.moeru.ai',
          name: 'test-plugin',
        },
        {
          cwd: '/tmp/plugin',
          runtime: 'node',
        },
      ),
    ).toBe('/opt/plugins/entry.ts')
  })

  it('should throw deterministic error when no runtime entrypoint exists', () => {
    const host = new FileSystemLoader()

    expect(() =>
      host.resolveEntrypointFor(
        {
          apiVersion: 'v1',
          entrypoints: {},
          kind: 'manifest.plugin.airi.moeru.ai',
          name: 'test-plugin',
        },
        { runtime: 'node' },
      ),
    ).toThrow('Plugin entrypoint is required for runtime `node`.')
  })
})

describe('for PluginHost', () => {
  const providersCapability = 'proj-airi:plugin-sdk:apis:protocol:resources:providers:list-providers'
  const testManifest = {
    apiVersion: 'v1' as const,
    entrypoints: {
      electron: join(import.meta.dirname, 'testdata', 'test-normal-plugin.ts'),
    },
    kind: 'manifest.plugin.airi.moeru.ai' as const,
    name: 'test-plugin',
  }

  it('should run plugin lifecycle to ready in-memory', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })
    reportPluginCapability(host, {
      key: providersCapability,
      metadata: { source: 'test' },
      state: 'ready',
    })

    const session = await host.start(testManifest, { cwd: '' })

    await host.markConfigurationNeeded(session.id, 'manual-check')

    expect(session.phase).toBe('configuration-needed')

    await host.applyConfiguration(session.id, {
      configId: `${session.identity.id}:manual`,
      full: { mode: 'manual' },
      revision: 2,
      schemaVersion: 1,
    })

    expect(session.phase).toBe('configured')

    const stopped = host.stop(session.id)
    expect(stopped?.phase).toBe('stopped')
    expect(host.getSession(session.id)).toBeUndefined()
  })

  it('should fail initialization when plugin init returns false', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })

    const session = await host.load(
      {
        apiVersion: 'v1',
        entrypoints: {
          electron: join(import.meta.dirname, 'testdata', 'test-no-connect-plugin.ts'),
        },
        kind: 'manifest.plugin.airi.moeru.ai',
        name: 'test-plugin-no-connect',
      },
      { cwd: '' },
    )

    await expect(host.init(session.id)).rejects.toThrow(
      'Plugin initialization aborted by plugin: test-plugin-no-connect',
    )

    const latest = host.getSession(session.id)
    expect(latest?.phase).toBe('failed')
  })

  it('should reject non in-memory transport for MVP', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'websocket', url: 'ws://localhost:3000' },
    })

    await expect(host.start(testManifest, { cwd: '' })).rejects.toThrow(
      'Only in-memory transport is currently supported by PluginHost alpha.',
    )
  })

  it('should be able to expose setupModules', async () => {
    const loader = new FileSystemLoader()

    const pluginDef = await loader.loadPluginFor(
      {
        apiVersion: 'v1',
        entrypoints: {
          electron: join(import.meta.dirname, 'testdata', 'test-normal-plugin.ts'),
        },
        kind: 'manifest.plugin.airi.moeru.ai',
        name: 'test-plugin',
      },
      { cwd: '' },
    )

    const ctx = createContext()
    const apis = createApis(ctx)
    const onVitestCall = vi.fn()
    ctx.on(defineEventa('vitest-call:init'), onVitestCall)

    await expect(pluginDef.init?.({ apis, channels: { host: ctx } })).resolves.not.toThrow()
    expect(onVitestCall).toHaveBeenCalledTimes(1)

    defineInvokeHandler(ctx, protocolProviders.listProviders, async () => {
      return [{ name: 'provider1' }]
    })
    defineInvokeHandler(ctx, protocolCapabilityWait, async () => {
      return {
        key: 'proj-airi:plugin-sdk:apis:protocol:resources:providers:list-providers',
        state: 'ready',
        updatedAt: Date.now(),
      }
    })

    const onProviderListCall = vi.fn()
    ctx.on(protocolProviders.listProviders.sendEvent, onProviderListCall)
    await expect(pluginDef.setupModules?.({ apis, channels: { host: ctx } })).resolves.not.toThrow()
    expect(onProviderListCall).toHaveBeenCalledTimes(1)
  })

  it('should wait for required capabilities before proceeding init', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })
    reportPluginCapability(host, {
      key: providersCapability,
      metadata: { source: 'test' },
      state: 'ready',
    })

    const started = host.start(testManifest, {
      capabilityWaitTimeoutMs: 2000,
      cwd: '',
      requiredCapabilities: ['cap:providers:list'],
    })

    await new Promise((resolve) => setTimeout(resolve, 20))
    const loadingSession = host.listSessions().find((item) => item.manifest.name === testManifest.name)
    expect(loadingSession?.phase).toBe('waiting-deps')

    reportPluginCapability(host, {
      key: 'cap:providers:list',
      metadata: { source: 'test' },
      state: 'ready',
    })
    const session = await started
    expect(session.phase).toBe('ready')
  })

  it('should emit dependency wait details while waiting for required capabilities', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })

    const session = await host.load(testManifest, { cwd: '' })
    const statusEvents: Array<{ body?: Record<string, unknown> }> = []
    session.channels.host.on(moduleStatus, (payload) => {
      statusEvents.push(payload as unknown as { body?: Record<string, unknown> })
    })

    const started = host.init(session.id, {
      capabilityWaitTimeoutMs: 2000,
      requiredCapabilities: ['cap:custom'],
    })

    await new Promise((resolve) => setTimeout(resolve, 20))

    const waitingStatus = statusEvents.find((event) => {
      const body = event.body
      return (
        body?.phase === 'preparing' &&
        typeof body.reason === 'string' &&
        body.reason.includes('Waiting for capabilities:')
      )
    })

    expect(waitingStatus).toBeDefined()
    expect(waitingStatus?.body).toMatchObject({
      details: {
        lifecyclePhase: 'waiting-deps',
        requiredCapabilities: ['cap:custom'],
        timeoutMs: 2000,
        unresolvedCapabilities: ['cap:custom'],
      },
      phase: 'preparing',
    })

    reportPluginCapability(host, {
      key: 'cap:custom',
      metadata: { source: 'test' },
      state: 'ready',
    })
    const initialized = await started
    expect(initialized.phase).toBe('ready')
  })

  it('should fail when required capabilities timeout', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })

    await expect(
      host.start(testManifest, {
        capabilityWaitTimeoutMs: 10,
        cwd: '',
        requiredCapabilities: ['cap:missing'],
      }),
    ).rejects.toThrow('Capability `cap:missing` is not ready after 10ms.')
  })

  it('should support degraded and withdrawn capability states', () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })

    const announced = host.announceCapability('cap:dynamic', { source: 'announce' })
    expect(announced).toMatchObject({
      key: 'cap:dynamic',
      metadata: { source: 'announce' },
      state: 'announced',
    })

    const degraded = host.markCapabilityDegraded('cap:dynamic', { reason: 'upstream-degraded' })
    expect(degraded).toMatchObject({
      key: 'cap:dynamic',
      metadata: { reason: 'upstream-degraded' },
      state: 'degraded',
    })
    expect(host.isCapabilityReady('cap:dynamic')).toBe(false)

    const withdrawn = host.withdrawCapability('cap:dynamic', { reason: 'disabled' })
    expect(withdrawn).toMatchObject({
      key: 'cap:dynamic',
      metadata: { reason: 'disabled' },
      state: 'withdrawn',
    })
    expect(host.isCapabilityReady('cap:dynamic')).toBe(false)
    expect(host.listCapabilities()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'cap:dynamic',
          state: 'withdrawn',
        }),
      ]),
    )
  })

  it('should resolve waits only when capability reaches ready state', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })

    host.markCapabilityDegraded('cap:unstable', { reason: 'booting' })
    const waiting = host.waitForCapability('cap:unstable', 2000)

    await new Promise((resolve) => setTimeout(resolve, 20))
    host.withdrawCapability('cap:unstable', { reason: 'restarting' })

    await new Promise((resolve) => setTimeout(resolve, 20))
    host.markCapabilityReady('cap:unstable', { source: 'recovered' })

    const resolved = await waiting
    expect(resolved).toMatchObject({
      key: 'cap:unstable',
      metadata: { source: 'recovered' },
      state: 'ready',
    })
  })

  it('should preserve previous cwd when reloading plugin', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })
    reportPluginCapability(host, {
      key: providersCapability,
      metadata: { source: 'test' },
      state: 'ready',
    })

    const session = await host.start(
      {
        apiVersion: 'v1',
        entrypoints: {
          electron: './test-normal-plugin.ts',
        },
        kind: 'manifest.plugin.airi.moeru.ai',
        name: 'test-reload-relative-entrypoint',
      },
      { cwd: join(import.meta.dirname, 'testdata') },
    )

    const reloaded = await host.reload(session.id)
    expect(reloaded.phase).toBe('ready')
  })

  it('should emit downgraded compatibility result when fallback versions overlap', async () => {
    const host = new PluginHost({
      apiVersion: 'v2',
      protocolVersion: 'v2',
      runtime: 'electron',
      supportedApiVersions: ['v1'],
      supportedProtocolVersions: ['v1'],
      transport: { kind: 'in-memory' },
    })
    reportPluginCapability(host, {
      key: providersCapability,
      metadata: { source: 'test' },
      state: 'ready',
    })

    const session = await host.load(testManifest, { cwd: '' })
    const compatibilityEvents: Array<{ body?: Record<string, unknown> }> = []
    session.channels.host.on(moduleCompatibilityResult, (payload) => {
      compatibilityEvents.push(payload as unknown as { body?: Record<string, unknown> })
    })

    const initialized = await host.init(session.id, {
      compatibility: {
        supportedApiVersions: ['v1'],
        supportedProtocolVersions: ['v1'],
      },
    })

    expect(initialized.phase).toBe('ready')
    expect(compatibilityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: expect.objectContaining({
            apiVersion: 'v1',
            mode: 'downgraded',
            protocolVersion: 'v1',
          }),
        }),
      ]),
    )
  })

  it('should trim whitespace in supported compatibility versions before negotiating', async () => {
    const host = new PluginHost({
      apiVersion: 'v2',
      protocolVersion: 'v2',
      runtime: 'electron',
      supportedApiVersions: [' v1 '],
      supportedProtocolVersions: [' v1 '],
      transport: { kind: 'in-memory' },
    })
    reportPluginCapability(host, {
      key: providersCapability,
      metadata: { source: 'test' },
      state: 'ready',
    })

    const session = await host.load(testManifest, { cwd: '' })
    const compatibilityEvents: Array<{ body?: Record<string, unknown> }> = []
    session.channels.host.on(moduleCompatibilityResult, (payload) => {
      compatibilityEvents.push(payload as unknown as { body?: Record<string, unknown> })
    })

    const initialized = await host.init(session.id, {
      compatibility: {
        supportedApiVersions: [' v1 '],
        supportedProtocolVersions: [' v1 '],
      },
    })

    expect(initialized.phase).toBe('ready')
    expect(compatibilityEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          body: expect.objectContaining({
            apiVersion: 'v1',
            mode: 'downgraded',
            protocolVersion: 'v1',
          }),
        }),
      ]),
    )
  })

  it('should reject initialization when compatibility has no overlap', async () => {
    const host = new PluginHost({
      apiVersion: 'v2',
      protocolVersion: 'v2',
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })

    const session = await host.load(testManifest, { cwd: '' })

    await expect(
      host.init(session.id, {
        compatibility: {
          supportedApiVersions: ['v9'],
          supportedProtocolVersions: ['v9'],
        },
      }),
    ).rejects.toThrow('Negotiation rejected:')

    expect(host.getSession(session.id)?.phase).toBe('failed')
  })

  it('should isolate module status events between plugin sessions', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })
    reportPluginCapability(host, {
      key: providersCapability,
      metadata: { source: 'test' },
      state: 'ready',
    })

    const sessionOne = await host.start(
      {
        ...testManifest,
        name: 'test-plugin-session-one',
      },
      { cwd: '' },
    )
    const sessionTwo = await host.start(
      {
        ...testManifest,
        name: 'test-plugin-session-two',
      },
      { cwd: '' },
    )

    const onSessionOneStatus = vi.fn()
    const onSessionTwoStatus = vi.fn()
    sessionOne.channels.host.on(moduleStatus, onSessionOneStatus)
    sessionTwo.channels.host.on(moduleStatus, onSessionTwoStatus)

    host.markConfigurationNeeded(sessionOne.id, 'session-one-only')

    expect(onSessionOneStatus).toHaveBeenCalled()
    expect(onSessionTwoStatus).not.toHaveBeenCalled()
  })

  it('should keep invoke handlers isolated per plugin context', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })

    const sessionOne = await host.load(
      {
        ...testManifest,
        name: 'test-plugin-session-one',
      },
      { cwd: '' },
    )
    const sessionTwo = await host.load(
      {
        ...testManifest,
        name: 'test-plugin-session-two',
      },
      { cwd: '' },
    )

    defineInvokeHandler(sessionOne.channels.host, protocolProviders.listProviders, async () => [
      { name: 'provider:one' },
    ])
    defineInvokeHandler(sessionTwo.channels.host, protocolProviders.listProviders, async () => [
      { name: 'provider:two' },
    ])

    const invokeOne = defineInvoke(sessionOne.channels.host, protocolProviders.listProviders)
    const invokeTwo = defineInvoke(sessionTwo.channels.host, protocolProviders.listProviders)

    await expect(invokeOne()).resolves.toEqual([{ name: 'provider:one' }])
    await expect(invokeTwo()).resolves.toEqual([{ name: 'provider:two' }])
  })

  it('should include active modules in registry sync when initializing another session', async () => {
    const host = new PluginHost({
      runtime: 'electron',
      transport: { kind: 'in-memory' },
    })
    reportPluginCapability(host, {
      key: providersCapability,
      metadata: { source: 'test' },
      state: 'ready',
    })

    const sessionOne = await host.start(
      {
        ...testManifest,
        name: 'test-plugin-session-one',
      },
      { cwd: '' },
    )
    expect(sessionOne.phase).toBe('ready')

    const sessionTwo = await host.load(
      {
        ...testManifest,
        name: 'test-plugin-session-two',
      },
      { cwd: '' },
    )

    const syncEvents: Array<{ body?: { modules?: Array<{ name: string }> } }> = []
    sessionTwo.channels.host.on(registryModulesSync, (payload) => syncEvents.push(payload))

    const initialized = await host.init(sessionTwo.id)
    expect(initialized.phase).toBe('ready')

    const moduleNames = syncEvents.flatMap((event) => event.body?.modules ?? []).map((module) => module.name)

    expect(moduleNames).toContain('test-plugin-session-one')
    expect(moduleNames).toContain('test-plugin-session-two')
  })
})
