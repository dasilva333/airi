import { describe, expect, it, vi } from 'vitest'

import { cleanJsonSchema, sanitizeTools } from './tool-schema'

describe('cleanJsonSchema', () => {
  it('strips $schema and additionalProperties from schema nodes', () => {
    const schema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      additionalProperties: false,
      properties: {
        query: {
          type: 'string',
          additionalProperties: false,
        },
      },
    }

    cleanJsonSchema(schema)

    expect(schema).not.toHaveProperty('$schema')
    expect(schema).not.toHaveProperty('additionalProperties')
    expect(schema.properties.query).not.toHaveProperty('additionalProperties')
  })

  it('collapses anyOf with nullable primitives into the concrete type (Grok/OpenAI/Azure compatibility)', () => {
    const schema: any = {
      type: 'object',
      properties: {
        optionalText: {
          description: 'A test description',
          anyOf: [
            { type: 'string' },
            { type: 'null' },
          ],
        },
      },
    }

    cleanJsonSchema(schema)

    expect(schema.properties.optionalText).not.toHaveProperty('anyOf')
    expect(schema.properties.optionalText.type).toBe('string')
    expect(schema.properties.optionalText.description).toBe('A test description')
  })

  it('collapses oneOf with nullable primitives into the concrete type', () => {
    const schema: any = {
      type: 'object',
      properties: {
        optionalCount: {
          oneOf: [
            { type: 'number' },
            { type: 'null' },
          ],
        },
      },
    }

    cleanJsonSchema(schema)

    expect(schema.properties.optionalCount).not.toHaveProperty('oneOf')
    expect(schema.properties.optionalCount.type).toBe('number')
  })

  it('normalizes type arrays with null into a single concrete type', () => {
    const schema = {
      type: 'object',
      properties: {
        mixed: {
          type: ['string', 'null'],
        },
      },
    }

    cleanJsonSchema(schema)

    expect(schema.properties.mixed.type).toBe('string')
  })

  it('converts bare null types to string', () => {
    const schema = {
      type: 'object',
      properties: {
        nullField: {
          type: 'null',
        },
      },
    }

    cleanJsonSchema(schema)

    expect(schema.properties.nullField.type).toBe('string')
  })

  it('ensures type: object has properties record for strict validators', () => {
    const schema = {
      type: 'object',
    } as any

    cleanJsonSchema(schema)

    expect(schema.properties).toEqual({})
  })

  it('removes nullable fields from required list so strict validators do not require null', () => {
    const schema = {
      type: 'object',
      required: ['mandatoryField', 'nullableField'],
      properties: {
        mandatoryField: {
          type: 'string',
        },
        nullableField: {
          anyOf: [
            { type: 'string' },
            { type: 'null' },
          ],
        },
      },
    }

    cleanJsonSchema(schema)

    expect(schema.required).toEqual(['mandatoryField'])
  })

  it('deletes required array entirely if all fields were nullable', () => {
    const schema = {
      type: 'object',
      required: ['nullableField'],
      properties: {
        nullableField: {
          type: ['string', 'null'],
        },
      },
    }

    cleanJsonSchema(schema)

    expect(schema).not.toHaveProperty('required')
  })
})

describe('sanitizeTools', () => {
  it('returns undefined if tools is undefined', () => {
    expect(sanitizeTools(undefined)).toBeUndefined()
  })

  it('deep-clones tool definitions and preserves execute callbacks', () => {
    const executeMock = vi.fn()
    const originalTools: any[] = [
      {
        name: 'testTool',
        description: 'A tool for testing',
        execute: executeMock,
        function: {
          name: 'testTool',
          description: 'A tool for testing',
          parameters: {
            type: 'object',
            required: ['foo'],
            properties: {
              foo: {
                anyOf: [{ type: 'string' }, { type: 'null' }],
              },
            },
          },
        },
      },
    ]

    const sanitized = sanitizeTools(originalTools)

    expect(sanitized).toBeDefined()
    expect(sanitized).toHaveLength(1)
    expect(sanitized![0].execute).toBe(executeMock)

    // Original tool object is unmutated
    expect((originalTools[0] as any).function.parameters.properties.foo).toHaveProperty('anyOf')

    // Sanitized tool has anyOf collapsed
    const sanitizedParams = (sanitized![0] as any).function.parameters
    expect(sanitizedParams.properties.foo).not.toHaveProperty('anyOf')
    expect(sanitizedParams.properties.foo.type).toBe('string')
    expect(sanitizedParams).not.toHaveProperty('required')
  })
})
