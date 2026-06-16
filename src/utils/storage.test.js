import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveToStorage, loadFromStorage, setStorageMode, getStorageMode, getStorageInfo } from './storage'

describe('storage utilities', () => {
  const STORAGE_KEY = 'drill-board-data'
  const mockData = [
    { id: '1', name: '测试演练', date: '2026-06-10' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setStorageMode('localStorage')
  })

  describe('saveToStorage', () => {
    it('should save data to localStorage', async () => {
      const res = await saveToStorage(mockData)
      expect(res.success).toBe(true)
      expect(res.backend).toBe('localStorage')
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(mockData)
      )
    })

    it('should handle localStorage errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      const res = await saveToStorage(mockData)
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(typeof res.success).toBe('boolean')

      consoleErrorSpy.mockRestore()
    })
  })

  describe('loadFromStorage', () => {
    it('should load data from localStorage', async () => {
      localStorage.getItem.mockReturnValue(JSON.stringify(mockData))
      const data = await loadFromStorage()
      expect(data).toEqual(mockData)
      expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY)
    })

    it('should return null when no data exists', async () => {
      localStorage.getItem.mockReturnValue(null)
      const data = await loadFromStorage()
      expect(data).toBeNull()
    })

    it('should return null for invalid JSON', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorage.getItem.mockReturnValue('invalid json')

      const data = await loadFromStorage()
      expect(data).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should handle localStorage errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      const data = await loadFromStorage()
      expect(data).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('storageMode and Info', () => {
    it('should default to localStorage mode', () => {
      expect(getStorageMode()).toBe('localStorage')
    })

    it('should return valid storageInfo', () => {
      const info = getStorageInfo()
      expect(typeof info.usedBytes).toBe('number')
      expect(typeof info.usageRatio).toBe('number')
      expect(info.quotaBytes).toBeGreaterThan(0)
      expect(typeof info.idbAvailable).toBe('boolean')
    })
  })
})
