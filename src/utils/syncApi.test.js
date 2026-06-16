import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncService, syncStatus, conflictResolution } from './syncApi'

const makeSyncWithMockRequest = () => {
  const svc = new SyncService()
  vi.spyOn(svc, '_simulateRequest').mockResolvedValue(true)
  return svc
}

describe('SyncService', () => {
  let syncService
  const mockData = [{ id: '1', name: '测试演练' }]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    syncService = makeSyncWithMockRequest()
  })

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      expect(syncService.status).toBe(syncStatus.IDLE)
      expect(syncService.lastSyncTime).toBeNull()
      expect(syncService.error).toBeNull()
      expect(syncService.subscribers.size).toBe(0)
    })
  })

  describe('subscribe', () => {
    it('should add subscriber and return unsubscribe function', () => {
      const callback = vi.fn()
      const unsubscribe = syncService.subscribe(callback)

      expect(syncService.subscribers.size).toBe(1)
      expect(typeof unsubscribe).toBe('function')

      unsubscribe()
      expect(syncService.subscribers.size).toBe(0)
    })
  })

  describe('notify', () => {
    it('should notify all subscribers with current status', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      syncService.subscribe(callback1)
      syncService.subscribe(callback2)

      syncService.status = syncStatus.SUCCESS
      syncService.lastSyncTime = '2026-06-10T10:00:00Z'
      syncService.notify()

      expect(callback1.mock.calls.length).toBeGreaterThan(0)
      const lastCall1 = callback1.mock.calls[callback1.mock.calls.length - 1][0]
      const lastCall2 = callback2.mock.calls[callback2.mock.calls.length - 1][0]
      expect(lastCall1.status).toBe(syncStatus.SUCCESS)
      expect(lastCall1.lastSyncTime).toBe('2026-06-10T10:00:00Z')
      expect(lastCall2.status).toBe(syncStatus.SUCCESS)
    })
  })

  describe('push', () => {
    it('should sync data successfully', async () => {
      const callback = vi.fn()
      syncService.subscribe(callback)

      const result = await syncService.push(mockData)

      expect(result.success).toBe(true)
      expect(result.syncedAt).toBeDefined()
      expect(syncService.status).toBe(syncStatus.SUCCESS)
      expect(syncService.lastSyncTime).toBeDefined()
      expect(syncService.error).toBeNull()
    })

    it('should handle sync errors via retries and queue', async () => {
      vi.useFakeTimers()
      const failing = new SyncService()
      vi.spyOn(failing, '_simulateRequest').mockRejectedValue(
        new Error('网络失败')
      )

      const promise = failing.push(mockData)

      for (let i = 1; i <= 5; i++) {
        await Promise.resolve()
        vi.advanceTimersByTime(30000)
        await Promise.resolve()
      }

      const result = await promise
      expect(result.success).toBe(false)
      expect(result.queued).toBe(true)
      expect(failing.offlineQueue.length).toBeGreaterThanOrEqual(1)

      failing.destroy()
      vi.clearAllTimers()
      vi.useRealTimers()
    })
  })

  describe('pull', () => {
    it('should pull data successfully', async () => {
      const backupData = {
        data: mockData,
        version: 3,
        syncedAt: '2026-06-10T10:00:00Z'
      }
      localStorage.setItem('drill-board-remote-backup', JSON.stringify(backupData))

      const result = await syncService.pull()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData)
      expect(result.syncedAt).toBeDefined()
      expect(syncService.status).toBe(syncStatus.SUCCESS)
    })

    it('should return null data when no backup exists', async () => {
      const result = await syncService.pull()

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('should handle pull errors via retries', async () => {
      const failing = new SyncService()
      let attempt = 0
      const spy = vi.spyOn(failing, '_simulateRequest').mockImplementation(() => {
        attempt++
        return attempt > 5 ? Promise.resolve(true) : Promise.reject(new Error('fail'))
      })
      vi.spyOn(failing, '_scheduleRetry').mockResolvedValue({
        success: false, error: '模拟重试耗尽', queued: false
      })

      const result = await failing.pull()
      expect(result.success).toBe(false)

      spy.mockRestore()
      failing.destroy()
    })
  })

  describe('deleteRemote', () => {
    it('should delete remote backup successfully', async () => {
      const result = await syncService.deleteRemote()
      expect(result.success).toBe(true)
      expect(localStorage.removeItem).toHaveBeenCalledWith('drill-board-remote-backup')
    })

    it('should handle delete errors', async () => {
      localStorage.removeItem.mockImplementationOnce(() => {
        throw new Error('Delete error')
      })

      const result = await syncService.deleteRemote()
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('getStatus', () => {
    it('should return current status with extended fields', () => {
      syncService.status = syncStatus.SYNCING
      syncService.lastSyncTime = '2026-06-10T10:00:00Z'
      syncService.error = 'Test error'

      const status = syncService.getStatus()
      expect(status).toMatchObject({
        status: syncStatus.SYNCING,
        lastSyncTime: '2026-06-10T10:00:00Z',
        error: 'Test error'
      })
      expect(status.version).toBeDefined()
      expect(typeof status.isOnline).toBe('boolean')
      expect(typeof status.offlineQueueSize).toBe('number')
      expect(typeof status.pendingConflicts).toBe('number')
      expect(typeof status.retryCount).toBe('number')
    })
  })
})

describe('syncStatus', () => {
  it('should have all extended status values', () => {
    expect(syncStatus.IDLE).toBe('idle')
    expect(syncStatus.SYNCING).toBe('syncing')
    expect(syncStatus.SUCCESS).toBe('success')
    expect(syncStatus.ERROR).toBe('error')
    expect(syncStatus.CONFLICT).toBe('conflict')
    expect(syncStatus.OFFLINE).toBe('offline')
    expect(syncStatus.RETRYING).toBe('retrying')
  })
})

describe('conflictResolution', () => {
  it('should have all resolution options with aliases', () => {
    expect(conflictResolution.USE_LOCAL).toBe('use_local')
    expect(conflictResolution.USE_REMOTE).toBe('use_remote')
    expect(conflictResolution.MERGE).toBe('merge')
    expect(conflictResolution.LOCAL_WINS).toBe(conflictResolution.USE_LOCAL)
    expect(conflictResolution.REMOTE_WINS).toBe(conflictResolution.USE_REMOTE)
  })
})

describe('SyncService - Offline Mode', () => {
  let syncService
  const mockData = [{ id: 'offline-1', name: '离线演练' }]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    syncService = makeSyncWithMockRequest()
    syncService._retryTimer && clearTimeout(syncService._retryTimer)
  })

  it('should queue push operation when offline', async () => {
    syncService.isOnline = false
    const statusChanges = []
    syncService.subscribe(s => statusChanges.push(s.status))

    const result = await syncService.push(mockData)

    expect(result.success).toBe(true)
    expect(result.offline).toBe(true)
    expect(result.queued).toBe(true)
    expect(syncService.status).toBe(syncStatus.OFFLINE)
    expect(syncService.offlineQueue.length).toBe(1)
    expect(syncService.offlineQueue[0].op).toBe('push')
    expect(syncService.offlineQueue[0].payload.data).toEqual(mockData)
  })

  it('should return offline result when pulling while offline', async () => {
    syncService.isOnline = false

    const result = await syncService.pull()

    expect(result.success).toBe(false)
    expect(result.offline).toBe(true)
    expect(result.data).toBeNull()
    expect(syncService.status).toBe(syncStatus.OFFLINE)
  })

  it('should persist offline queue via localStorage', async () => {
    syncService.isOnline = false
    await syncService.push(mockData)
    const firstQueue = syncService.offlineQueue.length
    expect(firstQueue).toBeGreaterThan(0)

    const raw = localStorage.getItem('drill-board-offline-queue')
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(firstQueue)
    expect(parsed[0].payload.data).toEqual(mockData)
  })
})

describe('SyncService - Retry with Exponential Backoff', () => {
  let syncService
  const mockData = [{ id: 'retry-1', name: '重试测试' }]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
    syncService = new SyncService()
  })

  afterEach(() => {
    syncService.destroy()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should retry up to MAX_RETRIES times with exponential backoff', async () => {
    const failSpy = vi.spyOn(syncService, '_simulateRequest').mockRejectedValue(
      new Error('强制网络故障')
    )

    const promise = syncService.push(mockData)

    for (let i = 1; i <= 5; i++) {
      await Promise.resolve()
      vi.advanceTimersByTime(1000 * Math.pow(2, i - 1) + 500)
      await Promise.resolve()
    }

    const result = await promise

    expect(result.success).toBe(false)
    expect(result.queued).toBe(true)
    expect(syncService.offlineQueue.length).toBeGreaterThanOrEqual(1)
    expect(failSpy).toHaveBeenCalled()
    failSpy.mockRestore()
  })

  it('should set RETRYING status during retries', async () => {
    let attemptCount = 0
    const statusLog = []
    syncService.subscribe(s => statusLog.push({ status: s.status, retry: s.retryCount }))

    const failSpy = vi.spyOn(syncService, '_simulateRequest').mockImplementation(() => {
      attemptCount++
      if (attemptCount < 3) return Promise.reject(new Error('临时故障'))
      return Promise.resolve(true)
    })

    const promise = syncService.push(mockData)

    for (let i = 1; i <= 3; i++) {
      await Promise.resolve()
      vi.advanceTimersByTime(1500 * Math.pow(2, i - 1))
      await Promise.resolve()
    }

    const result = await promise
    expect(result.success).toBe(true)
    expect(statusLog.some(s => s.status === syncStatus.RETRYING)).toBe(true)
    failSpy.mockRestore()
  })
})

describe('SyncService - Offline Queue Flush (Breakpoint Resume)', () => {
  let syncService

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    localStorage.clear()
    syncService = makeSyncWithMockRequest()
  })

  afterEach(() => {
    syncService.destroy()
    vi.clearAllTimers()
    vi.useRealTimers()
  })

  it('should flush offline queue when flushOfflineQueue is called', async () => {
    syncService.isOnline = false
    const dataA = [{ id: 'a', name: 'A演练' }]
    const dataB = [{ id: 'b', name: 'B演练' }]
    await syncService.push(dataA)
    await syncService.push(dataB)
    expect(syncService.offlineQueue.length).toBe(2)

    syncService.isOnline = true

    const flushPromise = syncService.flushOfflineQueue()
    await Promise.resolve()
    vi.advanceTimersByTime(2000)
    await flushPromise
    await Promise.resolve()

    expect(syncService.offlineQueue.length).toBe(0)
  })

  it('should clear offline queue when clearOfflineQueue is called', () => {
    syncService.offlineQueue = [
      { op: 'push', payload: { data: [] } },
      { op: 'push', payload: { data: [] } }
    ]
    const cleared = syncService.clearOfflineQueue()

    expect(cleared).toBe(2)
    expect(syncService.offlineQueue.length).toBe(0)
  })
})

describe('SyncService - Conflict Detection & Resolution', () => {
  let syncService
  const localData = [{ id: '1', name: '本地修改', updatedAt: '2026-06-10T10:00:00Z' }]
  const remoteData = [{ id: '1', name: '远端修改', updatedAt: '2026-06-10T12:00:00Z' }]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    syncService = makeSyncWithMockRequest()
  })

  it('should detect conflict when remote version is newer', async () => {
    syncService.version = 5

    localStorage.setItem('drill-board-remote-backup', JSON.stringify({
      data: remoteData,
      version: 10,
      syncedAt: new Date().toISOString()
    }))

    const result = await syncService.push(localData)

    expect(result.success).toBe(false)
    expect(result.conflict).toBe(true)
    expect(result.localVersion).toBe(5)
    expect(result.remoteVersion).toBe(10)
    expect(result.options).toContain('merge')
    expect(syncService.pendingConflicts.length).toBe(1)
    expect(syncService.status).toBe(syncStatus.CONFLICT)
  })

  it('should resolve conflict with LOCAL_WINS', async () => {
    syncService.pendingConflicts = [{
      localVersion: 5, remoteVersion: 10,
      localData, remoteData, reportedAt: Date.now()
    }]

    const res = await syncService.resolveConflict(0, 'use_local')

    expect(res.success).toBe(true)
    expect(res.data).toEqual(localData)
    expect(res.resolution).toBe('use_local')
    expect(syncService.pendingConflicts.length).toBe(0)
    expect(syncService.status).toBe(syncStatus.SUCCESS)
  })

  it('should resolve conflict with REMOTE_WINS', async () => {
    syncService.pendingConflicts = [{
      localVersion: 5, remoteVersion: 10,
      localData, remoteData, reportedAt: Date.now()
    }]

    const res = await syncService.resolveConflict(0, 'use_remote')

    expect(res.success).toBe(true)
    expect(res.data).toEqual(remoteData)
  })

  it('should resolve conflict with MERGE strategy combining both datasets', async () => {
    const localOnly = [{ id: 'L', name: '仅本地' }]
    const remoteOnly = [{ id: 'R', name: '仅远端' }]
    syncService.pendingConflicts = [{
      localVersion: 1, remoteVersion: 2,
      localData: [...localOnly, ...localData],
      remoteData: [...remoteOnly, ...remoteData],
      reportedAt: Date.now()
    }]

    const res = await syncService.resolveConflict(0, 'merge')
    expect(res.success).toBe(true)
    const mergedIds = res.data.map(s => s.id).sort()
    expect(mergedIds).toContain('L')
    expect(mergedIds).toContain('R')
    expect(mergedIds).toContain('1')
  })

  it('should return error when resolving non-existent conflict', async () => {
    const res = await syncService.resolveConflict(999, 'merge')
    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()
  })
})

describe('SyncService - getStatus Extended', () => {
  let syncService
  beforeEach(() => {
    localStorage.clear()
    syncService = makeSyncWithMockRequest()
  })

  it('should include all extended fields in getStatus', () => {
    syncService.status = syncStatus.RETRYING
    syncService.retryCount = 3
    syncService.pendingConflicts = [{ localVersion: 1, remoteVersion: 2 }]
    syncService.offlineQueue = [{ op: 'push' }]
    syncService.isOnline = true

    const s = syncService.getStatus()

    expect(s.status).toBe(syncStatus.RETRYING)
    expect(s.retryCount).toBe(3)
    expect(s.pendingConflicts).toBe(1)
    expect(s.offlineQueueSize).toBe(1)
    expect(s.isOnline).toBe(true)
    expect(s.version).toBeDefined()
  })
})

describe('useSync Hook Shape', () => {
  it('should expose the expected helper methods from useSync', () => {
    const api = require('./syncApi')
    expect(typeof api.useSync).toBe('function')
  })
})
