// Single File Components are compiled by the bundler, not by tsc, so this
// ambient declaration is a shape placeholder and must not restrict the exported
// type. Without it, every `import ... from './*.vue'` in this package reports
// TS2307 "Cannot find module" even though the files exist on disk.
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<Record<string, any>, Record<string, any>, any>
  export default component
}

declare module '@mkkellogg/gaussian-splats-3d' {
  export const DropInViewer: any
  export const Viewer: any
  export const LogLevel: any
  export const SplatMesh: any
  export const SceneFormat: any
}
