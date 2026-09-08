import { describe, expect, it } from 'vitest'

import {
  applyComfyUIOverrides,
  resolveComfyUITemplate,
  resolveConceptStack,
  substituteComfyUIPlaceholders,
} from './artistry-template'

describe('artistry ComfyUI template processing & concept stack', () => {
  const sampleWorkflow = {
    3: {
      _meta: { title: 'Positive CLIP Text' },
      class_type: 'CLIPTextEncode',
      inputs: { text: 'default positive prompt', clip: ['4', 0] },
    },
    4: {
      _meta: { title: 'Checkpoint Loader' },
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: 'v1-5-pruned.ckpt' },
    },
    5: {
      _meta: { title: 'KSampler' },
      class_type: 'KSampler',
      inputs: {
        seed: 123456,
        steps: 20,
        cfg: 8,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['4', 0],
        positive: ['3', 0],
      },
    },
  }

  const sampleTemplate = {
    id: 'wf-portrait',
    name: 'Anime Portrait',
    workflow: sampleWorkflow,
    exposedFields: {
      'Positive CLIP Text': ['text'],
      'KSampler': ['seed', 'steps', 'cfg'],
    },
  }

  describe('resolveComfyUITemplate', () => {
    it('returns undefined when saved templates are empty or uninitialized', () => {
      expect(resolveComfyUITemplate([], 'wf-portrait')).toBeUndefined()
      expect(resolveComfyUITemplate(undefined, 'wf-portrait')).toBeUndefined()
    })

    it('prioritizes explicit model/template ID over active default', () => {
      const templates = [
        sampleTemplate,
        { id: 'wf-landscape', name: 'Landscape', workflow: {}, exposedFields: {} },
      ]
      const resolved = resolveComfyUITemplate(templates, 'wf-portrait', 'wf-landscape')
      expect(resolved?.id).toBe('wf-landscape')
    })

    it('falls back to active default workflow when model/template is omitted', () => {
      const templates = [sampleTemplate]
      const resolved = resolveComfyUITemplate(templates, 'wf-portrait')
      expect(resolved?.id).toBe('wf-portrait')
    })

    it('returns undefined if specified ID does not match any template', () => {
      const templates = [sampleTemplate]
      expect(resolveComfyUITemplate(templates, 'non-existent')).toBeUndefined()
    })
  })

  describe('applyComfyUIOverrides', () => {
    it('injects prompt into primary exposed text field without mutating original template', () => {
      const originalCopy = JSON.parse(JSON.stringify(sampleTemplate.workflow))
      const result = applyComfyUIOverrides(sampleTemplate, 'A cinematic portrait of Shinobu')

      expect(result['3'].inputs.text).toBe('A cinematic portrait of Shinobu')
      // Assert input template is unmutated
      expect(sampleTemplate.workflow).toEqual(originalCopy)
    })

    it('skips auto-injection if extra contains a {{PROMPT}} placeholder', () => {
      const extra = {
        customNode: { text: 'Prefix: {{PROMPT}} suffix' },
      }
      const result = applyComfyUIOverrides(sampleTemplate, 'Shinobu', extra)
      // Positive CLIP Text should retain default because user opted into placeholder flow
      expect(result['3'].inputs.text).toBe('default positive prompt')
    })

    it('skips auto-injection if template workflow already contains a {{PROMPT}} placeholder', () => {
      const templateWithPlaceholder = {
        workflow: {
          3: {
            _meta: { title: 'Positive CLIP Text' },
            inputs: { text: 'Pre-burned {{PROMPT}}' },
          },
        },
        exposedFields: { 'Positive CLIP Text': ['text'] },
      }
      const result = applyComfyUIOverrides(templateWithPlaceholder, 'Dynamic Prompt')
      expect(result['3'].inputs.text).toBe('Pre-burned {{PROMPT}}')
    })

    it('strictly respects the exposedFields security whitelist and rejects unexposed overrides', () => {
      const extra = {
        KSampler: {
          steps: 30, // exposed -> should apply
          cfg: 7.5, // exposed -> should apply
          sampler_name: 'dpmpp_2m', // NOT exposed -> MUST NOT apply
          denoise: 0.7, // NOT exposed -> MUST NOT apply
        },
      }
      const result = applyComfyUIOverrides(sampleTemplate, 'Test prompt', extra)
      expect(result['5'].inputs.steps).toBe(30)
      expect(result['5'].inputs.cfg).toBe(7.5)
      expect(result['5'].inputs.sampler_name).toBe('euler')
      expect(result['5'].inputs.denoise).toBe(1)
    })

    it('supports legacy extra.options nested node overrides', () => {
      const extra = {
        options: {
          KSampler: { steps: 15 },
        },
      }
      const result = applyComfyUIOverrides(sampleTemplate, 'Test prompt', extra)
      expect(result['5'].inputs.steps).toBe(15)
    })

    it('auto-randomizes seed when exposed and not explicitly overridden', () => {
      const fakeSeedGenerator = () => 987654321
      const result = applyComfyUIOverrides(
        sampleTemplate,
        'Test prompt',
        undefined,
        { seedGenerator: fakeSeedGenerator },
      )
      expect(result['5'].inputs.seed).toBe(987654321)
    })

    it('preserves explicit seed when provided in node overrides', () => {
      const fakeSeedGenerator = () => 987654321
      const extra = { KSampler: { seed: 42 } }
      const result = applyComfyUIOverrides(
        sampleTemplate,
        'Test prompt',
        extra,
        { seedGenerator: fakeSeedGenerator },
      )
      expect(result['5'].inputs.seed).toBe(42)
    })
  })

  describe('substituteComfyUIPlaceholders', () => {
    it('replaces {{PROMPT}} and {{IMAGE}} recursively across strings, arrays, and objects', () => {
      const inputGraph = {
        promptNode: {
          text: 'Masterpiece, {{PROMPT}}, high quality',
          tags: ['art', '{{PROMPT}}', 'photorealistic'],
        },
        imageNode: {
          filename: '{{IMAGE}}',
          nested: {
            ref: '{{IMAGE}}',
            unchanged: 12345,
            flag: true,
            nullable: null,
          },
        },
      }

      const replacements = {
        '{{PROMPT}}': 'vampire girl with blonde hair',
        '{{IMAGE}}': 'vhack_1741478400000.png',
      }

      const result = substituteComfyUIPlaceholders(inputGraph, replacements)

      expect(result.promptNode.text).toBe('Masterpiece, vampire girl with blonde hair, high quality')
      expect(result.promptNode.tags).toEqual(['art', 'vampire girl with blonde hair', 'photorealistic'])
      expect(result.imageNode.filename).toBe('vhack_1741478400000.png')
      expect(result.imageNode.nested.ref).toBe('vhack_1741478400000.png')
      expect(result.imageNode.nested.unchanged).toBe(12345)
      expect(result.imageNode.nested.flag).toBe(true)
      expect(result.imageNode.nested.nullable).toBeNull()
    })
  })

  describe('resolveConceptStack (Autonomous Director)', () => {
    const visualAssets = {
      base_shinobu: {
        isBase: true,
        prompt: 'oshino shinobu, young vampire',
        description: 'Shinobu base appearance',
      },
      base_kiss_shot: {
        isBase: true,
        prompt: 'kiss-shot acerola-orion heart-under-blade, adult vampire',
        description: 'Adult Kiss-Shot base appearance',
      },
      layer_straw_hat: {
        isBase: false,
        prompt: 'straw hat, yellow dress',
        description: 'Summer outfit',
      },
      layer_goggles: {
        isBase: false,
        prompt: 'aviator goggles on head',
        description: 'Aviator goggles',
      },
      identity_vampire_lore: {
        isBase: false,
        prompt: '', // Non-visual layer
        description: 'Immortal oddity background lore',
      },
    }

    it('returns unchanged stack if director picks are empty or all unrecognized', () => {
      const current = ['base_shinobu', 'layer_straw_hat']
      expect(resolveConceptStack(current, [], visualAssets)).toEqual(current)
      expect(resolveConceptStack(current, ['unknown_concept_xyz'], visualAssets)).toEqual(current)
    })

    it('wipes visual stack and preserves non-visual identity layers when a new Base is selected', () => {
      const current = ['base_shinobu', 'identity_vampire_lore', 'layer_straw_hat']
      const picks = ['base_kiss_shot', 'layer_goggles']

      const next = resolveConceptStack(current, picks, visualAssets)
      // Must have new base first, then preserved non-visual layer, then new layer
      expect(next).toEqual(['base_kiss_shot', 'identity_vampire_lore', 'layer_goggles'])
      expect(next).not.toContain('base_shinobu')
      expect(next).not.toContain('layer_straw_hat')
    })

    it('preserves existing Base and identity layers while replacing modifiers when only Layers are selected', () => {
      const current = ['base_shinobu', 'identity_vampire_lore', 'layer_straw_hat']
      const picks = ['layer_goggles']

      const next = resolveConceptStack(current, picks, visualAssets)
      expect(next).toEqual(['base_shinobu', 'identity_vampire_lore', 'layer_goggles'])
      expect(next).not.toContain('layer_straw_hat')
    })

    it('deduplicates concept selections cleanly', () => {
      const current = ['base_shinobu']
      const picks = ['layer_goggles', 'layer_goggles']

      const next = resolveConceptStack(current, picks, visualAssets)
      expect(next).toEqual(['base_shinobu', 'layer_goggles'])
    })
  })
})
