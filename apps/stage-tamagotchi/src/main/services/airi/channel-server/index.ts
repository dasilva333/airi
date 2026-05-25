import { randomUUID, X509Certificate } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { Socket } from 'node:net'
import { join } from 'node:path'
import { env, platform } from 'node:process'
import { useLogg } from '@guiiai/logg'
import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import type { Server } from '@proj-airi/server-runtime/server'
import { createServer, getLocalIPs } from '@proj-airi/server-runtime/server'
import { Mutex } from 'async-mutex'
import { app, ipcMain } from 'electron'
import type { Lifecycle } from 'injeca'
import { createCA, createCert } from 'mkcert'
import { x } from 'tinyexec'
import { nullable, object, optional, string } from 'valibot'
import { z } from 'zod'

import { electronApplyServerChannelConfig, electronGetServerChannelConfig } from '../../../../shared/eventa'
import { createConfig } from '../../../libs/electron/persistence'

const channelServerConfigSchema = object({
  authToken: optional(string()),
  hostname: optional(string()),
  tlsConfig: optional(
    nullable(
      object({
        cert: optional(string()),
        key: optional(string()),
        passphrase: optional(string()),
      }),
    ),
  ),
})

const channelServerInvokeConfigSchema = z
  .object({
    authToken: z.string().optional(),
    hostname: z.string().optional(),
    tlsConfig: z.object({}).nullable().optional(),
  })
  .strict()

const channelServerConfigStore = createConfig('server-channel', 'config.json', channelServerConfigSchema, {
  autoHeal: true,
  default: {
    authToken: '',
    hostname: '127.0.0.1',
    tlsConfig: null,
  },
})

function getServerChannelPort() {
  return env.SERVER_CHANNEL_PORT ? Number.parseInt(env.SERVER_CHANNEL_PORT) : 6121
}

async function getChannelServerConfig() {
  return (
    (channelServerConfigStore.get() as { hostname?: string; authToken?: string; tlsConfig?: any }) || {
      authToken: '',
      hostname: '127.0.0.1',
      tlsConfig: null,
    }
  )
}

async function normalizeChannelServerOptions(payload: unknown, fallback?: any) {
  if (!fallback) {
    fallback = await getChannelServerConfig()
  }

  const parsed = channelServerInvokeConfigSchema.safeParse(payload)
  if (!parsed.success) {
    return fallback
  }

  return {
    authToken: parsed.data.authToken ?? fallback.authToken,
    hostname: parsed.data.hostname ?? fallback.hostname,
    tlsConfig: typeof parsed.data.tlsConfig === 'undefined' ? null : parsed.data.tlsConfig,
  }
}

function getCertificateDomains(): string[] {
  const localIPs = getLocalIPs()
  const hostname = env.SERVER_RUNTIME_HOSTNAME
  return Array.from(new Set(['localhost', '127.0.0.1', '::1', ...(hostname ? [hostname] : []), ...localIPs]))
}

function certHasAllDomains(certPem: string, domains: string[]): boolean {
  try {
    const cert = new X509Certificate(certPem)
    const san = cert.subjectAltName || ''
    const entries = san.split(',').map((part) => part.trim())
    const values = entries
      .map((entry) => {
        if (entry.startsWith('DNS:')) return entry.slice(4).trim()
        if (entry.startsWith('IP Address:')) return entry.slice(11).trim()
        return ''
      })
      .filter(Boolean)

    const sanSet = new Set(values)
    return domains.every((domain) => sanSet.has(domain))
  } catch {
    return false
  }
}

async function installCACertificate(caCert: string) {
  const userDataPath = app.getPath('userData')
  const caCertPath = join(userDataPath, 'websocket-ca-cert.pem')
  writeFileSync(caCertPath, caCert)

  try {
    if (platform === 'darwin') {
      await x(
        `security`,
        ['add-trusted-cert', '-d', '-r', 'trustRoot', '-k', '/Library/Keychains/System.keychain', `"${caCertPath}"`],
        { nodeOptions: { stdio: 'ignore' } },
      )
    } else if (platform === 'win32') {
      await x(`certutil`, ['-addstore', '-f', 'Root', `"${caCertPath}"`], { nodeOptions: { stdio: 'ignore' } })
    } else if (platform === 'linux') {
      const caDir = '/usr/local/share/ca-certificates'
      const caFileName = 'airi-websocket-ca.crt'
      try {
        writeFileSync(join(caDir, caFileName), caCert)
        await x('update-ca-certificates', [], { nodeOptions: { stdio: 'ignore' } })
      } catch {
        const userCaDir = join(env.HOME || '', '.local/share/ca-certificates')
        try {
          if (!existsSync(userCaDir)) {
            await x(`mkdir`, ['-p', `"${userCaDir}"`], { nodeOptions: { stdio: 'ignore' } })
          }
          writeFileSync(join(userCaDir, caFileName), caCert)
        } catch {
          // Ignore errors
        }
      }
    }
  } catch {
    // Ignore installation errors
  }
}

async function generateCertificate() {
  const userDataPath = app.getPath('userData')
  const caCertPath = join(userDataPath, 'websocket-ca-cert.pem')
  const caKeyPath = join(userDataPath, 'websocket-ca-key.pem')

  let ca: { key: string; cert: string }

  if (existsSync(caCertPath) && existsSync(caKeyPath)) {
    ca = {
      cert: readFileSync(caCertPath, 'utf-8'),
      key: readFileSync(caKeyPath, 'utf-8'),
    }
  } else {
    ca = await createCA({
      countryCode: 'US',
      locality: 'Local',
      organization: 'AIRI',
      state: 'Development',
      validity: 365,
    })
    writeFileSync(caCertPath, ca.cert)
    writeFileSync(caKeyPath, ca.key)

    await installCACertificate(ca.cert)
  }

  const domains = getCertificateDomains()

  const cert = await createCert({
    ca: { cert: ca.cert, key: ca.key },
    domains,
    validity: 365,
  })

  return {
    cert: cert.cert,
    key: cert.key,
  }
}

async function getOrCreateCertificate() {
  const userDataPath = app.getPath('userData')
  const certPath = join(userDataPath, 'websocket-cert.pem')
  const keyPath = join(userDataPath, 'websocket-key.pem')
  const expectedDomains = getCertificateDomains()

  if (existsSync(certPath) && existsSync(keyPath)) {
    const cert = readFileSync(certPath, 'utf-8')
    const key = readFileSync(keyPath, 'utf-8')
    if (certHasAllDomains(cert, expectedDomains)) {
      return { cert, key }
    }
  }

  const { cert, key } = await generateCertificate()
  writeFileSync(certPath, cert)
  writeFileSync(keyPath, key)

  return { cert, key }
}

export async function setupServerChannel(params: { lifecycle: Lifecycle }): Promise<Server> {
  channelServerConfigStore.setup()

  const storedConfig = await getChannelServerConfig()
  console.log('[Main/ServerChannel] Loaded stored config. Token exists:', !!storedConfig.authToken)

  if (!storedConfig.authToken) {
    const newToken = randomUUID()
    console.log('[Main/ServerChannel] No authToken found. Generating new one:', newToken)
    storedConfig.authToken = newToken
    channelServerConfigStore.update(storedConfig)
    channelServerConfigStore.flush()
    console.log('[Main/ServerChannel] authToken generated and flushed.')
  } else {
    console.log('[Main/ServerChannel] Using existing authToken:', storedConfig.authToken)
  }

  const serverChannel = createServer({
    ...storedConfig,
    auth: { token: storedConfig.authToken },
    hostname: storedConfig.hostname || env.SERVER_RUNTIME_HOSTNAME || '127.0.0.1',
    port: getServerChannelPort(),
    tlsConfig: storedConfig.tlsConfig ? await getOrCreateCertificate() : null,
  })

  const mutex = new Mutex()
  let startLoopTask: Promise<void> | null = null
  let healthCheckTimer: NodeJS.Timeout | null = null

  function getRuntimePort() {
    return getServerChannelPort()
  }

  function isPortListening(port: number) {
    return new Promise<boolean>((resolve) => {
      const socket = new Socket()
      let settled = false

      const settle = (value: boolean) => {
        if (settled) return
        settled = true
        socket.destroy()
        resolve(value)
      }

      socket.once('connect', () => settle(true))
      socket.once('error', () => settle(false))
      socket.setTimeout(1500, () => settle(false))
      socket.connect(port, '127.0.0.1')
    })
  }

  async function ensureServerRunning(reason: string) {
    if (startLoopTask) return startLoopTask

    const log = useLogg('main/server-runtime').useGlobalConfig()
    startLoopTask = (async () => {
      let attempt = 0

      while (true) {
        attempt += 1
        try {
          await serverChannel.start()
          if (await isPortListening(getRuntimePort())) {
            log.withFields({ attempt, port: getRuntimePort(), reason }).log('WebSocket server confirmed ready')
            return
          }

          throw new Error(`WebSocket server was not listening on port ${getRuntimePort()} after start`)
        } catch (error) {
          const delayMs = Math.min(1000 * 2 ** (attempt - 1), 10000)
          log
            .withFields({ attempt, delayMs, port: getRuntimePort(), reason })
            .withError(error as Error)
            .error('WebSocket server start failed, retrying')
          await new Promise((resolve) => setTimeout(resolve, delayMs))
        }
      }
    })().finally(() => {
      startLoopTask = null
    })

    return startLoopTask
  }

  params.lifecycle.appHooks.onStart(async () => {
    const release = await mutex.acquire()

    const log = useLogg('main/server-runtime').useGlobalConfig()

    try {
      await ensureServerRunning('app startup')
      healthCheckTimer = setInterval(async () => {
        if (!(await isPortListening(getRuntimePort()))) {
          log.withFields({ port: getRuntimePort() }).warn('WebSocket server is down while app is running, restarting')
          await ensureServerRunning('health check')
        }
      }, 5000)
      log.log('WebSocket server started')
    } catch (error) {
      log.withError(error).error('Error starting WebSocket server')
    } finally {
      release()
    }
  })
  params.lifecycle.appHooks.onStop(async () => {
    const release = await mutex.acquire()

    const log = useLogg('main/server-runtime').useGlobalConfig()
    if (!serverChannel) {
      return
    }

    try {
      if (healthCheckTimer) {
        clearInterval(healthCheckTimer)
        healthCheckTimer = null
      }
      await serverChannel.stop()
      log.log('WebSocket server closed')
    } catch (error) {
      log.withError(error).error('Error closing WebSocket server')
    } finally {
      release()
    }
  })

  return {
    getConnectionHost() {
      return serverChannel.getConnectionHost()
    },
    async restart() {
      const release = await mutex.acquire()
      try {
        await serverChannel.stop()
        await serverChannel.start()
      } finally {
        release()
      }
    },
    async start() {
      const release = await mutex.acquire()
      try {
        await serverChannel.start()
      } finally {
        release()
      }
    },
    async stop() {
      const release = await mutex.acquire()
      try {
        await serverChannel.stop()
      } finally {
        release()
      }
    },
    async updateConfig(config) {
      const release = await mutex.acquire()
      try {
        await serverChannel.updateConfig(config)
      } finally {
        release()
      }
    },
  }
}

export async function createServerChannelService(params: { serverChannel: Server }) {
  const { context } = createContext(ipcMain)
  console.log('[Main/ServerChannel] Registering Eventa invoke handlers')

  defineInvokeHandler(context, electronGetServerChannelConfig, async () => {
    const startedAt = Date.now()
    console.log('[Main/ServerChannel] getServerChannelConfig invoked')
    const config = await getChannelServerConfig()
    console.log(`[Main/ServerChannel] getServerChannelConfig resolved in ${Date.now() - startedAt}ms`)
    return {
      authToken: config.authToken,
      hostname: config.hostname,
      websocketTlsConfig: config.tlsConfig || null,
    }
  })

  defineInvokeHandler(context, electronApplyServerChannelConfig, async (req) => {
    try {
      const current = await getChannelServerConfig()
      const next = await normalizeChannelServerOptions(
        {
          authToken: req?.authToken,
          hostname: req?.hostname,
          tlsConfig: req?.websocketTlsConfig,
        },
        current,
      )

      const tlsChanged = JSON.stringify(next.tlsConfig) !== JSON.stringify(current.tlsConfig)

      // Update and flush synchronously
      channelServerConfigStore.update(next)
      await channelServerConfigStore.flush()

      if (tlsChanged) {
        await params.serverChannel.stop()
        await params.serverChannel.updateConfig({
          hostname: env.SERVER_RUNTIME_HOSTNAME || '0.0.0.0',
          port: getServerChannelPort(),
          tlsConfig: next.tlsConfig ? await getOrCreateCertificate() : null,
        })
        await params.serverChannel.start()
      } else {
        // Ensure it's running
        await params.serverChannel.start()
      }

      return {
        authToken: next.authToken,
        hostname: next.hostname,
        websocketTlsConfig: next.tlsConfig || null,
      }
    } catch (error) {
      useLogg('main/server-runtime').withError(error).error('Failed to apply server channel configuration')
    }
  })
}

export type { Server as ServerChannel }
