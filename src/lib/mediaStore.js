const DB_NAME = 'planner-media-db'
const DB_VERSION = 1
const STORE_NAME = 'media'

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Save a media file for a given dateId. Each date can have multiple files. */
export async function saveMedia(dateId, file) {
  const id = `${dateId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const blob = file
  const type = file.type.startsWith('video') ? 'video' : 'image'
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put({ id, dateId, blob, type, name: file.name, createdAt: Date.now() })
    tx.oncomplete = () => resolve(id)
    tx.onerror = () => reject(tx.error)
  })
}

/** Load all media entries for a given dateId. */
export async function loadMedia(dateId) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAll()
    request.onsuccess = () => {
      const all = request.result || []
      resolve(all.filter((item) => item.dateId === dateId).sort((a, b) => a.createdAt - b.createdAt))
    }
    request.onerror = () => reject(request.error)
  })
}

/** Delete a single media entry by id. */
export async function deleteMedia(id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** Load all media entries, grouped by dateId. Returns { [dateId]: [...items] } */
export async function loadAllMedia() {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => {
      const map = {}
      for (const item of request.result || []) {
        if (!map[item.dateId]) map[item.dateId] = []
        map[item.dateId].push(item)
      }
      resolve(map)
    }
    request.onerror = () => reject(request.error)
  })
}
