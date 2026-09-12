import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { listProviders } from './providers'

const mockT = (key: string) => key

describe('portable provider runtime matrix', () => {
  const providers = listProviders()

  it('registers all provider subdirectories in providers/index.ts', () => {
    const providersDir = path.resolve(__dirname, 'providers')
    const subdirs = fs.readdirSync(providersDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)

    const registeredIds = new Set(providers.map(p => p.id))
    for (const subdir of subdirs) {
      expect(
        registeredIds.has(subdir),
        `Provider directory "${subdir}" must be registered in providers/index.ts`,
      ).toBe(true)
    }
  })

  it('contains all expected registered providers', () => {
    expect(providers.length).toBeGreaterThanOrEqual(34)
  })

  for (const provider of providers) {
    describe(`provider: ${provider.id}`, () => {
      it('has valid metadata contracts', () => {
        expect(provider.id).toBeTruthy()
        expect(typeof provider.id).toBe('string')
        expect(provider.name).toBeTruthy()
        expect(typeof provider.name).toBe('string')
        expect(provider.description).toBeTruthy()
        expect(typeof provider.description).toBe('string')

        expect(Array.isArray(provider.tasks)).toBe(true)
        expect(provider.tasks.length).toBeGreaterThan(0)
      })

      it('localizes name and description without throwing', () => {
        const localizedName = provider.nameLocalize({ t: mockT })
        expect(typeof localizedName).toBe('string')
        expect(localizedName.length).toBeGreaterThan(0)

        const localizedDesc = provider.descriptionLocalize({ t: mockT })
        expect(typeof localizedDesc).toBe('string')
        expect(localizedDesc.length).toBeGreaterThan(0)
      })

      it('produces a valid config schema', () => {
        const schema = provider.createProviderConfig({ t: mockT })
        expect(schema).toBeDefined()
        expect(typeof schema).toBe('object')
      })

      it('handles validationRequiredWhen gracefully if defined', () => {
        if (provider.validationRequiredWhen) {
          const emptyResult = provider.validationRequiredWhen({} as any)
          expect(typeof emptyResult).toBe('boolean')
        }
      })
    })
  }
})
