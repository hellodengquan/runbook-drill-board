import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncService, syncStatus } from './syncApi'

describe('SyncService', () => {
  let syncService
  const mockData = [{ id: '1', name: '测试演练' }]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    syncService = new SyncService()
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

      const expectedStatus = {
        status: syncStatus.SUCCESS,
        lastSyncTime: '2026-06-10T10:00:00Z',
        error: null
      }

      expect(callback1).toHaveBeenCalledWith(expectedStatus)
      expect(callback2).toHaveBeenCalledWith(expectedStatus)
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

      expect(callback).toHaveBeenCalled()
      const calls = callback.mock.calls
      expect(calls[0][0].status).toBe(syncStatus.SYNCING)
      expect(calls[calls.length - 1][0].status).toBe(syncStatus.SUCCESS)
    })

    it('should handle sync errors', async () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01)

      const result = await syncService.push(mockData)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(syncService.status).toBe(syncStatus.ERROR)
      expect(syncService.error).toBeDefined()

      mathSpy.mockRestore()
    })
  })

  describe('pull', () => {
    it('should pull data successfully', async () => {
      const backupData = {
        data: mockData,
        syncedAt: '2026-06-10T10:00:00Z'
      }
      localStorage.getItem.mockReturnValue(JSON.stringify(backupData))

      const result = await syncService.pull()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockData)
      expect(result.syncedAt).toBeDefined()
      expect(syncService.status).toBe(syncStatus.SUCCESS)
    })

    it('should return null data when no backup exists', async () => {
      localStorage.getItem.mockReturnValue(null)

      const result = await syncService.pull()

      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
    })

    it('should handle pull errors', async () => {
      const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.01)

      const result = await syncService.pull()

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(syncService.status).toBe(syncStatus.ERROR)

      mathSpy.mockRestore()
    })
  })

  describe('deleteRemote', () => {
    it('should delete remote backup successfully', async () => {
      const result = await syncService.deleteRemote()
      expect(result.success).toBe(true)
      expect(localStorage.removeItem).toHaveBeenCalledWith('drill-board-remote-backup')
    })

    it('should handle delete errors', async () => {
      localStorage.removeItem.mockImplementation(() => {
        throw new Error('Delete error')
      })

      const result = await syncService.deleteRemote()
      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('getStatus', () => {
    it('should return current status', () => {
      syncService.status = syncStatus.SYNCING
      syncService.lastSyncTime = '2026-06-10T10:00:00Z'
      syncService.error = 'Test error'

      const status = syncService.getStatus()
      expect(status).toEqual({
        status: syncStatus.SYNCING,
        lastSyncTime: '2026-06-10T10:00:00Z',
        error: 'Test error'
      })
    })
  })
})

describe('syncStatus', () => {
  it('should have all status values', () => {
    expect(syncStatus).toEqual({
      IDLE: 'idle',
      SYNCING: 'syncing',
      SUCCESS: 'success',
      ERROR: 'error'
    })
  })
})
