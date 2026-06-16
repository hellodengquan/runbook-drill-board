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

/* ============================================
   时钟漂移容忍 + 断线超时 + 快照合并 扩展
   ============================================ */

const DEFAULT_CLOCK_DRIFT_TOLERANCE_MS = 5000
const DEFAULT_OFFLINE_TIMEOUT_MS = 10000
const OFFLINE_SNAPSHOT_KEY = 'drill-board-offline-snapshot'

export const driftUtils = {
  toleranceMs: DEFAULT_CLOCK_DRIFT_TOLERANCE_MS,
  localClockOffsetMs: 0,
  calibrate(serverTsMs) {
    if (serverTsMs) {
      this.localClockOffsetMs = serverTsMs - Date.now()
    }
  },
  now() {
    return Date.now() + this.localClockOffsetMs
  },
  within(localTs, remoteTs, tolerance = this.toleranceMs) {
    return Math.abs((localTs || 0) - (remoteTs || 0)) <= tolerance
  }
}

const classifyConflict = (localVersion, remoteVersion, localUpdatedAt, remoteUpdatedAt, tolerance = DEFAULT_CLOCK_DRIFT_TOLERANCE_MS) => {
  if (localVersion === remoteVersion) return { kind: 'same', autoMerge: true }
  if (localVersion > remoteVersion) return { kind: 'local-newer', autoMerge: true, prefer: 'local' }
  if (Math.abs(localVersion - remoteVersion) === 1 && driftUtils.within(localUpdatedAt, remoteUpdatedAt, tolerance)) {
    return { kind: 'drift-tolerant', autoMerge: true, prefer: 'merge' }
  }
  if (driftUtils.within(localUpdatedAt, remoteUpdatedAt, tolerance * 2)) {
    return { kind: 'minor-drift', autoMerge: true, prefer: 'merge' }
  }
  return { kind: 'conflict', autoMerge: false }
}

const readOfflineSnapshot = () => {
  try {
    const raw = localStorage.getItem(OFFLINE_SNAPSHOT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

const writeOfflineSnapshot = (data, version, capturedAt, offlineSince) => {
  try {
    localStorage.setItem(OFFLINE_SNAPSHOT_KEY, JSON.stringify({ data, version, capturedAt, offlineSince }))
    return true
  } catch { return false }
}

const clearOfflineSnapshot = () => {
  try { localStorage.removeItem(OFFLINE_SNAPSHOT_KEY) } catch {}
}

const tripleMerge = (snapshotData, offlineQueueData, remoteData) => {
  const all = [snapshotData, offlineQueueData, remoteData].filter(Boolean)
  if (all.length === 0) return []
  if (all.length === 1) return all[0]
  const idMap = new Map()
  all.forEach(list => (list || []).forEach(item => {
    const cur = idMap.get(item.id)
    if (!cur) { idMap.set(item.id, { ...item }) }
    else {
      const curU = cur.updatedAt || cur.date || 0
      const itU = item.updatedAt || item.date || 0
      if (itU > curU) idMap.set(item.id, { ...item })
    }
  }))
  return [...idMap.values()]
}

const offlineTimeoutSnapshot = {
  offlineSince: null,
  snapshot: null,
  markOffline(data, version) {
    if (!this.offlineSince) {
      this.offlineSince = Date.now()
      this.snapshot = { data: JSON.parse(JSON.stringify(data || [])), version }
      writeOfflineSnapshot(this.snapshot.data, this.snapshot.version, Date.now(), this.offlineSince)
    }
  },
  isTimedOut(timeoutMs = DEFAULT_OFFLINE_TIMEOUT_MS) {
    if (!this.offlineSince) return false
    return Date.now() - this.offlineSince >= timeoutMs
  },
  markOnline() {
    this.offlineSince = null
    this.snapshot = null
    clearOfflineSnapshot()
  },
  resolve(timeoutMs = DEFAULT_OFFLINE_TIMEOUT_MS, offlineQueueData, remoteData) {
    const needMerge = this.isTimedOut(timeoutMs)
    if (needMerge && this.snapshot) {
      const merged = tripleMerge(this.snapshot.data, offlineQueueData, remoteData)
      this.markOnline()
      return { merged, via: 'triple-merge' }
    }
    this.markOnline()
    return { merged: null, via: 'no-timeout' }
  }
}

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
      offlineTimeoutSnapshot.markOffline(data, this.version)
      this.offlineQueue.push({ op: 'push', payload: { data, stubVersion: nextVersion() }, queuedAt: Date.now() })
      writeOfflineQueue(this.offlineQueue)
      this.status = syncStatus.OFFLINE
      this.notify()
      return { success: true, offline: true, queued: true, offlineSince: offlineTimeoutSnapshot.offlineSince }
    }

    this.status = syncStatus.SYNCING
    this.error = null
    this.notify()

    try {
      await this._simulateRequest(attempt > 0 ? 0.02 : 0.05)

      const remote = readRemote()
      const localVersion = this.version
      const remoteVersion = remote?.version || 0
      const localUpdatedAt = Array.isArray(data) && data.length
        ? Math.max(...data.map(s => new Date(s.updatedAt || s.date || 0).getTime()))
        : 0
      const remoteUpdatedAt = Array.isArray(remote?.data) && remote.data.length
        ? Math.max(...remote.data.map(s => new Date(s.updatedAt || s.date || 0).getTime()))
        : 0

      const conflictClass = classifyConflict(localVersion, remoteVersion, localUpdatedAt, remoteUpdatedAt)

      if (conflictClass.kind === 'conflict') {
        this.status = syncStatus.CONFLICT
        this.pendingConflicts.push({
          localVersion,
          remoteVersion,
          localData: data,
          remoteData: remote.data,
          reportedAt: Date.now(),
          kind: conflictClass.kind
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

      if (conflictClass.autoMerge && conflictClass.prefer === 'merge' && remote?.data) {
        data = mergeScenarios(data, remote.data)
      }

      const newVersion = nextVersion()
      const syncedAt = new Date().toISOString()
      const written = writeRemote(data, newVersion, syncedAt)
      if (!written) throw new Error('远程存储写入失败')

      offlineTimeoutSnapshot.markOnline()
      this.version = newVersion
      this.retryCount = 0
      this.status = syncStatus.SUCCESS
      this.lastSyncTime = syncedAt
      this.notify()
      return { success: true, syncedAt, version: newVersion, autoMerged: conflictClass.autoMerge && conflictClass.kind !== 'same' }
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

  async _drainOfflineQueue(timeoutMs = DEFAULT_OFFLINE_TIMEOUT_MS) {
    if (this.offlineQueue.length === 0) {
      offlineTimeoutSnapshot.markOnline()
      return
    }
    this.status = syncStatus.RETRYING
    this.notify()

    const offlineQueueData = this.offlineQueue
      .filter(x => x.op === 'push')
      .flatMap(x => x.payload.data || [])

    const remote = readRemote()
    const snapshotResult = offlineTimeoutSnapshot.resolve(timeoutMs, offlineQueueData, remote?.data)
    if (snapshotResult.merged) {
      const newVersion = nextVersion()
      writeRemote(snapshotResult.merged, newVersion, new Date().toISOString())
      this.version = newVersion
      this.offlineQueue = []
      writeOfflineQueue(this.offlineQueue)
      this.status = syncStatus.SUCCESS
      this.notify()
      return { via: snapshotResult.via, count: snapshotResult.merged.length, version: newVersion }
    }

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

  flushOfflineQueue(timeoutMs) {
    return this._drainOfflineQueue(timeoutMs)
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

/* ============================================
   Confluence / Notion 鉴权适配层
   ============================================ */

export const authProviderType = {
  CONFLUENCE: 'confluence',
  NOTION: 'notion'
}

export const ConfluenceAuthMethod = {
  BASIC: 'basic',
  PAT: 'personal_access_token',
  OAUTH2: 'oauth2_3lo',
  SWIFT: 'swift_app'
}

export const NotionAuthMethod = {
  INTERNAL: 'internal_integration_token',
  OAUTH: 'public_oauth'
}

class ExportAuthProvider {
  constructor(type) {
    this.type = type
    this.credentials = null
    this.endpoint = null
    this.tokenType = null
    this.scope = null
  }

  isConfigured() { return !!this.credentials }
  invalidate() { this.credentials = null }

  buildHeaders() {
    throw new Error('子类需实现 buildHeaders()')
  }

  async refreshIfNeeded() {
    return { ok: false, error: '未实现' }
  }

  async request(path, { method = 'GET', body = null, extraHeaders = {} } = {}) {
    if (!this.endpoint) return { ok: false, error: '未配置 endpoint' }
    if (!this.isConfigured()) return { ok: false, error: '未配置凭据' }
    try {
      const resp = await fetch(`${this.endpoint}${path}`, {
        method,
        headers: { ...this.buildHeaders(), ...extraHeaders },
        body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null
      })
      const ok = resp.ok
      const data = resp.headers.get('content-type')?.includes('json')
        ? await resp.json()
        : await resp.text()
      return ok ? { ok: true, data, status: resp.status } : { ok: false, status: resp.status, data }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  }
}

export class ConfluenceAuthProvider extends ExportAuthProvider {
  constructor(baseUrl, method = ConfluenceAuthMethod.PAT) {
    super(authProviderType.CONFLUENCE)
    this.baseUrl = baseUrl || 'https://your-domain.atlassian.net/wiki'
    this.endpoint = `${this.baseUrl}/rest/api`
    this.method = method
    this.spaceKey = 'DRILL'
  }

  configure(config) {
    switch (this.method) {
      case ConfluenceAuthMethod.BASIC:
        this.credentials = { user: config.user, token: config.token }
        break
      case ConfluenceAuthMethod.PAT:
        this.credentials = { pat: config.pat }
        break
      case ConfluenceAuthMethod.OAUTH2:
        this.credentials = { accessToken: config.accessToken, refreshToken: config.refreshToken, expiresAt: config.expiresAt }
        break
    }
    if (config.spaceKey) this.spaceKey = config.spaceKey
    this.tokenType = this.method
    return { ok: true }
  }

  buildHeaders() {
    const base = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    switch (this.method) {
      case ConfluenceAuthMethod.BASIC:
        return {
          ...base,
          'Authorization': `Basic ${btoa(`${this.credentials.user}:${this.credentials.token}`)}`
        }
      case ConfluenceAuthMethod.PAT:
        return {
          ...base,
          'Authorization': `Bearer ${this.credentials.pat}`
        }
      case ConfluenceAuthMethod.OAUTH2:
        return {
          ...base,
          'Authorization': `Bearer ${this.credentials.accessToken}`
        }
    }
    return base
  }

  async refreshIfNeeded() {
    if (this.method !== ConfluenceAuthMethod.OAUTH2) return { ok: true, refreshed: false }
    if (!this.credentials?.expiresAt || Date.now() < this.credentials.expiresAt - 300_000) {
      return { ok: true, refreshed: false }
    }
    return { ok: false, error: '需要实现具体 OAuth2 token refresh' }
  }

  async uploadPage(title, content, parentId = null) {
    const payload = {
      type: 'page',
      title,
      space: { key: this.spaceKey },
      body: {
        storage: { value: content, representation: 'wiki' }
      }
    }
    if (parentId) payload.ancestors = [{ id: parentId }]
    return this.request('/content', { method: 'POST', body: payload })
  }
}

export class NotionAuthProvider extends ExportAuthProvider {
  constructor(method = NotionAuthMethod.INTERNAL) {
    super(authProviderType.NOTION)
    this.endpoint = 'https://api.notion.com/v1'
    this.method = method
    this.apiVersion = '2022-06-28'
    this.parentPageId = null
    this.parentDatabaseId = null
  }

  configure(config) {
    switch (this.method) {
      case NotionAuthMethod.INTERNAL:
        this.credentials = { token: config.internalToken }
        break
      case NotionAuthMethod.OAUTH:
        this.credentials = { accessToken: config.accessToken, workspaceId: config.workspaceId, expiresAt: config.expiresAt }
        break
    }
    this.parentPageId = config.parentPageId || null
    this.parentDatabaseId = config.parentDatabaseId || null
    this.tokenType = this.method
    return { ok: true }
  }

  buildHeaders() {
    const token = this.method === NotionAuthMethod.OAUTH ? this.credentials.accessToken : this.credentials.token
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Notion-Version': this.apiVersion
    }
  }

  async refreshIfNeeded() {
    if (this.method !== NotionAuthMethod.OAUTH) return { ok: true, refreshed: false }
    if (!this.credentials?.expiresAt || Date.now() < this.credentials.expiresAt - 300_000) {
      return { ok: true, refreshed: false }
    }
    return { ok: false, error: 'Notion OAuth 需要重新通过授权回调换取 token' }
  }

  async createPage(title, blocks, parentType = 'page') {
    const payload = parentType === 'database'
      ? { parent: { database_id: this.parentDatabaseId }, properties: { Name: { title: [{ text: { content: title } }] } }, children: blocks }
      : { parent: { page_id: this.parentPageId }, properties: { title: [{ text: { content: title } }] }, children: blocks }
    return this.request('/pages', { method: 'POST', body: payload })
  }

  markdownToBlocks(mdText) {
    const lines = mdText.split('\n')
    const blocks = []
    for (const line of lines) {
      if (line.startsWith('# ')) blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } })
      else if (line.startsWith('## ')) blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: line.slice(3) } }] } })
      else if (line.startsWith('### ')) blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: [{ type: 'text', text: { content: line.slice(4) } }] } })
      else if (line.startsWith('- ')) blocks.push({ object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } })
      else if (/^\d+\. /.test(line)) blocks.push({ object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\. /, '') } }] } })
      else if (line.startsWith('> ')) blocks.push({ object: 'block', type: 'quote', quote: { rich_text: [{ type: 'text', text: { content: line.slice(2) } }] } })
      else if (line.trim().length) blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: line } }] } })
    }
    return blocks.slice(0, 100)
  }
}
