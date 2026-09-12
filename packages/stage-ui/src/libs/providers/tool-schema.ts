import type { Tool } from '@xsai/shared-chat'

/**
 * Normalizes JSON schemas to comply with strict provider validators (Grok/xAI, OpenAI, Azure).
 * Collapses nullable anyOf/oneOf constructs, removes nullable keys from required lists,
 * and ensures object types always possess a defined properties record.
 */
export function cleanJsonSchema(obj: any): void {
  if (!obj || typeof obj !== 'object')
    return

  delete obj.$schema
  delete obj.additionalProperties

  // Handle anyOf at the current node level (handles items or nested objects)
  if (obj.anyOf && Array.isArray(obj.anyOf)) {
    const nonNullSchemas = obj.anyOf.filter((s: any) => s && s.type !== 'null')
    if (nonNullSchemas.length >= 1) {
      const desc = obj.description
      const chosen = nonNullSchemas[0]
      delete obj.anyOf
      Object.assign(obj, chosen)
      if (desc && !obj.description)
        obj.description = desc
    }
  }

  // Handle oneOf at the current node level
  if (obj.oneOf && Array.isArray(obj.oneOf)) {
    const nonNullSchemas = obj.oneOf.filter((s: any) => s && s.type !== 'null')
    if (nonNullSchemas.length >= 1) {
      const desc = obj.description
      const chosen = nonNullSchemas[0]
      delete obj.oneOf
      Object.assign(obj, chosen)
      if (desc && !obj.description)
        obj.description = desc
    }
  }

  // Handle type as array (e.g. ["string", "null"])
  if (Array.isArray(obj.type)) {
    const nonNullTypes = obj.type.filter((t: any) => t !== 'null')
    obj.type = nonNullTypes[0] || 'string'
  }

  // Handle explicit null type
  if (obj.type === 'null') {
    obj.type = 'string'
  }

  // Ensure any node with type: 'object' has a properties object for strict validators (Grok/xAI, OpenAI, Azure)
  if (obj.type === 'object') {
    if (!obj.properties || typeof obj.properties !== 'object') {
      obj.properties = {}
    }
  }

  if (obj.properties && typeof obj.properties === 'object') {
    const requiredSet = new Set(Array.isArray(obj.required) ? obj.required : [])

    for (const [key, prop] of Object.entries(obj.properties)) {
      if (!prop || typeof prop !== 'object')
        continue

      const p = prop as any
      let isNullable = false

      // Detect nullability before cleaning so we can remove it from requiredSet
      if (p.anyOf && Array.isArray(p.anyOf) && (p.anyOf.some((s: any) => s?.type === 'null') || p.anyOf.length > 1)) {
        isNullable = true
      }
      if (p.oneOf && Array.isArray(p.oneOf) && (p.oneOf.some((s: any) => s?.type === 'null') || p.oneOf.length > 1)) {
        isNullable = true
      }
      if (Array.isArray(p.type) && p.type.includes('null')) {
        isNullable = true
      }
      if (p.type === 'null') {
        isNullable = true
      }

      if (isNullable) {
        requiredSet.delete(key)
      }

      // Recurse into nested properties/items
      cleanJsonSchema(p)
    }

    if (requiredSet.size > 0) {
      obj.required = Array.from(requiredSet)
    }
    else {
      delete obj.required
    }
  }

  if (obj.items) {
    if (Array.isArray(obj.items)) {
      obj.items.forEach((item: any) => cleanJsonSchema(item))
    }
    else if (typeof obj.items === 'object') {
      cleanJsonSchema(obj.items)
    }
  }
}

/**
 * Deep-clones tools and applies cleanJsonSchema to each function parameter schema,
 * preserving execution handlers.
 */
export function sanitizeTools(tools?: Tool[]): Tool[] | undefined {
  if (!tools)
    return undefined

  // Deep clone to avoid mutating the original tool objects
  const cloned = JSON.parse(JSON.stringify(tools)) as Tool[]

  cloned.forEach((t) => {
    if (t.function?.parameters) {
      cleanJsonSchema(t.function.parameters)
      if (t.function.parameters.type !== 'object') {
        t.function.parameters.type = 'object'
      }
      if (!t.function.parameters.properties) {
        t.function.parameters.properties = {}
      }
    }
  })

  // Restore the execute function which was stripped by JSON stringify/parse
  cloned.forEach((clonedTool, idx) => {
    clonedTool.execute = tools[idx].execute
  })

  return cloned
}
