/**
 * @proj-airi/live2d-runtime — headless Live2D DSL & VarFloats state engine.
 *
 * Framework-agnostic and renderer-agnostic: no PIXI, Vue, DOM, or WebGL imports.
 * The host injects output ports (see `ports.ts`) which the DSL VM drives.
 */

export * from './dsl/command-parser'
export * from './dsl/interpreter'
export * from './dsl/selector'
export * from './dsl/template'
export * from './dsl/types'
export * from './dsl/var-store'
export * from './ports'
