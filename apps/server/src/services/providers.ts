import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Database } from '../libs/db'

import * as schema from '../schemas/providers'

export function createProviderService(db: Database) {
  return {
    async createSystemConfig(data: schema.NewSystemProviderConfig) {
      const [inserted] = await db.insert(schema.systemProviderConfigs).values(data).returning()
      return inserted
    },

    async createUserConfig(data: schema.NewUserProviderConfig) {
      const [inserted] = await db.insert(schema.userProviderConfigs).values(data).returning()
      return inserted
    },

    async deleteSystemConfig(id: string) {
      return await db
        .update(schema.systemProviderConfigs)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.systemProviderConfigs.id, id), isNull(schema.systemProviderConfigs.deletedAt)))
        .returning()
    },

    async deleteUserConfig(id: string) {
      return await db
        .update(schema.userProviderConfigs)
        .set({ deletedAt: new Date() })
        .where(and(eq(schema.userProviderConfigs.id, id), isNull(schema.userProviderConfigs.deletedAt)))
        .returning()
    },
    async findAll(ownerId: string) {
      const userConfigs = db
        .select({
          config: schema.userProviderConfigs.config,
          createdAt: schema.userProviderConfigs.createdAt,
          definitionId: schema.userProviderConfigs.definitionId,
          id: schema.userProviderConfigs.id,
          isSystem: sql<boolean>`false`.as('is_system'),
          name: schema.userProviderConfigs.name,
          updatedAt: schema.userProviderConfigs.updatedAt,
          validated: schema.userProviderConfigs.validated,
          validationBypassed: schema.userProviderConfigs.validationBypassed,
        })
        .from(schema.userProviderConfigs)
        .where(and(eq(schema.userProviderConfigs.ownerId, ownerId), isNull(schema.userProviderConfigs.deletedAt)))

      const systemConfigs = db
        .select({
          config: schema.systemProviderConfigs.config,
          createdAt: schema.systemProviderConfigs.createdAt,
          definitionId: schema.systemProviderConfigs.definitionId,
          id: schema.systemProviderConfigs.id,
          isSystem: sql<boolean>`true`.as('is_system'),
          name: schema.systemProviderConfigs.name,
          updatedAt: schema.systemProviderConfigs.updatedAt,
          validated: schema.systemProviderConfigs.validated,
          validationBypassed: schema.systemProviderConfigs.validationBypassed,
        })
        .from(schema.systemProviderConfigs)
        .where(isNull(schema.systemProviderConfigs.deletedAt))

      return await userConfigs.unionAll(systemConfigs)
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
        where: and(eq(schema.systemProviderConfigs.id, id), isNull(schema.systemProviderConfigs.deletedAt)),
      })

      if (systemConfig) {
        return { ...systemConfig, isSystem: true }
      }

      return null
    },

    async findSystemConfigById(id: string) {
      return await db.query.systemProviderConfigs.findFirst({
        where: and(eq(schema.systemProviderConfigs.id, id), isNull(schema.systemProviderConfigs.deletedAt)),
      })
    },

    // System Provider Configs
    async findSystemConfigs() {
      return await db.query.systemProviderConfigs.findMany({
        where: isNull(schema.systemProviderConfigs.deletedAt),
      })
    },

    async findUserConfigById(id: string) {
      return await db.query.userProviderConfigs.findFirst({
        where: and(eq(schema.userProviderConfigs.id, id), isNull(schema.userProviderConfigs.deletedAt)),
      })
    },

    async findUserConfigsByOwnerId(ownerId: string) {
      return await db.query.userProviderConfigs.findMany({
        where: and(eq(schema.userProviderConfigs.ownerId, ownerId), isNull(schema.userProviderConfigs.deletedAt)),
      })
    },

    async updateSystemConfig(id: string, data: Partial<schema.NewSystemProviderConfig>) {
      const [updated] = await db
        .update(schema.systemProviderConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(schema.systemProviderConfigs.id, id), isNull(schema.systemProviderConfigs.deletedAt)))
        .returning()
      return updated
    },

    async updateUserConfig(id: string, data: Partial<schema.NewUserProviderConfig>) {
      const [updated] = await db
        .update(schema.userProviderConfigs)
        .set({ ...data, updatedAt: new Date() })
        .where(and(eq(schema.userProviderConfigs.id, id), isNull(schema.userProviderConfigs.deletedAt)))
        .returning()
      return updated
    },
  }
}

export type ProviderService = ReturnType<typeof createProviderService>
