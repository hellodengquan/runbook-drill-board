import { describe, it, expect, beforeEach, vi } from 'vitest'
import { saveToStorage, loadFromStorage } from './storage'

describe('storage utilities', () => {
  const STORAGE_KEY = 'drill-board-data'
  const mockData = [
    { id: '1', name: '测试演练', date: '2026-06-10' }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('saveToStorage', () => {
    it('should save data to localStorage', () => {
      saveToStorage(mockData)
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(mockData)
      )
    })

    it('should handle localStorage errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorage.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      saveToStorage(mockData)
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('loadFromStorage', () => {
    it('should load data from localStorage', () => {
      localStorage.getItem.mockReturnValue(JSON.stringify(mockData))
      const data = loadFromStorage()
      expect(data).toEqual(mockData)
      expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY)
    })

    it('should return null when no data exists', () => {
      localStorage.getItem.mockReturnValue(null)
      const data = loadFromStorage()
      expect(data).toBeNull()
    })

    it('should return null for invalid JSON', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorage.getItem.mockReturnValue('invalid json')

      const data = loadFromStorage()
      expect(data).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })

    it('should handle localStorage errors gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      localStorage.getItem.mockImplementation(() => {
        throw new Error('Storage error')
      })

      const data = loadFromStorage()
      expect(data).toBeNull()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })
})
