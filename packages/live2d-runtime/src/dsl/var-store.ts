/**
 * ReactiveVarStore — the `VarFloats` state heap.
 *
 * Two VarFloat kinds:
 *  - Type 1 (Condition / guard): read-only eligibility check.
 *  - Type 2 (Mutation): mutates the heap.
 *
 * Entries apply a list of VarFloats **atomically**: every Type 1 guard must pass
 * before any Type 2 mutation executes. Mutations never partially apply.
 */

import type { VarFloat, VarFloatCondition, VarFloatMutation } from './types'

export const CONDITION_OPS = ['equal', 'not_equal', 'greater', 'greater_equal', 'less', 'lower', 'lower_equal'] as const
export type ConditionOp = typeof CONDITION_OPS[number]

export type MutationOp = 'assign' | 'add' | 'subtract' | 'init'
export const MUTATION_OPS: readonly MutationOp[] = ['assign', 'add', 'subtract', 'init']

/** Deterministic RNG injection point for `rand(min,max)` (defaults to Math.random). */
export type RandomSource = () => number

export class ReactiveVarStore {
  private variables = new Map<string, number>()
  private readonly random: RandomSource

  constructor(random: RandomSource = Math.random) {
    this.random = random
  }

  /** Read a variable; absent names read as 0 (manifest convention). */
  get(name: string): number {
    return this.variables.get(name) ?? 0
  }

  /** Unconditional write (host/debug tooling). */
  set(name: string, value: number): void {
    this.variables.set(name, value)
  }

  /** Snapshot of the whole heap (for `{$vf_*}` interpolation / debugging). */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.variables)
  }

  /** Reset the heap. Not called on costume swap — the heap survives `change_cos`. */
  clear(): void {
    this.variables.clear()
  }

  /** Inclusive-integer roll in [min, max], per manifest `"assign rand(20,25)"` semantics. */
  randInt(min: number, max: number): number {
    const lo = Math.ceil(Math.min(min, max))
    const hi = Math.floor(Math.max(min, max))
    return Math.floor(this.random() * (hi - lo + 1)) + lo
  }

  /** True if a single Type 1 guard passes. */
  evaluateCondition(condition: VarFloatCondition): boolean {
    const current = this.get(condition.Name)
    const parsed = parseOpAndValue(condition.Code)
    if (!parsed)
      return false

    switch (parsed.op as ConditionOp) {
      case 'equal': return current === parsed.value
      case 'not_equal': return current !== parsed.value
      case 'greater': return current > parsed.value
      case 'greater_equal': return current >= parsed.value
      case 'less': return current < parsed.value
      case 'lower': return current < parsed.value
      case 'lower_equal': return current <= parsed.value
      default: return false
    }
  }

  /** Execute a single Type 2 mutation. Returns false for unrecognized code (no-op). */
  executeMutation(mutation: VarFloatMutation): boolean {
    const code = mutation.Code.trim()
    const [opToken, ...rest] = code.split(/\s+/)
    const expr = rest.join(' ')
    const current = this.get(mutation.Name)

    switch (opToken as MutationOp) {
      case 'assign': {
        const rand = /^rand\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/i.exec(expr)
        if (rand) {
          this.variables.set(mutation.Name, this.randInt(Number(rand[1]), Number(rand[2])))
          return true
        }
        const value = Number.parseFloat(expr)
        if (Number.isNaN(value))
          return false
        this.variables.set(mutation.Name, value)
        return true
      }
      case 'add': {
        const delta = Number.parseFloat(expr)
        if (Number.isNaN(delta))
          return false
        this.variables.set(mutation.Name, current + delta)
        return true
      }
      case 'subtract': {
        const delta = Number.parseFloat(expr)
        if (Number.isNaN(delta))
          return false
        this.variables.set(mutation.Name, current - delta)
        return true
      }
      case 'init': {
        // `init` = assign-if-absent (flag heap idiom). Existing values are preserved.
        const value = Number.parseFloat(expr)
        if (Number.isNaN(value))
          return false
        if (!this.variables.has(mutation.Name))
          this.variables.set(mutation.Name, value)
        return true
      }
      default:
        return false
    }
  }

  /**
   * Apply an entry's full VarFloat list atomically. Returns true if all guards
   * passed (and mutations were applied); false if any guard failed (no mutation applied).
   */
  applyAll(varFloats: readonly VarFloat[] | undefined): boolean {
    if (!varFloats || varFloats.length === 0)
      return true

    const guards = varFloats.filter((v): v is VarFloatCondition => v.Type === 1)
    const mutations = varFloats.filter((v): v is VarFloatMutation => v.Type === 2)

    for (const guard of guards) {
      if (!this.evaluateCondition(guard))
        return false
    }
    for (const mutation of mutations) {
      this.executeMutation(mutation)
    }
    return true
  }
}

/** Parse `<op> <value>` for conditions. */
function parseOpAndValue(code: string): { op: string, value: number } | null {
  const [opToken, valueToken] = code.trim().split(/\s+/)
  const value = Number.parseFloat(valueToken)
  if (!opToken || Number.isNaN(value))
    return null
  // Normalize a couple of benign aliases that show up in creator packs.
  return { op: opToken.toLowerCase(), value }
}
