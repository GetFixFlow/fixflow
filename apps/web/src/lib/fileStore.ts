/**
 * Photos waiting to be sent are too big for localStorage, so they are kept in the browser's file
 * database (IndexedDB) until they have been uploaded. The queue refers to them by key.
 * They are stored as plain bytes plus their type rather than as Blobs, which some browsers
 * (older Safari) have been unreliable at storing.
 */
interface Stored {
  bytes: ArrayBuffer
  type: string
}

const toBytes = (blob: Blob): Promise<ArrayBuffer> =>
  blob.arrayBuffer
    ? blob.arrayBuffer()
    : new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as ArrayBuffer)
        reader.onerror = () => reject(reader.error)
        reader.readAsArrayBuffer(blob)
      })

const DB_NAME = 'fixflow-offline-files'
const STORE = 'files'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('This browser cannot keep files on the device.'))
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the device file store.'))
  })
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const request = work(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error ?? new Error('Could not use the device file store.'))
      tx.onabort = () => reject(tx.error ?? new Error('The device is out of space for this file.'))
    })
  } finally {
    db.close()
  }
}

export const fileStore = {
  put: async (key: string, file: Blob) => {
    const stored: Stored = { bytes: await toBytes(file), type: file.type }
    await run('readwrite', (s) => s.put(stored, key))
  },
  get: async (key: string) => {
    const stored = await run<Stored | undefined>('readonly', (s) => s.get(key))
    return stored ? new Blob([stored.bytes], { type: stored.type }) : undefined
  },
  delete: (key: string) => run('readwrite', (s) => s.delete(key)).then(() => undefined),
}
