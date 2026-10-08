import fs from 'node:fs'
import path from 'node:path'

import { fileURLToPath } from 'node:url'

import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

import ProviderPickerGrid from './components/provider-picker-grid.vue'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ROOT CAUSE:
//
// In commit ffc8ca48be, an optimization pass removed:
// `-import ProviderPickerGrid from '../../v2/components/provider-picker-grid.vue'`
// under the mistaken assumption that it was an obsolete/unused V2 reference.
//
// However, <ProviderPickerGrid> was actively used in the template of
// `step-consciousness.vue` under the "Custom API Key" tab. Because Vue's
// SFC compiler treats undeclared template tags as dynamic global components
// via `_resolveComponent("ProviderPickerGrid")`, it did not fail at build time.
// At runtime, the unresolved component produced `undefined`, silently rendering
// the entire "Choose an AI Brain Provider" picker grid as an empty comment node.
//
// FIXED BY:
// 1. Creating a native V3 component: `v3/components/provider-picker-grid.vue`.
// 2. Importing it explicitly in `step-consciousness.vue`.
// 3. Adding an automated static SFC template-binding audit across all V3 onboarding
//    steps to guarantee that every template component has a valid script binding
//    and cannot silently compile into `_resolveComponent`.

describe('onboarding V3 Component Integrity & Regression Protection', () => {
  it('exports ProviderPickerGrid as a valid Vue component object', () => {
    expect(ProviderPickerGrid).toBeDefined()
    expect(typeof ProviderPickerGrid).toBe('object')
  })

  it('reproduces Issue: step-consciousness.vue must explicitly bind ProviderPickerGrid and not emit _resolveComponent', () => {
    const filePath = path.join(__dirname, 'steps', 'step-consciousness.vue')
    const content = fs.readFileSync(filePath, 'utf-8')
    const parsed = parse(content)

    expect(parsed.descriptor.template).not.toBeNull()
    expect(parsed.descriptor.scriptSetup).not.toBeNull()

    const script = compileScript(parsed.descriptor, { id: 'test-consciousness' })
    expect(script.bindings).toHaveProperty('ProviderPickerGrid')

    const compiled = compileTemplate({
      source: parsed.descriptor.template!.content,
      id: 'test-consciousness',
      filename: filePath,
      compilerOptions: { bindingMetadata: script.bindings },
    })

    const unresolved = [...compiled.code.matchAll(/_resolveComponent\("([^"]+)"\)/g)].map(m => m[1])
    expect(unresolved).not.toContain('ProviderPickerGrid')
  })

  it('audits all Onboarding V3 Vue files to ensure zero unimported template components', () => {
    function getVueFiles(dir: string): string[] {
      const results: string[] = []
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          results.push(...getVueFiles(fullPath))
        }
        else if (entry.name.endsWith('.vue')) {
          results.push(fullPath)
        }
      }
      return results
    }

    const vueFiles = getVueFiles(__dirname)
    expect(vueFiles.length).toBeGreaterThanOrEqual(18)

    const ALLOWED_GLOBALS = new Set([
      'component',
      'RouterView',
      'RouterLink',
      'Transition',
      'Teleport',
      'KeepAlive',
      'Suspense',
    ])

    const violations: { file: string, unresolved: string[] }[] = []

    for (const file of vueFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const parsed = parse(content)
      if (!parsed.descriptor.template)
        continue

      let bindings = {}
      if (parsed.descriptor.scriptSetup || parsed.descriptor.script) {
        try {
          const script = compileScript(parsed.descriptor, { id: `audit-${path.basename(file)}` })
          bindings = script.bindings || {}
        }
        catch (err: any) {
          throw new Error(`Failed to compile script for ${file}: ${err.message}`)
        }
      }

      const compiled = compileTemplate({
        source: parsed.descriptor.template.content,
        id: `audit-${path.basename(file)}`,
        filename: file,
        compilerOptions: { bindingMetadata: bindings },
      })

      const unresolved = [...compiled.code.matchAll(/_resolveComponent\("([^"]+)"\)/g)]
        .map(m => m[1])
        .filter(compName => !ALLOWED_GLOBALS.has(compName))

      if (unresolved.length > 0) {
        violations.push({
          file: path.relative(__dirname, file),
          unresolved,
        })
      }
    }

    expect(violations).toEqual([])
  })
})
