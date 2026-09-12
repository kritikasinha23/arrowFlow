import { randomUUID } from 'node:crypto'
import { displayNameFromInstallId, isUglyGeneratedName } from './names.ts'
import type { StorageLike } from './types.ts'

const INSTALL_KEY = 'arrowflow.installId'
const DISPLAY_NAME_KEY = 'arrowflow.displayName'
const CUSTOM_KEY = 'arrowflow.nameCustomized'

const memory = new Map<string, string>()

const memoryStorage: StorageLike = {
  getItem(key) {
    return memory.get(key) ?? null
  },
  setItem(key, value) {
    memory.set(key, value)
  },
}

function resolveStorage(storage?: StorageLike): StorageLike {
  return storage ?? memoryStorage
}

export function getOrCreateInstallId(storage?: StorageLike): string {
  const store = resolveStorage(storage)
  const existing = store.getItem(INSTALL_KEY)
  if (existing) return existing
  const id = randomUUID()
  store.setItem(INSTALL_KEY, id)
  return id
}

export function generateDisplayName(storage?: StorageLike, installId?: string): string {
  const store = resolveStorage(storage)
  const existing = store.getItem(DISPLAY_NAME_KEY)
  const customized = store.getItem(CUSTOM_KEY) === '1'
  if (existing && (customized || !isUglyGeneratedName(existing))) return existing
  const id = installId ?? store.getItem(INSTALL_KEY) ?? randomUUID()
  const name = displayNameFromInstallId(id)
  store.setItem(DISPLAY_NAME_KEY, name)
  return name
}

export function createMemoryStorage(seed: Record<string, string> = {}): StorageLike {
  const data = new Map(Object.entries(seed))
  return {
    getItem(key) {
      return data.get(key) ?? null
    },
    setItem(key, value) {
      data.set(key, value)
    },
  }
}
