// Back-compat shim: the canonical contract now lives in `./transport` (aligned
// with upstream dasilva333/airi). Re-export so existing imports of
// `@proj-airi/stage-shared/transport-adapter` keep resolving.
export * from './transport'
