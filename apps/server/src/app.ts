import process from 'node:process'
import { initLogger, LoggerFormat, LoggerLevel, useLogger } from '@guiiai/logg'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { logger as honoLogger } from 'hono/logger'
import { createLoggLogger, injeca, lifecycle } from 'injeca'
import { createAuth } from './libs/auth'
import { createDrizzle, migrateDatabase } from './libs/db'
import { parsedEnv } from './libs/env'
import { initOtel } from './libs/otel'
import { sessionMiddleware } from './middlewares/auth'
import { otelMiddleware } from './middlewares/otel'
import { createCharacterRoutes } from './routes/characters'
import { createChatRoutes } from './routes/chats'
import { createProviderRoutes } from './routes/providers'
import { createCharacterService } from './services/characters'
import { createChatService } from './services/chats'
import { createProviderService } from './services/providers'
import type { HonoEnv } from './types/hono'
import { ApiError, createInternalError } from './utils/error'
import { getTrustedOrigin } from './utils/origin'

type AuthService = ReturnType<typeof createAuth>
type CharacterService = ReturnType<typeof createCharacterService>
type ChatService = ReturnType<typeof createChatService>
type ProviderService = ReturnType<typeof createProviderService>

type OtelMetrics = ReturnType<typeof initOtel>

interface AppDeps {
  auth: AuthService
  characterService: CharacterService
  chatService: ChatService
  providerService: ProviderService
  otel: OtelMetrics | null
}

function buildApp({ auth, characterService, chatService, providerService, otel }: AppDeps) {
  const logger = useLogger('app').useGlobalConfig()

  const app = new Hono<HonoEnv>()
    .use(
      '/api/*',
      cors({
        credentials: true,
        origin: (origin) => getTrustedOrigin(origin),
      }),
    )
    .use(honoLogger())

  if (otel) {
    app.use('*', otelMiddleware(otel))
  }

  return (
    app
      .use('*', sessionMiddleware(auth))
      .use('*', bodyLimit({ maxSize: 1024 * 1024 }))
      .onError((err, c) => {
        if (err instanceof ApiError) {
          logger.withError(err).warn('API error occurred')

          return c.json(
            {
              details: err.details,
              error: err.errorCode,
              message: err.message,
            },
            err.statusCode,
          )
        }

        logger.withError(err).error('Unhandled error')
        const internalError = createInternalError()
        return c.json(
          {
            error: internalError.errorCode,
            message: internalError.message,
          },
          internalError.statusCode,
        )
      })

      /**
       * Health check route.
       */
      .on('GET', '/health', (c) => c.json({ status: 'ok' }))

      /**
       * Auth routes are handled by the auth instance directly,
       * Powered by better-auth.
       */
      .on(['POST', 'GET'], '/api/auth/*', (c) => auth.handler(c.req.raw))

      /**
       * Character routes are handled by the character service.
       */
      .route('/api/characters', createCharacterRoutes(characterService))

      /**
       * Provider routes are handled by the provider service.
       */
      .route('/api/providers', createProviderRoutes(providerService))

      /**
       * Chat routes are handled by the chat service.
       */
      .route('/api/chats', createChatRoutes(chatService))
  )
}

export type AppType = ReturnType<typeof buildApp>

async function createApp() {
  initLogger(LoggerLevel.Debug, LoggerFormat.Pretty)
  injeca.setLogger(createLoggLogger(useLogger('injeca').useGlobalConfig()))
  const logger = useLogger('app').useGlobalConfig()

  const otel = injeca.provide('otel', {
    build: ({ dependsOn }) => {
      const o = initOtel(dependsOn.env)
      if (!o) return null

      dependsOn.lifecycle.appHooks.onStop(() => o.shutdown())
      return o
    },
    dependsOn: { env: parsedEnv, lifecycle },
  })

  const db = injeca.provide('services:db', {
    build: async ({ dependsOn }) => {
      const { db: dbInstance, pool } = createDrizzle(dependsOn.env.DATABASE_URL)
      await dbInstance.execute('SELECT 1')
      logger.log('Connected to database')
      await migrateDatabase(dbInstance)
      logger.log('Applied schema')

      dependsOn.lifecycle.appHooks.onStop(() => pool.end())
      return dbInstance
    },
    dependsOn: { env: parsedEnv, lifecycle },
  })

  const auth = injeca.provide('services:auth', {
    build: ({ dependsOn }) => createAuth(dependsOn.db, dependsOn.env),
    dependsOn: { db, env: parsedEnv },
  })

  const characterService = injeca.provide('services:characters', {
    build: ({ dependsOn }) => createCharacterService(dependsOn.db),
    dependsOn: { db },
  })

  const providerService = injeca.provide('services:providers', {
    build: ({ dependsOn }) => createProviderService(dependsOn.db),
    dependsOn: { db },
  })

  const chatService = injeca.provide('services:chats', {
    build: ({ dependsOn }) => createChatService(dependsOn.db),
    dependsOn: { db },
  })

  await injeca.start()
  const resolved = await injeca.resolve({ auth, characterService, chatService, otel, providerService })
  const app = buildApp({
    auth: resolved.auth,
    characterService: resolved.characterService,
    chatService: resolved.chatService,
    otel: resolved.otel,
    providerService: resolved.providerService,
  })

  logger.withFields({ port: 3000 }).log('Server started')

  return app
}

// eslint-disable-next-line antfu/no-top-level-await
serve(await createApp())

function handleError(error: unknown, type: string) {
  useLogger().withError(error).error(type)
}

process.on('uncaughtException', (error) => handleError(error, 'Uncaught exception'))
process.on('unhandledRejection', (error) => handleError(error, 'Unhandled rejection'))
