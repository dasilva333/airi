import { createInsertSchema, createSelectSchema } from 'drizzle-valibot'
import { boolean, object, optional, record, string } from 'valibot'

import * as schema from '../schemas/providers'

export const UserProviderConfigSchema = createSelectSchema(schema.userProviderConfigs)
export const InsertUserProviderConfigSchema = createInsertSchema(schema.userProviderConfigs)

export const SystemProviderConfigSchema = createSelectSchema(schema.systemProviderConfigs)
export const InsertSystemProviderConfigSchema = createInsertSchema(schema.systemProviderConfigs)

export const CreateProviderConfigSchema = object({
  config: optional(record(string(), string())),
  definitionId: string(),
  id: optional(string()),
  name: string(),
  validated: optional(boolean()),
  validationBypassed: optional(boolean()),
})

export const UpdateProviderConfigSchema = object({
  config: optional(record(string(), string())),
  name: optional(string()),
  validated: optional(boolean()),
  validationBypassed: optional(boolean()),
})
