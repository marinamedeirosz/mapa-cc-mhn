// Guarda a última planilha importada no IndexedDB deste navegador, para sobreviver a um recarregamento.
// Falhas (modo privado, armazenamento bloqueado) são ignoradas: o app funciona sem isso.
const dbName = 'mapa-cc-mhn'
const storeName = 'planilha'
const key = 'atual'

export interface StoredSpreadsheet {
  file: File
}

export function saveStoredSpreadsheet(value: StoredSpreadsheet): Promise<void> {
  return run('readwrite', (store) => store.put(value, key)).then(ignore, ignore)
}

export function loadStoredSpreadsheet(): Promise<StoredSpreadsheet | undefined> {
  return run<StoredSpreadsheet | undefined>('readonly', (store) => store.get(key)).catch(() => undefined)
}

export function clearStoredSpreadsheet(): Promise<void> {
  return run('readwrite', (store) => store.delete(key)).then(ignore, ignore)
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(dbName, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(storeName)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  try {
    return await new Promise<T>((resolve, reject) => {
      const request = action(db.transaction(storeName, mode).objectStore(storeName))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    db.close()
  }
}

function ignore(): void {}
