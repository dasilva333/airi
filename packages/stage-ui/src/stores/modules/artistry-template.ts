import type { ComfyUIWorkflowTemplate } from './artistry'

export interface ComfyUIOverrideOptions {
  seedGenerator?: () => number
}

/**
 * Resolves a ComfyUI workflow template from the saved template registry.
 * Prioritizes explicitly requested model/template ID over the active default.
 */
export function resolveComfyUITemplate(
  savedWorkflows: ComfyUIWorkflowTemplate[] | undefined,
  activeWorkflowId: string | undefined,
  modelOrId?: string,
): ComfyUIWorkflowTemplate | undefined {
  if (!savedWorkflows || savedWorkflows.length === 0)
    return undefined

  const templateId = modelOrId || activeWorkflowId
  if (!templateId)
    return undefined

  return savedWorkflows.find(w => w.id === templateId)
}

/**
 * Recursively replaces string placeholders (e.g. `{{PROMPT}}`, `{{IMAGE}}`) across
 * all nested strings, arrays, and objects within a workflow payload.
 */
export function substituteComfyUIPlaceholders(obj: any, replacements: Record<string, string>): any {
  if (typeof obj === 'string') {
    let result = obj
    for (const [placeholder, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value)
    }
    return result
  }

  if (Array.isArray(obj)) {
    return obj.map(item => substituteComfyUIPlaceholders(item, replacements))
  }

  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {}
    for (const [key, value] of Object.entries(obj)) {
      newObj[key] = substituteComfyUIPlaceholders(value, replacements)
    }
    return newObj
  }

  return obj
}

/**
 * Applies user prompt and override parameters to a ComfyUI workflow template.
 *
 * Invariants:
 * 1. Deep-clones the workflow so the template is never mutated.
 * 2. Injects prompt text into the primary exposed text field unless a {{PROMPT}} placeholder is detected.
 * 3. Strictly limits parameter overrides to fields declared in `template.exposedFields` (security boundary).
 * 4. Auto-randomizes `seed` when exposed and not explicitly specified in overrides.
 */
export function applyComfyUIOverrides(
  template: { workflow: Record<string, any>, exposedFields: Record<string, string[]> },
  promptText: string,
  extra?: Record<string, any>,
  options?: ComfyUIOverrideOptions,
): Record<string, any> {
  const prompt = JSON.parse(JSON.stringify(template.workflow || {}))
  const overrides: Record<string, Record<string, any>> = {}

  // 1. Auto-inject prompt into primary exposed field unless {{PROMPT}} placeholder is present
  const extraStr = JSON.stringify(extra || {})
  const workflowStr = JSON.stringify(template.workflow || {})
  const hasPromptPlaceholder = extraStr.includes('{{PROMPT}}') || workflowStr.includes('{{PROMPT}}')

  if (promptText && !hasPromptPlaceholder) {
    for (const [nodeTitle, fields] of Object.entries(template.exposedFields || {})) {
      if (fields && fields.length > 0) {
        const targetField = fields.find(f => ['text', 'value', 'prompt', 'string', 'positive'].includes(f.toLowerCase())) || fields[0]
        if (targetField) {
          if (!overrides[nodeTitle])
            overrides[nodeTitle] = {}
          overrides[nodeTitle][targetField] = promptText
          break // Only inject into the primary prompt target field
        }
      }
    }
  }

  // 2. Merge explicit per-node overrides from extra
  const reservedKeys = ['template', 'internalJobId', 'remixId', 'options']
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (reservedKeys.includes(key))
        continue

      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        if (!overrides[key])
          overrides[key] = {}
        Object.assign(overrides[key], value)
      }
    }
  }

  // Legacy .options nesting support
  if (extra?.options) {
    for (const [nodeTitle, fields] of Object.entries(extra.options as Record<string, Record<string, any>>)) {
      if (!overrides[nodeTitle])
        overrides[nodeTitle] = {}
      Object.assign(overrides[nodeTitle], fields)
    }
  }

  // 3. Apply overrides to matching nodes strictly checking exposedFields whitelist
  for (const nodeId in prompt) {
    const node = prompt[nodeId]
    const title = node._meta?.title
    if (title && overrides[title]) {
      const nodeOverrides = overrides[title]
      for (const [field, value] of Object.entries(nodeOverrides)) {
        if (template.exposedFields[title]?.includes(field)) {
          if (!node.inputs)
            node.inputs = {}
          node.inputs[field] = value
        }
      }
    }
  }

  // 4. Auto-randomize seed if exposed and not explicitly overridden
  const generateSeed = options?.seedGenerator || (() => Math.floor(Math.random() * 1e15))
  for (const [nodeTitle, fields] of Object.entries(template.exposedFields || {})) {
    if (fields.includes('seed') && !overrides[nodeTitle]?.seed) {
      for (const nodeId in prompt) {
        const node = prompt[nodeId]
        if (node._meta?.title === nodeTitle) {
          if (!node.inputs)
            node.inputs = {}
          node.inputs.seed = generateSeed()
          break
        }
      }
    }
  }

  return prompt
}

/**
 * Resolve the next concept stack based on the Director selections.
 * Implements the "Keep Base, Refresh Modifiers" rule:
 * - If the Director selects a new Base concept, the stack is wiped and rebuilt.
 * - If the Director selects only Layer concepts, the current Base is preserved
 *   and all other modifiers are replaced by the Director new choices.
 */
export function resolveConceptStack(
  currentStack: string[],
  directorPicks: string[],
  visualAssets: Record<string, any>,
): string[] {
  const isVisual = (asset: any) => asset?.prompt?.trim() || (asset?.artistry?.provider && !['none', 'inherit'].includes(asset.artistry.provider))

  const validPicks = directorPicks.filter(id => !!visualAssets[id])
  if (validPicks.length === 0)
    return currentStack

  // Identify non-visual concepts that the Director shouldn not be managing (Identity layers, etc)
  const nonVisualLayers = currentStack.filter(id => !isVisual(visualAssets[id]))

  // Separate Director picks into bases and layers
  const newBases = validPicks.filter(id => visualAssets[id]?.isBase)
  const newLayers = validPicks.filter(id => !visualAssets[id]?.isBase)

  if (newBases.length > 0) {
    // Director picked a new Base: wipe visual stack, preserve non-visual identity layers
    const primaryBase = newBases[newBases.length - 1]
    return Array.from(new Set([primaryBase, ...nonVisualLayers, ...newLayers]))
  }

  // Director picked only Layers: preserve existing Base and non-visual identity layers, clear old modifiers
  const currentBase = currentStack.find(id => visualAssets[id]?.isBase)
  const nextStack = currentBase ? [currentBase] : []
  nextStack.push(...nonVisualLayers)
  nextStack.push(...newLayers)
  return Array.from(new Set(nextStack))
}
