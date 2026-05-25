import type { Component } from 'vue'
import { markRaw } from 'vue'
import type { Schema } from 'xsschema'
import { toJsonSchema } from 'xsschema'

export function defineCallingComponent<T extends Schema>(
  name: string,
  component: Component,
  schema: T,
  exampleProps?: Record<string, unknown>,
) {
  return {
    component: markRaw(component),
    exampleProps,
    name,
    schema: toJsonSchema(schema),
  }
}
