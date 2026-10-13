import { defineInvokeEventa } from '@moeru/eventa'

export interface SandboxCompileRequest {
  files: Record<string, string>
  args: string[]
}

export interface SandboxCompileResult {
  stdout: string
  stderr: string
  exitCode: number
  emittedFiles: Record<string, string>
}

export const electronSandboxCompileTypeScript = defineInvokeEventa<
  SandboxCompileResult,
  SandboxCompileRequest
>('eventa:invoke:electron:sandbox:compile-typescript')
