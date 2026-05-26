import { useLogger } from '@guiiai/logg'
import type { WebSocketEventOptionalSource } from '@proj-airi/server-sdk'
import { ContextUpdateStrategy, Client as ServerClient } from '@proj-airi/server-sdk'
import { nanoid } from 'nanoid'
import type { Events } from './types'

export class Client {
  private client: ServerClient<Events> | null = null

  constructor(private token: string = '') {}

  setToken(token: string): void {
    this.token = token
  }

  async connect(): Promise<boolean> {
    try {
      this.client = new ServerClient<Events>({
        name: 'proj-airi:plugin-vscode',
        token: this.token,
        url: 'ws://127.0.0.1:6121',
      })
      await this.client.connect()
      useLogger().log('AIRI connected to Server Channel')
      return true
    } catch (error) {
      useLogger().errorWithError('Failed to connect to AIRI Server Channel:', error)
      return false
    }
  }

  disconnect(): void {
    if (this.client) {
      this.client.close()
      this.client = null
      useLogger().log('AIRI disconnected')
    }
  }

  private async send(event: WebSocketEventOptionalSource<Events>): Promise<void> {
    if (!this.client) {
      useLogger().warn('Cannot send event: not connected to AIRI Server Channel')
      return
    }

    try {
      await this.client.connect()
      this.client.send(event)
    } catch (error) {
      useLogger().errorWithError('Failed to send event to AIRI:', error)
    }
  }

  async replaceContext(context: string): Promise<void> {
    const id = nanoid()
    this.send({
      data: { contextId: id, id, strategy: ContextUpdateStrategy.ReplaceSelf, text: context },
      type: 'context:update',
    })
  }

  async appendContext(context: string): Promise<void> {
    const id = nanoid()
    this.send({
      data: { contextId: id, id, strategy: ContextUpdateStrategy.AppendSelf, text: context },
      type: 'context:update',
    })
  }

  isConnected(): boolean {
    return !!this.client
  }
}
