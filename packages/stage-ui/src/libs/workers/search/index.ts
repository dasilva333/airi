import searchWorkerUrl from './search.worker?worker&url'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>()

export async function getSearchWorker() {
  if (!worker) {
    worker = new Worker(searchWorkerUrl, { type: 'module' })
    worker.addEventListener('message', (e) => {
      const { id, type, results, snapshot, count, error } = e.data
      const promise = pending.get(id)
      if (!promise) return

      if (type === 'error') {
        promise.reject(new Error(error))
      } else {
        switch (type) {
          case 'results':
            promise.resolve(results)
            break
          case 'snapshot':
            promise.resolve(snapshot)
            break
          case 'indexed':
            promise.resolve(count)
            break
          default:
            promise.resolve(e.data)
        }
      }
      pending.delete(id)
    })
  }
  return worker
}

async function callWorker(type: string, payload?: any): Promise<any> {
  const w = await getSearchWorker()
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { reject, resolve })
    w.postMessage({ id, payload, type })
  })
}

export const searchWorker = {
  index: (documents: any[]) => callWorker('index', { documents }),
  init: (snapshot?: any) => callWorker('init', { snapshot }),
  persist: () => callWorker('persist'),
  search: (query: string, limit?: number) => callWorker('search', { limit, query }),
}
