/// <reference types="@histoire/plugin-vue/components.d.ts" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

declare module '*.avif' {
  const src: string
  export default src
}

declare module '@mkkellogg/gaussian-splats-3d' {
  export const DropInViewer: any
  export const Viewer: any
  export const LogLevel: any
  export const SplatMesh: any
  export const SceneFormat: any
}
