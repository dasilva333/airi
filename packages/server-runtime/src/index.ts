import { availableLogLevelStrings, Format, LogLevelString, logLevelStringToLogLevelMap, useLogg } from '@guiiai/logg'
import type { MetadataEventSource, WebSocketEvent } from '@proj-airi/server-shared/types'
import { MessageHeartbeat, MessageHeartbeatKind, WebSocketEventSource } from '@proj-airi/server-shared/types'
import { defineWebSocketHandler, H3 } from 'h3'
import { nanoid } from 'nanoid'
import { parse, stringify } from 'superjson'
import packageJSON from '../package.json'
import { optionOrEnv } from './config'
import type { RouteContext, RouteDecision, RouteMiddleware, RoutingPolicy } from './middlewares'
import { collectDestinations, createPolicyMiddleware, isDevtoolsPeer, matchesDestinations } from './middlewares'
import type { AuthenticatedPeer, Peer } from './types'

function createServerEventMetadata(
  serverInstanceId: string,
  parentId?: string,
): { source: MetadataEventSource; event: { id: string; parentId?: string } } {
  return {
    event: {
      id: nanoid(),
      parentId,
    },
    source: {
      id: serverInstanceId,
      kind: 'plugin',
      plugin: {
        id: WebSocketEventSource.Server,
        version: packageJSON.version,
      },
    },
  }
}

// pre-stringified responses, make sure to use the `send` helper function to send them
const RESPONSES = {
  authenticated: (serverInstanceId: string, parentId?: string) => ({
    data: { authenticated: true },
    metadata: createServerEventMetadata(serverInstanceId, parentId),
    type: 'module:authenticated',
  }),
  error: (message: string, serverInstanceId: string, parentId?: string) => ({
    data: { message },
    metadata: createServerEventMetadata(serverInstanceId, parentId),
    type: 'error',
  }),
  heartbeat: (
    kind: MessageHeartbeatKind,
    message: MessageHeartbeat | string,
    serverInstanceId: string,
    parentId?: string,
  ) => ({
    data: { at: Date.now(), kind, message },
    metadata: createServerEventMetadata(serverInstanceId, parentId),
    type: 'transport:connection:heartbeat',
  }),
  notAuthenticated: (serverInstanceId: string, parentId?: string) => ({
    data: { message: 'not authenticated' },
    metadata: createServerEventMetadata(serverInstanceId, parentId),
    type: 'error',
  }),
} satisfies Record<string, (...args: unknown[]) => WebSocketEvent<Record<string, unknown>>>

const DEFAULT_HEARTBEAT_TTL_MS = 60_000

// helper send function
function send(peer: Peer, event: WebSocketEvent<Record<string, unknown>> | string) {
  peer.send(typeof event === 'string' ? event : stringify(event))
}

export interface AppOptions {
  instanceId?: string
  auth?: {
    token: string
  }
  logger?: {
    app?: { level?: LogLevelString; format?: Format }
    websocket?: { level?: LogLevelString; format?: Format }
  }
  routing?: {
    middleware?: RouteMiddleware[]
    allowBypass?: boolean
    policy?: RoutingPolicy
  }
  heartbeat?: {
    readTimeout?: number
    message?: MessageHeartbeat | string
  }
}

export function normalizeLoggerConfig(options?: AppOptions) {
  const appLogLevel = optionOrEnv(options?.logger?.app?.level, 'LOG_LEVEL', LogLevelString.Log, {
    validator: (value): value is LogLevelString => availableLogLevelStrings.includes(value as LogLevelString),
  })
  const appLogFormat = optionOrEnv(options?.logger?.app?.format, 'LOG_FORMAT', Format.Pretty, {
    validator: (value): value is Format => Object.values(Format).includes(value as Format),
  })
  const websocketLogLevel = options?.logger?.websocket?.level || appLogLevel || LogLevelString.Log
  const websocketLogFormat = options?.logger?.websocket?.format || appLogFormat || Format.Pretty

  return {
    appLogFormat,
    appLogLevel,
    websocketLogFormat,
    websocketLogLevel,
  }
}

export function setupApp(options?: AppOptions): { app: H3; closeAllPeers: () => void } {
  const instanceId = options?.instanceId || optionOrEnv(undefined, 'SERVER_INSTANCE_ID', nanoid())
  let authToken = optionOrEnv(options?.auth?.token, 'AUTHENTICATION_TOKEN', '')
  const isTokenGenerated = !authToken
  if (isTokenGenerated) {
    authToken = nanoid()
  }

  const { appLogLevel, appLogFormat, websocketLogLevel, websocketLogFormat } = normalizeLoggerConfig(options)

  const appLogger = useLogg('@proj-airi/server-runtime')
    .withLogLevel(logLevelStringToLogLevelMap[appLogLevel])
    .withFormat(appLogFormat)
  const logger = useLogg('@proj-airi/server-runtime:websocket')
    .withLogLevel(logLevelStringToLogLevelMap[websocketLogLevel])
    .withFormat(websocketLogFormat)

  const app = new H3({
    onError: (error) => appLogger.withError(error).error('an error occurred'),
  })

  if (isTokenGenerated) {
    appLogger.warn('No authentication token provided via options or AUTHENTICATION_TOKEN env.')
    appLogger.warn('A secure App Key (Auth Token) has been automatically generated for this session.')
    appLogger.log(`>>> APP KEY: ${authToken} <<<`)
    appLogger.warn(
      'Please use this key in your client settings (e.g. Stage UI -> Settings -> Connection -> App Key) to connect.',
    )
  }

  const peers = new Map<string, AuthenticatedPeer>()
  const peersByModule = new Map<string, Map<number | undefined, AuthenticatedPeer>>()
  const heartbeatTtlMs = options?.heartbeat?.readTimeout ?? DEFAULT_HEARTBEAT_TTL_MS
  const heartbeatMessage = options?.heartbeat?.message ?? MessageHeartbeat.Pong
  const routingMiddleware = [
    ...(options?.routing?.policy ? [createPolicyMiddleware(options.routing.policy)] : []),
    ...(options?.routing?.middleware ?? []),
  ]

  const HEALTH_CHECK_MISSES_UNHEALTHY = 5
  const HEALTH_CHECK_MISSES_DEAD = HEALTH_CHECK_MISSES_UNHEALTHY * 2
  const healthCheckIntervalMs = Math.max(5_000, Math.floor(heartbeatTtlMs / HEALTH_CHECK_MISSES_UNHEALTHY))

  setInterval(() => {
    const now = Date.now()
    for (const [id, peerInfo] of peers.entries()) {
      if (!peerInfo.lastHeartbeatAt) {
        continue
      }

      const elapsed = now - peerInfo.lastHeartbeatAt

      if (elapsed > healthCheckIntervalMs) {
        peerInfo.missedHeartbeats = (peerInfo.missedHeartbeats ?? 0) + 1
      } else {
        peerInfo.missedHeartbeats = 0
      }

      if (peerInfo.missedHeartbeats >= HEALTH_CHECK_MISSES_DEAD) {
        // 10 consecutive misses — completely dead, drop the peer
        logger
          .withFields({ missedHeartbeats: peerInfo.missedHeartbeats, peer: id, peerName: peerInfo.name })
          .debug('heartbeat expired after max misses, dropping peer')
        try {
          peerInfo.peer.close?.()
        } catch (error) {
          logger
            .withFields({ peer: id, peerName: peerInfo.name })
            .withError(error as Error)
            .debug('failed to close expired peer')
        }
        peers.delete(id)
        unregisterModulePeer(peerInfo, 'heartbeat expired')
      } else if (
        peerInfo.missedHeartbeats >= HEALTH_CHECK_MISSES_UNHEALTHY &&
        peerInfo.healthy !== false &&
        peerInfo.name &&
        peerInfo.identity
      ) {
        // 5 consecutive misses — mark unhealthy
        peerInfo.healthy = false
        logger
          .withFields({ missedHeartbeats: peerInfo.missedHeartbeats, peer: id, peerName: peerInfo.name })
          .debug('heartbeat late, marking unhealthy')
        broadcastToAuthenticated({
          data: { identity: peerInfo.identity, index: peerInfo.index, name: peerInfo.name, reason: 'heartbeat late' },
          metadata: createServerEventMetadata(instanceId),
          type: 'registry:modules:health:unhealthy',
        })
      }
    }
  }, healthCheckIntervalMs)

  function registerModulePeer(p: AuthenticatedPeer, name: string, index?: number) {
    if (!peersByModule.has(name)) {
      peersByModule.set(name, new Map())
    }

    const group = peersByModule.get(name)!
    if (group.has(index)) {
      // log instead of silent overwrite
      logger.withFields({ index, name }).debug('peer replaced for module')
    }

    p.healthy = true
    group.set(index, p)
    broadcastRegistrySync()
  }

  function unregisterModulePeer(p: AuthenticatedPeer, reason?: string) {
    if (!p.name) return

    const group = peersByModule.get(p.name)
    if (group) {
      group.delete(p.index)

      if (group.size === 0) {
        peersByModule.delete(p.name)
      }
    }

    // broadcast module:de-announced to all authenticated peers
    if (p.identity) {
      broadcastToAuthenticated({
        data: { identity: p.identity, index: p.index, name: p.name, reason },
        metadata: createServerEventMetadata(instanceId),
        type: 'module:de-announced',
      })
    }

    broadcastRegistrySync()
  }

  function listKnownModules() {
    return Array.from(peers.values())
      .filter((peerInfo) => peerInfo.name && peerInfo.identity)
      .map((peerInfo) => ({
        identity: peerInfo.identity!,
        index: peerInfo.index,
        name: peerInfo.name,
      }))
  }

  function sendRegistrySync(peer: Peer, parentId?: string) {
    send(peer, {
      data: { modules: listKnownModules() },
      metadata: createServerEventMetadata(instanceId, parentId),
      type: 'registry:modules:sync',
    })
  }

  function broadcastRegistrySync() {
    for (const p of peers.values()) {
      if (p.authenticated) {
        sendRegistrySync(p.peer)
      }
    }
  }

  function broadcastToAuthenticated(event: WebSocketEvent<Record<string, unknown>>) {
    for (const p of peers.values()) {
      if (p.authenticated) {
        send(p.peer, event)
      }
    }
  }

  app.get(
    '/ws',
    defineWebSocketHandler({
      close: (peer, details) => {
        const p = peers.get(peer.id)
        if (p) unregisterModulePeer(p, 'connection closed')

        logger
          .withFields({ activePeers: peers.size, details, peer: peer.id, peerRemote: peer.remoteAddress })
          .debug('[TESTING] closed')
        peers.delete(peer.id)
      },
      error: (peer, error) => {
        logger.withFields({ peer: peer.id }).withError(error).error('an error occurred')
      },
      message: (peer, message) => {
        const authenticatedPeer = peers.get(peer.id)
        let event: WebSocketEvent

        try {
          // NOTICE: SDK clients send events using superjson.stringify, so we must use
          // superjson.parse here instead of message.json() (which uses JSON.parse).
          // Using JSON.parse on a superjson-encoded string returns the wrapper object
          // { json: {...}, meta: {...} } with type=undefined, which breaks all event routing.
          //
          // However, external clients may send plain JSON (not superjson-encoded).
          // superjson.parse on plain JSON returns undefined since there is no `json` wrapper key.
          // In that case, fall back to JSON.parse so external clients can interoperate.
          const text = message.text()
          const parsed = parse<WebSocketEvent>(text)
          const potentialEvent = parsed && typeof parsed === 'object' && 'type' in parsed ? parsed : JSON.parse(text)

          if (!potentialEvent || typeof potentialEvent !== 'object' || !('type' in potentialEvent)) {
            send(peer, RESPONSES.error('invalid event format', instanceId))
            return
          }

          event = potentialEvent as WebSocketEvent
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err)
          send(peer, RESPONSES.error(`invalid JSON, error: ${errorMessage}`, instanceId))

          return
        }

        const logFields = {
          eventSource: event.metadata?.source,
          peer: peer.id,
          peerAuthenticated: authenticatedPeer?.authenticated,
          peerIdentity: authenticatedPeer?.identity,
          peerIndex: authenticatedPeer?.index,
          peerName: authenticatedPeer?.name,
        }

        if (event.type === 'transport:connection:heartbeat' || event.type === 'output:gen-ai:chat:complete') {
          logger.withFields(logFields).debug('received event', { type: event.type })
        } else {
          logger.withFields(logFields).debug('received event', { type: event.type })
        }

        if (authenticatedPeer) {
          authenticatedPeer.lastHeartbeatAt = Date.now()
          if (event.metadata?.source) {
            authenticatedPeer.identity = event.metadata.source
          }
        }

        if (
          !authenticatedPeer?.authenticated &&
          event.type !== 'module:authenticate' &&
          event.type !== 'transport:connection:heartbeat'
        ) {
          const error = RESPONSES.error('not authenticated', instanceId, event.metadata?.event.id)
          send(peer, error)

          return
        }

        switch (event.type) {
          case 'transport:connection:heartbeat': {
            const p = peers.get(peer.id)
            if (p) {
              p.lastHeartbeatAt = Date.now()
              p.missedHeartbeats = 0

              // recover from unhealthy → healthy
              if (p.healthy === false && p.name && p.identity) {
                p.healthy = true
                logger.withFields({ peer: peer.id, peerName: p.name }).debug('heartbeat recovered, marking healthy')
                broadcastToAuthenticated({
                  data: { identity: p.identity, index: p.index, name: p.name },
                  metadata: createServerEventMetadata(instanceId, event.metadata?.event.id),
                  type: 'registry:modules:health:healthy',
                })
              }
            }

            if (event.data.kind === MessageHeartbeatKind.Ping) {
              send(
                peer,
                RESPONSES.heartbeat(MessageHeartbeatKind.Pong, heartbeatMessage, instanceId, event.metadata?.event.id),
              )
            }

            return
          }

          case 'module:authenticate': {
            const { caller, purpose } = event.data as { caller?: string; purpose?: string }

            if (authToken && event.data.token !== authToken) {
              logger
                .withFields({
                  caller,
                  peer: peer.id,
                  peerRemote: peer.remoteAddress,
                  peerRequest: peer.request.url,
                  purpose,
                })
                .warn('authentication failed: invalid token')
              send(peer, RESPONSES.error('invalid token', instanceId, event.metadata?.event.id))

              return
            }

            logger
              .withFields({
                caller,
                peer: peer.id,
                peerRemote: peer.remoteAddress,
                purpose,
              })
              .log('authenticated')

            send(peer, RESPONSES.authenticated(instanceId, event.metadata?.event.id))
            const p = peers.get(peer.id)
            if (p) {
              p.authenticated = true
              p.caller = caller
              p.purpose = purpose
            }

            sendRegistrySync(peer, event.metadata?.event.id)

            return
          }

          case 'module:announce': {
            const p = peers.get(peer.id)
            if (!p) {
              return
            }

            unregisterModulePeer(p, 're-announcing')

            // verify
            const { name, index, identity } = event.data as {
              name: string
              index?: number
              identity?: MetadataEventSource
            }
            if (!name || typeof name !== 'string') {
              send(
                peer,
                RESPONSES.error("the field 'name' must be a non-empty string for event 'module:announce'", instanceId),
              )

              return
            }
            if (typeof index !== 'undefined') {
              if (!Number.isInteger(index) || index < 0) {
                send(
                  peer,
                  RESPONSES.error(
                    "the field 'index' must be a non-negative integer for event 'module:announce'",
                    instanceId,
                  ),
                )

                return
              }
            }
            if (!identity || identity.kind !== 'plugin' || !identity.plugin?.id) {
              send(
                peer,
                RESPONSES.error(
                  "module identity must include kind=plugin and a plugin id for event 'module:announce'",
                  instanceId,
                ),
              )

              return
            }
            if (authToken && !p.authenticated) {
              send(peer, RESPONSES.error('must authenticate before announcing', instanceId))

              return
            }

            p.name = name
            p.index = index
            if (identity) {
              p.identity = identity
            }

            registerModulePeer(p, name, index)

            // broadcast module:announced to all authenticated peers
            for (const other of peers.values()) {
              if (other.authenticated) {
                send(other.peer, {
                  data: { identity, index, name },
                  metadata: createServerEventMetadata(instanceId, event.metadata?.event.id),
                  type: 'module:announced',
                })
              }
            }

            return
          }

          case 'ui:configure': {
            const data = event.data as {
              moduleName?: string
              moduleIndex?: number
              identity?: MetadataEventSource
              config?: Record<string, unknown>
            }
            const moduleName = data.moduleName ?? data.identity?.plugin?.id ?? ''
            const moduleIndex = data.moduleIndex
            const config = data.config

            if (moduleName === '') {
              send(peer, RESPONSES.error("the field 'moduleName' can't be empty for event 'ui:configure'", instanceId))

              return
            }
            if (typeof moduleIndex !== 'undefined') {
              if (!Number.isInteger(moduleIndex) || moduleIndex < 0) {
                send(
                  peer,
                  RESPONSES.error(
                    "the field 'moduleIndex' must be a non-negative integer for event 'ui:configure'",
                    instanceId,
                  ),
                )

                return
              }
            }

            const target = peersByModule.get(moduleName)?.get(moduleIndex)
            if (target) {
              send(target.peer, {
                data: { config },
                // NOTICE: this will forward the original event metadata as-is
                metadata: event.metadata,
                type: 'module:configure',
              })
            } else {
              send(
                peer,
                RESPONSES.error("module not found, it hasn't announced itself or the name is incorrect", instanceId),
              )
            }

            return
          }
        }

        // default case
        const p = peers.get(peer.id)
        if (!p?.authenticated) {
          logger
            .withFields({
              peer: peer.id,
              peerName: p?.name,
              peerRemote: peer.remoteAddress,
              peerRequest: peer.request.url,
            })
            .debug('not authenticated')
          send(peer, RESPONSES.notAuthenticated(instanceId, event.metadata?.event.id))

          return
        }

        const payload = stringify(event)
        const allowBypass = options?.routing?.allowBypass !== false
        const shouldBypass = Boolean(event.route?.bypass && allowBypass && isDevtoolsPeer(p))
        const destinations = shouldBypass ? undefined : collectDestinations(event)
        const routingContext: RouteContext = {
          destinations,
          event,
          fromPeer: p,
          peers,
        }

        let decision: RouteDecision | undefined
        for (const middleware of routingMiddleware) {
          const result = middleware(routingContext)
          if (result) {
            decision = result
            break
          }
        }

        if (decision?.type === 'drop') {
          logger.withFields({ event, peer: peer.id, peerName: p.name }).debug('routing dropped event')
          return
        }

        const targetIds = decision?.type === 'targets' ? decision.targetIds : undefined
        const shouldBroadcast = decision?.type === 'broadcast' || !targetIds

        /*
      if (event.type !== 'output:gen-ai:chat:complete') {
        logger.withFields({ peer: peer.id, peerName: p.name, event }).log('broadcasting event to peers')
      }
      else {
        logger.withFields({ peer: peer.id, peerName: p.name, event }).debug('broadcasting event to peers')
      }
      */

        for (const [id, other] of peers.entries()) {
          if (id === peer.id) {
            logger.withFields({ event, peer: peer.id, peerName: p.name }).debug('not sending event to self')
            continue
          }

          if (!shouldBroadcast && targetIds && !targetIds.has(id)) {
            continue
          }

          if (shouldBroadcast && destinations && destinations.length > 0 && !matchesDestinations(destinations, other)) {
            continue
          }

          try {
            logger
              .withFields({
                event,
                fromPeer: peer.id,
                fromPeerName: p.name,
                toPeer: other.peer.id,
                toPeerName: other.name,
              })
              .debug('sending event to peer')
            other.peer.send(payload)
          } catch (err) {
            logger
              .withFields({
                event,
                fromPeer: peer.id,
                fromPeerName: p.name,
                toPeer: other.peer.id,
                toPeerName: other.name,
              })
              .withError(err as Error)
              .error('failed to send event to peer, removing peer')
            logger.withFields({ peer: peer.id, peerName: other.name }).debug('removing closed peer')
            peers.delete(id)

            unregisterModulePeer(other, 'send failed')
          }
        }
      },
      open: (peer) => {
        peers.set(peer.id, { authenticated: false, lastHeartbeatAt: Date.now(), name: '', peer })

        if (!authToken) {
          logger.warn(
            'No AUTHENTICATION_TOKEN provided. Gateway will only accept empty tokens for authentication. This is INSECURE.',
          )
        }

        logger.withFields({ activePeers: peers.size, peer: peer.id }).debug('[TESTING] connected')
      },
    }),
  )

  function closeAllPeers() {
    logger.withFields({ totalPeers: peers.size }).log('closing all peers')
    for (const peer of peers.values()) {
      logger.withFields({ peer: peer.peer.id, peerName: peer.name }).debug('closing peer')
      peer.peer.close?.()
    }
  }

  return {
    app,
    closeAllPeers,
  }
}
