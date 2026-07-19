import type { Nan0KernelState, Nan0StateStore } from '../types'

export class InMemoryStateStore implements Nan0StateStore {
  private state: Nan0KernelState | null = null

  async load(): Promise<Nan0KernelState | null> {
    return this.state ? structuredClone(this.state) : null
  }

  async save(state: Nan0KernelState): Promise<Nan0KernelState> {
    this.state = structuredClone(state)
    return structuredClone(this.state)
  }
}
