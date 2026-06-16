const STORAGE_KEY = 'drill-board-data'
const STORAGE_META_KEY = 'drill-board-storage-meta'
const CONFIG_KEY = 'drill-board-runtime-config'
const DEFAULT_QUOTA_BYTES = 5 * 1024 * 1024
const WARNING_THRESHOLD = 0.85
const LRU_MIN_KEEP = 1

const IDB_NAME = 'DrillBoardDB'
const IDB_VERSION = 1
const IDB_STORE_MAIN = 'scenarios'
const IDB_STORE_META = 'meta'
const IDB_STORE_CONFIG = 'config'

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
const getStringBytes = (str) => {
  if (textEncoder) return textEncoder.encode(str).length
  return str.length * 2
}

const tryCompress = (data) => {
  try {
    const jsonStr = JSON.stringify(data)
    return { compressed: false, payload: jsonStr, size: getStringBytes(jsonStr) }
  } catch (e) {
    return { compressed: false, payload: JSON.stringify(data), size: 0 }
  }
}

const readMeta = () => {
  try {
    const raw = localStorage.getItem(STORAGE_META_KEY)
    if (!raw) return { accessLog: {}, evicted: [], totalWrites: 0, idbFallbackUsed: false }
    return { accessLog: {}, evicted: [], totalWrites: 0, idbFallbackUsed: false, ...JSON.parse(raw) }
  } catch {
    return { accessLog: {}, evicted: [], totalWrites: 0, idbFallbackUsed: false }
  }
}

const writeMeta = (meta) => {
  try { localStorage.setItem(STORAGE_META_KEY, JSON.stringify(meta)) } catch {}
}

const applyLRU = (data, targetSizeBytes) => {
  if (!Array.isArray(data) || data.length <= LRU_MIN_KEEP) return { data, evicted: [] }
  const meta = readMeta()
  const accessLog = meta.accessLog || {}
  const withAccess = data.map(s => ({
    id: s.id,
    obj: s,
    lastAccess: accessLog[s.id] || 0,
    size: getStringBytes(JSON.stringify(s))
  })).sort((a, b) => a.lastAccess - b.lastAccess)

  let currentSize = withAccess.reduce((sum, x) => sum + x.size, 0)
  const evicted = []
  let i = 0
  while (currentSize > targetSizeBytes && withAccess.length - i > LRU_MIN_KEEP) {
    currentSize -= withAccess[i].size
    evicted.push({ id: withAccess[i].id, name: withAccess[i].obj?.name, evictedAt: Date.now() })
    i++
  }

  const kept = withAccess.slice(i).map(x => x.obj)
  if (evicted.length > 0) {
    writeMeta({ ...meta, evicted: [...(meta.evicted || []), ...evicted].slice(-50) })
  }
  return { data: kept, evicted }
}

/* ============================================
   IndexedDB Fallback 实现
   ============================================ */

let idbDbPromise = null
const idbOpen = () => {
  if (idbDbPromise) return idbDbPromise
  idbDbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION)
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(IDB_STORE_MAIN)) db.createObjectStore(IDB_STORE_MAIN, { keyPath: 'id' })
        if (!db.objectStoreNames.contains(IDB_STORE_META)) db.createObjectStore(IDB_STORE_META, { keyPath: 'k' })
        if (!db.objectStoreNames.contains(IDB_STORE_CONFIG)) db.createObjectStore(IDB_STORE_CONFIG, { keyPath: 'k' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    } catch (e) { reject(e) }
  })
  return idbDbPromise
}

const idbTx = async (storeName, mode, fn) => {
  const db = await idbOpen()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    try {
      const result = fn(store)
      tx.oncomplete = () => resolve(result instanceof IDBRequest ? result.result : result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    } catch (e) { reject(e) }
  })
}

const idbSupported = () => {
  try { return typeof indexedDB !== 'undefined' } catch { return false }
}

const idbSaveScenarios = async (scenarios) => {
  await idbTx(IDB_STORE_MAIN, 'readwrite', (store) => {
    store.clear()
    scenarios.forEach(s => store.put(s))
  })
  return { ok: true, count: scenarios.length }
}

const idbLoadScenarios = async () => {
  const db = await idbOpen()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_MAIN, 'readonly')
    const store = tx.objectStore(IDB_STORE_MAIN)
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error)
  })
}

const idbSaveConfig = async (cfg) => {
  await idbTx(IDB_STORE_CONFIG, 'readwrite', (store) => {
    store.put({ k: CONFIG_KEY, cfg, savedAt: Date.now() })
  })
  return { ok: true }
}

const idbLoadConfig = async () => {
  try {
    const result = await idbTx(IDB_STORE_CONFIG, 'readonly', (store) => store.get(CONFIG_KEY))
    return result?.cfg || null
  } catch { return null }
}

/* ============================================
   统一对外 API
   ============================================ */

let useIdbFallback = false
export const setStorageMode = (mode /* 'auto' | 'localStorage' | 'indexeddb' */) => {
  if (mode === 'indexeddb') useIdbFallback = idbSupported()
  else if (mode === 'localStorage') useIdbFallback = false
  else useIdbFallback = false
}
export const getStorageMode = () => (useIdbFallback ? 'indexeddb' : 'localStorage')

export const getStorageInfo = () => {
  let used = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) used += getStringBytes(localStorage.getItem(key) || '') + getStringBytes(key)
    }
  } catch {}
  return {
    usedBytes: used,
    quotaBytes: DEFAULT_QUOTA_BYTES,
    usageRatio: used / DEFAULT_QUOTA_BYTES,
    isNearQuota: used / DEFAULT_QUOTA_BYTES >= WARNING_THRESHOLD,
    isOverQuota: used >= DEFAULT_QUOTA_BYTES,
    remainingBytes: Math.max(0, DEFAULT_QUOTA_BYTES - used),
    idbAvailable: idbSupported(),
    idbActive: useIdbFallback
  }
}

export const getStorageEvictionLog = () => readMeta().evicted || []

const touchAccess = (scenarioId) => {
  const meta = readMeta()
  meta.accessLog = meta.accessLog || {}
  meta.accessLog[scenarioId] = Date.now()
  writeMeta(meta)
}

export const saveToStorage = async (data, opts = {}) => {
  const useFallback = opts.forceIdb || useIdbFallback || !idbSupported() ? useIdbFallback : false

  if (useFallback && idbSupported()) {
    try {
      const meta = readMeta()
      meta.idbFallbackUsed = true
      meta.totalWrites = (meta.totalWrites || 0) + 1
      writeMeta(meta)
      await idbSaveScenarios(Array.isArray(data) ? data : [])
      return { success: true, evicted: [], trimmed: false, backend: 'indexeddb' }
    } catch (e) {
      return { success: false, error: e.message || 'IDB 保存失败', backend: 'indexeddb' }
    }
  }

  try {
    const { payload, size } = tryCompress(data)
    const info = getStorageInfo()

    if (info.usageRatio >= WARNING_THRESHOLD) {
      const safeSize = Math.floor(DEFAULT_QUOTA_BYTES * (WARNING_THRESHOLD - 0.1))
      const { data: trimmed, evicted } = applyLRU(data, safeSize)
      if (evicted.length > 0) {
        console.warn(`[storage] 容量逼近上限，已LRU淘汰 ${evicted.length} 个旧演练`)
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
      return { success: true, evicted, trimmed: true, backend: 'localStorage' }
    }

    localStorage.setItem(STORAGE_KEY, payload)
    const meta = readMeta()
    meta.totalWrites = (meta.totalWrites || 0) + 1
    writeMeta(meta)
    return { success: true, size, evicted: [], trimmed: false, backend: 'localStorage' }
  } catch (e) {
    if (e && (e.name === 'QuotaExceededError' || /quota|storage/i.test(e.message || ''))) {
      if (idbSupported() && (opts.autoFallback !== false)) {
        console.warn('[storage] localStorage 配额耗尽，自动切换到 IndexedDB')
        useIdbFallback = true
        try {
          const meta = readMeta()
          meta.idbFallbackUsed = true
          writeMeta(meta)
          await idbSaveScenarios(Array.isArray(data) ? data : [])
          return { success: true, evicted: [], trimmed: false, backend: 'indexeddb', autoSwitched: true }
        } catch (e2) {
          return { success: false, error: e2.message, backend: 'indexeddb' }
        }
      }
      try {
        const safeSize = Math.floor(DEFAULT_QUOTA_BYTES * 0.6)
        const { data: trimmed, evicted } = applyLRU(data, safeSize)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
        console.warn(`[storage] QuotaExceededError，LRU 紧急淘汰 ${evicted.length} 个记录`)
        return { success: true, evicted, trimmed: true, quotaHit: true, backend: 'localStorage' }
      } catch (e2) {
        console.error('[storage] 紧急淘汰后仍保存失败:', e2)
        return { success: false, error: e2.message, evicted: [], trimmed: false }
      }
    }
    console.error('[storage] 保存失败:', e)
    return { success: false, error: e.message, evicted: [], trimmed: false }
  }
}

export const loadFromStorage = async () => {
  if (useIdbFallback && idbSupported()) {
    try {
      const list = await idbLoadScenarios()
      if (list && list.length > 0) return list
    } catch (_) { /* fallthrough to localStorage */ }
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Array.isArray(data) && data.length > 0) {
      touchAccess(data[0].id)
    }
    return data
  } catch (e) {
    console.error('[storage] 加载失败:', e)
    return null
  }
}

export const clearStorage = async () => {
  let ok = true
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_META_KEY)
  } catch { ok = false }
  if (idbSupported()) {
    try {
      await idbTx(IDB_STORE_MAIN, 'readwrite', s => s.clear())
      await idbTx(IDB_STORE_CONFIG, 'readwrite', s => s.clear())
    } catch { ok = false }
  }
  useIdbFallback = false
  return ok
}

/* ============================================
   Runtime Config 持久化支持
   ============================================ */

export const getConfig = async () => {
  try {
    if (useIdbFallback && idbSupported()) {
      const fromIdb = await idbLoadConfig()
      if (fromIdb) return fromIdb
    }
    const raw = localStorage.getItem(CONFIG_KEY)
    if (raw) return JSON.parse(raw)
    return null
  } catch { return null }
}

export const setConfig = async (cfg) => {
  let ok = false
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg))
    ok = true
  } catch { /* try idb only */ }
  try {
    if (idbSupported()) await idbSaveConfig(cfg)
    ok = true
  } catch { /* ignore */ }
  return ok
}
