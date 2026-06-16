const STORAGE_KEY = 'drill-board-data'
const STORAGE_META_KEY = 'drill-board-storage-meta'
const DEFAULT_QUOTA_BYTES = 5 * 1024 * 1024
const WARNING_THRESHOLD = 0.85
const LRU_MIN_KEEP = 1

const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null
const getStringBytes = (str) => {
  if (textEncoder) return textEncoder.encode(str).length
  return str.length * 2
}

const tryCompress = (data) => {
  try {
    const jsonStr = JSON.stringify(data)
    const useCompress = typeof CompressionStream !== 'undefined'
    if (!useCompress) return { compressed: false, payload: jsonStr, size: getStringBytes(jsonStr) }
    return { compressed: false, payload: jsonStr, size: getStringBytes(jsonStr) }
  } catch (e) {
    return { compressed: false, payload: JSON.stringify(data), size: 0 }
  }
}

const readMeta = () => {
  try {
    const raw = localStorage.getItem(STORAGE_META_KEY)
    if (!raw) return { accessLog: {}, evicted: [], totalWrites: 0 }
    return { accessLog: {}, evicted: [], totalWrites: 0, ...JSON.parse(raw) }
  } catch {
    return { accessLog: {}, evicted: [], totalWrites: 0 }
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
    remainingBytes: Math.max(0, DEFAULT_QUOTA_BYTES - used)
  }
}

export const getStorageEvictionLog = () => readMeta().evicted || []

const touchAccess = (scenarioId) => {
  const meta = readMeta()
  meta.accessLog = meta.accessLog || {}
  meta.accessLog[scenarioId] = Date.now()
  writeMeta(meta)
}

export const saveToStorage = (data) => {
  try {
    const { payload, size } = tryCompress(data)
    const info = getStorageInfo()

    if (info.usageRatio >= WARNING_THRESHOLD) {
      const safeSize = Math.floor(DEFAULT_QUOTA_BYTES * (WARNING_THRESHOLD - 0.1))
      const { data: trimmed, evicted } = applyLRU(data, safeSize)
      if (evicted.length > 0) {
        console.warn(`[storage] 容量逼近上限，已LRU淘汰 ${evicted.length} 个旧演练:`, evicted.map(e => e.name).join(', '))
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
      return { success: true, evicted, trimmed: true }
    }

    localStorage.setItem(STORAGE_KEY, payload)
    const meta = readMeta()
    meta.totalWrites = (meta.totalWrites || 0) + 1
    writeMeta(meta)
    return { success: true, size, evicted: [], trimmed: false }
  } catch (e) {
    if (e && (e.name === 'QuotaExceededError' || /quota|storage/i.test(e.message || ''))) {
      try {
        const safeSize = Math.floor(DEFAULT_QUOTA_BYTES * 0.6)
        const { data: trimmed, evicted } = applyLRU(data, safeSize)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed))
        console.warn(`[storage] QuotaExceededError，LRU 紧急淘汰 ${evicted.length} 个记录`)
        return { success: true, evicted, trimmed: true, quotaHit: true }
      } catch (e2) {
        console.error('[storage] 紧急淘汰后仍保存失败:', e2)
        return { success: false, error: e2.message, evicted: [], trimmed: false }
      }
    }
    console.error('[storage] 保存失败:', e)
    return { success: false, error: e.message, evicted: [], trimmed: false }
  }
}

export const loadFromStorage = () => {
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

export const clearStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(STORAGE_META_KEY)
    return true
  } catch { return false }
}
