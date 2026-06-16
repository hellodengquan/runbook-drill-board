import { useState, useEffect } from 'react'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const syncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error',
  CONFLICT: 'conflict',
  OFFLINE: 'offline',
  RETRYING: 'retrying'
}

export const conflictResolution = {
  USE_LOCAL: 'use_local',
  USE_REMOTE: 'use_remote',
  MERGE: 'merge',
  LOCAL_WINS: 'use_local',
  REMOTE_WINS: 'use_remote'
}

const OFFLINE_QUEUE_KEY = 'drill-board-offline-queue'
const REMOTE_BACKUP_KEY = 'drill-board-remote-backup'
const VERSION_COUNTER_KEY = 'drill-board-version-counter'

const readOfflineQueue = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
const writeOfflineQueue = (q) => {
  try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(q)) } catch {}
}

const nextVersion = () => {
  try {
    const cur = parseInt(localStorage.getItem(VERSION_COUNTER_KEY) || '0', 10) + 1
    localStorage.setItem(VERSION_COUNTER_KEY, String(cur))
    return cur
  } catch {
    return Date.now()
  }
}

const readRemote = () => {
  try {
    const raw = localStorage.getItem(REMOTE_BACKUP_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

const writeRemote = (data, version, syncedAt) => {
  try {
    localStorage.setItem(REMOTE_BACKUP_KEY, JSON.stringify({
      data, version, syncedAt, checksum: JSON.stringify(data).length
    }))
    return true
  } catch { return false }
}

const mergeScenarios = (localData, remoteData) => {
  const merged = []
  const allIds = new Set([
    ...(localData || []).map(s => s.id),
    ...(remoteData || []).map(s => s.id)
  ])
  allIds.forEach(id => {
    const l = (localData || []).find(s => s.id === id)
    const r = (remoteData || []).find(s => s.id === id)
    if (l && r) {
      const lUpdated = l.updatedAt || l.date || 0
      const rUpdated = r.updatedAt || r.date || 0
      merged.push(lUpdated >= rUpdated ? l : r)
    } else {
      merged.push(l || r)
    }
  })
  return merged
}

const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30000
const MAX_RETRIES = 5

export class SyncService {
  constructor() {
    this.subscribers = new Set()
    this.status = syncStatus.IDLE
    this.lastSyncTime = null
    this.error = null
    this.version = 1
    this.pendingConflicts = []
    this.retryCount = 0
    this.offlineQueue = readOfflineQueue()
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this._retryTimer = null
    this._bindNetworkEvents()
  }

  _bindNetworkEvents() {
    if (typeof window === 'undefined') return
    window.addEventListener('online', () => {
      this.isOnline = true
      this._drainOfflineQueue()
    })
    window.addEventListener('offline', () => {
      this.isOnline = false
      this.status = syncStatus.OFFLINE
      this.notify()
    })
  }

  subscribe(callback) {
    this.subscribers.add(callback)
    callback(this.getStatus())
    return () => this.subscribers.delete(callback)
  }

  notify() {
    const payload = this.getStatus()
    this.subscribers.forEach((callback) => callback(payload))
  }

  getStatus() {
    return {
      status: this.status,
      lastSyncTime: this.lastSyncTime,
      error: this.error,
      version: this.version,
      retryCount: this.retryCount,
      pendingConflicts: this.pendingConflicts.length,
      offlineQueueSize: this.offlineQueue.length,
      isOnline: this.isOnline
    }
  }

  async _simulateRequest(failChance = 0.05, minMs = 500, jitterMs = 500) {
    await delay(minMs + Math.random() * jitterMs)
    if (Math.random() < failChance) {
      throw new Error('网络连接失败，请稍后重试')
    }
    return true
  }

  _scheduleRetry = (operation, payload, attempt = 1) => {
    if (attempt > MAX_RETRIES) {
      this.status = syncStatus.ERROR
      this.error = `已达最大重试次数(${MAX_RETRIES})，已加入离线队列`
      this.offlineQueue.push({ op: operation.name, payload, attempt, failedAt: Date.now() })
      writeOfflineQueue(this.offlineQueue)
      this.notify()
      return Promise.resolve({ success: false, error: this.error, queued: true })
    }

    this.status = syncStatus.RETRYING
    this.retryCount = attempt
    this.notify()

    const backoff = Math.min(BACKOFF_BASE_MS * Math.pow(2, attempt - 1), BACKOFF_MAX_MS) + Math.random() * 200

    return new Promise((resolve) => {
      this._retryTimer = setTimeout(async () => {
        try {
          const result = await operation.call(this, payload, attempt)
          resolve(result)
        } catch (e) {
          resolve(this._scheduleRetry(operation, payload, attempt + 1))
        }
      }, backoff)
    })
  }

  async push(data, attempt = 0) {
    if (!this.isOnline) {
      this.offlineQueue.push({ op: 'push', payload: { data, stubVersion: nextVersion() }, queuedAt: Date.now() })
      writeOfflineQueue(this.offlineQueue)
      this.status = syncStatus.OFFLINE
      this.notify()
      return { success: true, offline: true, queued: true }
    }

    this.status = syncStatus.SYNCING
    this.error = null
    this.notify()

    try {
      await this._simulateRequest(attempt > 0 ? 0.02 : 0.05)

      const remote = readRemote()
      const localVersion = this.version
      const remoteVersion = remote?.version || 0

      if (remote && remoteVersion > localVersion) {
        this.status = syncStatus.CONFLICT
        this.pendingConflicts.push({
          localVersion,
          remoteVersion,
          localData: data,
          remoteData: remote.data,
          reportedAt: Date.now()
        })
        this.notify()
        return {
          success: false,
          conflict: true,
          localVersion,
          remoteVersion,
          options: [conflictResolution.USE_LOCAL, conflictResolution.USE_REMOTE, conflictResolution.MERGE]
        }
      }

      const newVersion = nextVersion()
      const syncedAt = new Date().toISOString()
      const written = writeRemote(data, newVersion, syncedAt)
      if (!written) throw new Error('远程存储写入失败')

      this.version = newVersion
      this.retryCount = 0
      this.status = syncStatus.SUCCESS
      this.lastSyncTime = syncedAt
      this.notify()
      return { success: true, syncedAt, version: newVersion }
    } catch (error) {
      return this._scheduleRetry(this.push, data, (attempt || 0) + 1)
    }
  }

  async resolveConflict(conflictIndex = 0, resolution = conflictResolution.MERGE, overrideData = null) {
    const conflict = this.pendingConflicts[conflictIndex]
    if (!conflict) return { success: false, error: '无待处理冲突' }

    let resolvedData
    switch (resolution) {
      case conflictResolution.USE_LOCAL:
        resolvedData = overrideData || conflict.localData
        break
      case conflictResolution.USE_REMOTE:
        resolvedData = conflict.remoteData
        break
      case conflictResolution.MERGE:
      default:
        resolvedData = mergeScenarios(conflict.localData, conflict.remoteData)
    }

    this.pendingConflicts.splice(conflictIndex, 1)

    const newVersion = nextVersion()
    const syncedAt = new Date().toISOString()
    writeRemote(resolvedData, newVersion, syncedAt)

    this.version = newVersion
    this.status = syncStatus.SUCCESS
    this.lastSyncTime = syncedAt
    this.notify()
    return { success: true, syncedAt, version: newVersion, data: resolvedData, resolution }
  }

  async pull(attempt = 0) {
    if (!this.isOnline) {
      this.status = syncStatus.OFFLINE
      this.notify()
      return { success: false, offline: true, data: null }
    }

    this.status = syncStatus.SYNCING
    this.error = null
    this.notify()

    try {
      await this._simulateRequest(0.03, 300, 300)
      const remote = readRemote()
      this.retryCount = 0
      this.status = syncStatus.SUCCESS
      this.lastSyncTime = new Date().toISOString()
      this.notify()
      return {
        success: true,
        data: remote?.data || null,
        version: remote?.version || 0,
        syncedAt: this.lastSyncTime
      }
    } catch (error) {
      return this._scheduleRetry(this.pull, null, (attempt || 0) + 1)
    }
  }

  async _drainOfflineQueue() {
    if (this.offlineQueue.length === 0) return
    this.status = syncStatus.RETRYING
    this.notify()
    const queue = [...this.offlineQueue]
    const processed = []
    for (const item of queue) {
      if (item.op === 'push') {
        const res = await this.push(item.payload.data)
        if (res.success && !res.queued) processed.push(item)
      }
    }
    if (processed.length > 0) {
      this.offlineQueue = this.offlineQueue.filter(x => !processed.includes(x))
      writeOfflineQueue(this.offlineQueue)
    }
    if (this.status === syncStatus.RETRYING) {
      this.status = syncStatus.IDLE
      this.notify()
    }
  }

  flushOfflineQueue() {
    return this._drainOfflineQueue()
  }

  clearOfflineQueue() {
    const cleared = this.offlineQueue.length
    this.offlineQueue = []
    writeOfflineQueue(this.offlineQueue)
    this.notify()
    return cleared
  }

  async deleteRemote() {
    try {
      localStorage.removeItem(REMOTE_BACKUP_KEY)
      localStorage.removeItem(VERSION_COUNTER_KEY)
      this.version = 1
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  destroy() {
    if (this._retryTimer) clearTimeout(this._retryTimer)
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this._drainOfflineQueue)
    }
  }
}

export const syncService = new SyncService()

export const useSync = () => {
  const [syncState, setSyncState] = useState(syncService.getStatus())

  useEffect(() => {
    return syncService.subscribe(setSyncState)
  }, [])

  const syncData = async (data) => syncService.push(data)
  const fetchData = async () => syncService.pull()
  const resolveConflict = async (idx, resolution, override) => syncService.resolveConflict(idx, resolution, override)
  const flushQueue = () => syncService.flushOfflineQueue()
  const clearQueue = () => syncService.clearOfflineQueue()

  return {
    ...syncState,
    syncData,
    fetchData,
    resolveConflict,
    flushQueue,
    clearQueue,
    isSyncing: syncState.status === syncStatus.SYNCING || syncState.status === syncStatus.RETRYING,
    isError: syncState.status === syncStatus.ERROR,
    isOffline: syncState.status === syncStatus.OFFLINE,
    hasConflict: syncState.pendingConflicts > 0
  }
}
