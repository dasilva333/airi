import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { copyFile, mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { safeDestr } from 'destr'
import { app } from 'electron'
import { throttle } from 'es-toolkit'
import type { BaseIssue, BaseSchema, InferIssue, InferOutput } from 'valibot'
import { safeParse } from 'valibot'

type ConfigStatus = 'ok' | 'missing' | 'invalid' | 'read-error'

export interface ConfigDiagnostics<T> {
  status: ConfigStatus
  path: string
  issues?: BaseIssue<unknown>[]
  error?: unknown
  raw?: string
  healed?: boolean
  value?: T
}

export interface CreateConfigOptions<T> {
  default?: T
  autoHeal?: boolean
  onValidationFailure?: (diagnostics: ConfigDiagnostics<T>) => void
  onReadError?: (diagnostics: ConfigDiagnostics<T>) => void
}

const persistenceMap = new Map<string, unknown>()
const diagnosticsMap = new Map<string, ConfigDiagnostics<unknown>>()
const configRegistry = new Set<Config<any>>()

function getUserDataPath() {
  try {
    return app.getPath('userData')
  } catch (e) {
    // Fallback or early access might fail on some platforms/versions if called too early
    console.error('[Persistence] Failed to get userData path:', e)
    return ''
  }
}

function createConfigPath(namespace: string, filename: string) {
  const path = join(getUserDataPath(), `${namespace}-${filename}`)
  return path
}

async function ensureConfigDirectory(path: string) {
  await mkdir(dirname(path), { recursive: true })
}

type PersistedSchema = BaseSchema<unknown, unknown, BaseIssue<unknown>>

function parseWithSchema<TSchema extends PersistedSchema>(
  raw: string,
  schema: TSchema,
): { value?: InferOutput<TSchema>; issues?: InferIssue<TSchema>[] } {
  const parsed = safeDestr<unknown>(raw)
  const result = safeParse(schema, parsed)
  if (result.success) {
    return { value: result.output }
  }
  return { issues: result.issues }
}

export interface Config<TSchema extends PersistedSchema> {
  setup: () => ConfigDiagnostics<InferOutput<TSchema>>
  get: () => InferOutput<TSchema> | undefined
  update: (newData: InferOutput<TSchema>) => void
  flush: () => void
  getDiagnostics: () => ConfigDiagnostics<InferOutput<TSchema>> | undefined
}

export function createConfig<TSchema extends PersistedSchema>(
  namespace: string,
  filename: string,
  schema: TSchema,
  options?: CreateConfigOptions<InferOutput<TSchema>>,
): Config<TSchema> {
  const key = `${namespace}:${filename}`
  const autoHeal = options?.autoHeal ?? Boolean(options?.default)

  const configPath = () => createConfigPath(namespace, filename)

  const recordDiagnostics = (diagnostics: ConfigDiagnostics<InferOutput<TSchema>>) => {
    diagnosticsMap.set(key, diagnostics)
    return diagnostics
  }

  let queuedSave = Promise.resolve()
  let saveSequence = 0

  const persistToDisk = async () => {
    try {
      const path = configPath()
      await ensureConfigDirectory(path)
      const sequence = ++saveSequence
      const tmpPath = `${path}.${process.pid}.${sequence}.tmp`
      await writeFile(tmpPath, JSON.stringify(persistenceMap.get(key)))
      await rename(tmpPath, path)
    } catch (error) {
      console.error('Failed to save config', error)
    }
  }

  const save = throttle(() => {
    queuedSave = queuedSave.catch(() => {}).then(async () => persistToDisk())
  }, 250)

  const writeHealingConfig = async (value: InferOutput<TSchema>) => {
    try {
      const path = configPath()
      await ensureConfigDirectory(path)
      if (existsSync(path)) {
        await copyFile(path, `${path}.bak`).catch((err) =>
          console.warn('Failed to create backup for config:', path, err),
        )
      }
      await writeFile(path, JSON.stringify(value))
      return true
    } catch (error) {
      console.error('Failed to heal config', error)
      return false
    }
  }

  const setup = () => {
    const path = configPath()
    if (!existsSync(path)) {
      const diagnostics = recordDiagnostics({
        path,
        status: 'missing',
        value: options?.default,
      })
      persistenceMap.set(key, options?.default)
      return diagnostics
    }

    try {
      const raw = readFileSync(path, { encoding: 'utf-8' })
      const parsed = parseWithSchema(raw, schema)
      if (parsed.value !== undefined) {
        // console.log(`[Persistence] Loaded config from ${path}:`, parsed.value)
        const diagnostics = recordDiagnostics({
          path,
          status: 'ok',
          value: parsed.value,
        })
        persistenceMap.set(key, parsed.value)
        return diagnostics
      }

      console.warn(`[Persistence] Invalid config at ${path}. Issues:`, parsed.issues)
      const fallback = options?.default
      const diagnostics = recordDiagnostics({
        issues: parsed.issues,
        path,
        raw,
        status: 'invalid',
        value: fallback,
      })
      options?.onValidationFailure?.(diagnostics)
      persistenceMap.set(key, fallback)

      if (autoHeal && fallback !== undefined) {
        void writeHealingConfig(fallback).then((healed) => {
          if (healed) {
            diagnosticsMap.set(key, { ...diagnostics, healed })
          }
        })
      }
      return diagnostics
    } catch (error) {
      const fallback = options?.default
      const diagnostics = recordDiagnostics({
        error,
        path,
        status: 'read-error',
        value: fallback,
      })
      options?.onReadError?.(diagnostics)
      persistenceMap.set(key, fallback)
      return diagnostics
    }
  }

  const update = (newData: InferOutput<TSchema>) => {
    // console.log(`[Persistence] Updating config ${key}. New data:`, newData)
    persistenceMap.set(key, newData)
    save()
  }

  const flush = () => {
    const path = configPath()
    try {
      const data = persistenceMap.get(key)
      if (data !== undefined) {
        // console.log(`[Persistence] Sync flushing config to ${path}`)
        writeFileSync(path, JSON.stringify(data))
      }
    } catch (error) {
      console.error(`[Persistence] Failed to flush config to ${path}`, error)
    }
  }

  const get = () => persistenceMap.get(key) as InferOutput<TSchema> | undefined

  const getDiagnostics = () => diagnosticsMap.get(key) as ConfigDiagnostics<InferOutput<TSchema>> | undefined

  const configInstance: Config<TSchema> = {
    flush,
    get,
    getDiagnostics,
    setup,
    update,
  }

  configRegistry.add(configInstance)

  return configInstance
}

export function flushAllConfigs() {
  // console.log(`[Persistence] Flushing all ${configRegistry.size} configs...`)
  for (const config of configRegistry) {
    config.flush()
  }
}
