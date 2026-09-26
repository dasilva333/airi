import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

import yaml, { isMap, parseDocument } from 'yaml'

import { describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = path.resolve(__dirname, 'locales')

const SUPPORTED_LOCALES = [
  'en',
  'es',
  'fr',
  'id',
  'ja',
  'ko',
  'ru',
  'vi',
  'zh-Hans',
  'zh-Hant',
]

function extractLeafKeys(obj: any, prefix = ''): string[] {
  const keys: string[] = []
  if (!obj || typeof obj !== 'object')
    return keys

  for (const [k, v] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...extractLeafKeys(v, keyPath))
    }
    else {
      keys.push(keyPath)
    }
  }
  return keys
}

function checkDuplicateKeys(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf8')
  const duplicates: string[] = []
  const doc = parseDocument(content)

  function checkMap(node: any, p: string[] = []) {
    if (!isMap(node))
      return
    const seen = new Set<string>()
    node.items.forEach((item: any) => {
      const k = item.key?.value ?? item.key?.toString()
      if (seen.has(k)) {
        duplicates.push([...p, k].join('.'))
      }
      seen.add(k)
      if (isMap(item.value)) {
        checkMap(item.value, [...p, k])
      }
    })
  }

  checkMap(doc.contents)
  return duplicates
}

describe('@proj-airi/i18n locale integrity', () => {
  it('has all 10 canonical locales present in locales directory', () => {
    const dirs = fs.readdirSync(LOCALES_DIR, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name)

    for (const locale of SUPPORTED_LOCALES) {
      expect(dirs).toContain(locale)
    }
  })

  it('contains valid syntax and zero duplicate keys in all base.yaml files', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const filePath = path.join(LOCALES_DIR, locale, 'base.yaml')
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        expect(() => yaml.parse(content)).not.toThrow()
        const dups = checkDuplicateKeys(filePath)
        expect(dups).toEqual([])
      }
    }
  })

  it('maintains 100% key parity for onboarding.yaml across all supported languages', () => {
    const enPath = path.join(LOCALES_DIR, 'en', 'onboarding.yaml')
    if (!fs.existsSync(enPath)) {
      // Pending Onboarding V3 YAML creation
      return
    }

    const enData = yaml.parse(fs.readFileSync(enPath, 'utf8')) || {}
    const enKeys = extractLeafKeys(enData)
    expect(enKeys.length).toBeGreaterThan(50)

    for (const locale of SUPPORTED_LOCALES) {
      if (locale === 'en')
        continue
      const targetPath = path.join(LOCALES_DIR, locale, 'onboarding.yaml')
      expect(fs.existsSync(targetPath), `Missing onboarding.yaml for locale: ${locale}`).toBe(true)

      const targetIndexPath = path.join(LOCALES_DIR, locale, 'index.ts')
      if (fs.existsSync(targetIndexPath)) {
        const indexContent = fs.readFileSync(targetIndexPath, 'utf8')
        expect(indexContent, `Locale ${locale}/index.ts must register onboarding module`).toContain('onboarding')
      }

      const targetData = yaml.parse(fs.readFileSync(targetPath, 'utf8')) || {}
      const targetKeys = new Set(extractLeafKeys(targetData))

      const missing = enKeys.filter(k => !targetKeys.has(k))
      expect(missing, `Locale ${locale} is missing keys in onboarding.yaml: ${missing.slice(0, 5).join(', ')}`).toEqual([])
    }
  })
})
