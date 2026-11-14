import type { Database } from '../libs/db'

import { and, eq, isNull, sql } from 'drizzle-orm'

import * as schema from '../schemas/providers'

// Anything credential-shaped must not be readable by non-admin users of this
// API, even if the system config row carries it — treat names as hints only,
// keys are matched loosely by shape (apiKey, api_key, secret, token, ...).
const CREDENTIAL_KEY = /(api[-_]?key|secret|token|password|credential|bearer|authorization)/i

export function stripCredentialKeys(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(stripCredentialKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (CREDENTIAL_KEY.test(key))
        continue
      out[key] = stripCredentialKeys(val)
    }
    return out
  }
  return value
}

const toSafeSystemRow = (row: any) => ({ ...row, config: stripCredentialKeys(row.config) as any })

export function createProviderService(db: Database) {
  return {
    async findAll(ownerId: string) {
      const userConfigs = db
        .select({
          id: schema.userProviderConfigs.id,
          definitionId: schema.userProviderConfigs.definitionId,
          name: schema.userProviderConfigs.name,
          config: schema.userProviderConfigs.config,
          validated: schema.userProviderConfigs.validated,
          validationBypassed: schema.userProviderConfigs.validationBypassed,
          createdAt: schema.userProviderConfigs.createdAt,
          updatedAt: schema.userProviderConfigs.updatedAt,
          isSystem: sql<boolean>`false`.as('is_system'),
        })
        .from(schema.userProviderConfigs)
        .where(
          and(
            eq(schema.userProviderConfigs.ownerId, ownerId),
            isNull(schema.userProviderConfigs.deletedAt),
          ),
        )

      const systemConfigs = db
        .select({
          id: schema.systemProviderConfigs.id,
          definitionId: schema.systemProviderConfigs.definitionId,
          name: schema.systemProviderConfigs.name,
          config: schema.systemProviderConfigs.config,
          validated: schema.systemProviderConfigs.validated,
          validationBypassed: schema.systemProviderConfigs.validationBypassed,
          createdAt: schema.systemProviderConfigs.createdAt,
          updatedAt: schema.systemProviderConfigs.updatedAt,
          isSystem: sql<boolean>`true`.as('is_system'),
        })
        .from(schema.systemProviderConfigs)
        .where(isNull(schema.systemProviderConfigs.deletedAt))

      const rows = await userConfigs.unionAll(systemConfigs)
      // System rows are pooled for every signed-up user: never hand out their secrets.
      return rows.map((row: any) => (row.isSystem === true || row.is_system === true ? toSafeSystemRow(row) : row))
    },

    async findUserConfigsByOwnerId(ownerId: string) {
      return await db.query.userProviderConfigs.findMany({
        where: and(
          eq(schema.userProviderConfigs.ownerId, ownerId),
          isNull(schema.userProviderConfigs.deletedAt),
        ),
      })
    },

    async findById(id: string, ownerId: string) {
      const userConfig = await db.query.userProviderConfigs.findFirst({
        where: and(
          eq(schema.userProviderConfigs.id, id),
          eq(schema.userProviderConfigs.ownerId, ownerId),
          isNull(schema.userProviderConfigs.deletedAt),
        ),
      })

      if (userConfig) {
        return { ...userConfig, isSystem: false }
      }

      const systemConfig = await db.query.systemProviderConfigs.findFirst({
        where: and(
          eq(schema.systemProviderConfigs.id, id),
          isNull(schema.systemProviderConfigs.deletedAt),
        ),
      })

      if (systemConfig) {
        return { ...toSafeSystemRow(systemConfig), isSystem: true }
      }

      return null
    },

    async findUserConfigById(id: string) {
      return await db.query.userProviderConfigs.findFirst({
        where: and(
          eq(schema.userProviderConfigs.id, id),
          isNull(schema.userProviderConfigs.deletedAt),
        ),
      })
    },

    async createUserConfig(data: schema.NewUserProviderConfig) {
      const [inserted] = await db.insert(schema.userProviderConfigs).values(data).returning()
      return inserted
    },

    async updateUserConfig(id: string, data: Partial<schema.NewUserProviderConfig>) {
      const [updated] = await db.update(schema.userProviderConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(and(
          eq(schema.userProviderConfigs.id, id),
          isNull(schema.userProviderConfigs.deletedAt),
        ))
        .returning()
      return updated
    },

    async deleteUserConfig(id: string) {
      return await db.update(schema.userProviderConfigs)
        .set({ deletedAt: new Date() })
        .where(and(
          eq(schema.userProviderConfigs.id, id),
          isNull(schema.userProviderConfigs.deletedAt),
        ))
        .returning()
    },

    // System Provider Configs
    async findSystemConfigs() {
      return await db.query.systemProviderConfigs.findMany({
        where: isNull(schema.systemProviderConfigs.deletedAt),
      })
    },

    async findSystemConfigById(id: string) {
      return await db.query.systemProviderConfigs.findFirst({
        where: and(
          eq(schema.systemProviderConfigs.id, id),
          isNull(schema.systemProviderConfigs.deletedAt),
        ),
      })
    },

    async createSystemConfig(data: schema.NewSystemProviderConfig) {
      const [inserted] = await db.insert(schema.systemProviderConfigs).values(data).returning()
      return inserted
    },

    async updateSystemConfig(id: string, data: Partial<schema.NewSystemProviderConfig>) {
      const [updated] = await db.update(schema.systemProviderConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(and(
          eq(schema.systemProviderConfigs.id, id),
          isNull(schema.systemProviderConfigs.deletedAt),
        ))
        .returning()
      return updated
    },

    async deleteSystemConfig(id: string) {
      return await db.update(schema.systemProviderConfigs)
        .set({ deletedAt: new Date() })
        .where(and(
          eq(schema.systemProviderConfigs.id, id),
          isNull(schema.systemProviderConfigs.deletedAt),
        ))
        .returning()
    },
  }
}

export type ProviderService = ReturnType<typeof createProviderService>
