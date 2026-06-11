// Minimal IndexedDB key/value store used to snapshot the SQLite database
// (exported bytes) so the in-memory DB survives page reloads on GitHub Pages,
// where OPFS / cross-origin isolation isn't available.

const DB_NAME = 'foobar'
const STORE = 'kv'
const SNAPSHOT_KEY = 'sqlite-snapshot'

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const idb = await openIdb()
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  } finally {
    idb.close()
  }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const idb = await openIdb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    idb.close()
  }
}

async function idbDelete(key: string): Promise<void> {
  const idb = await openIdb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = idb.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    idb.close()
  }
}

export async function loadSnapshot(): Promise<Uint8Array | null> {
  try {
    const value = await idbGet<Uint8Array | ArrayBuffer>(SNAPSHOT_KEY)
    if (!value) return null
    return value instanceof Uint8Array ? value : new Uint8Array(value)
  } catch {
    return null
  }
}

export async function saveSnapshot(bytes: Uint8Array): Promise<void> {
  // Copy out of any shared buffer before handing to IndexedDB's structured clone.
  await idbSet(SNAPSHOT_KEY, bytes.slice())
}

export async function clearSnapshot(): Promise<void> {
  try {
    await idbDelete(SNAPSHOT_KEY)
  } catch {
    // ignore
  }
}
