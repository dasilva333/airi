export interface StreamController<T> {
  stream: ReadableStream<T>
  write: (value: T) => void
  close: () => void
  error: (err: unknown) => void
  isClosed: () => boolean
}

export function createPushStream<T>(): StreamController<T> {
  let closed = false
  let controller: ReadableStreamDefaultController<T> | null = null

  const stream = new ReadableStream<T>({
    cancel() {
      closed = true
    },
    start(ctrl) {
      controller = ctrl
    },
  })

  return {
    close() {
      if (!controller || closed) return
      closed = true
      controller.close()
    },
    error(err) {
      if (!controller || closed) return
      closed = true
      controller.error(err)
    },
    isClosed() {
      return closed
    },
    stream,
    write(value) {
      if (!controller || closed) return
      controller.enqueue(value)
    },
  }
}

export async function readStream<T>(stream: ReadableStream<T>, handler: (value: T) => Promise<void> | void) {
  const reader = stream.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      await handler(value as T)
    }
  } finally {
    reader.releaseLock()
  }
}
