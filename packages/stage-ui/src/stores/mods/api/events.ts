import { nanoid } from 'nanoid'

export type EventPriority = 'critical' | 'high' | 'normal' | 'low'

export interface EventEnvelope<TType extends string = string, TPayload = unknown> {
  id: string
  type: TType
  time: number
  priority?: EventPriority
  source?: string
  tags?: string[]
  payload: TPayload
}

export interface EventStream<T> {
  stream: ReadableStream<T>
  emit: (event: T) => void
  close: () => void
}

export function createEvent<TPayload>(
  type: string,
  payload: TPayload,
  options?: { priority?: EventPriority; source?: string; tags?: string[]; id?: string; time?: number },
): EventEnvelope<string, TPayload> {
  return {
    id: options?.id ?? nanoid(),
    payload,
    priority: options?.priority,
    source: options?.source,
    tags: options?.tags,
    time: options?.time ?? Date.now(),
    type,
  }
}

export function createEventStream<T>(): EventStream<T> {
  let controller: ReadableStreamDefaultController<T> | undefined
  const stream = new ReadableStream<T>({
    cancel() {
      controller = undefined
    },
    start(ctrl) {
      controller = ctrl
    },
  })

  return {
    close() {
      controller?.close()
      controller = undefined
    },
    emit(event) {
      controller?.enqueue(event)
    },
    stream,
  }
}
