import { useState, useEffect } from 'react'

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const syncStatus = {
  IDLE: 'idle',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  ERROR: 'error'
}

export class SyncService {
  constructor() {
    this.subscribers = new Set()
    this.status = syncStatus.IDLE
    this.lastSyncTime = null
    this.error = null
  }

  subscribe(callback) {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }

  notify() {
    this.subscribers.forEach((callback) =>
      callback({
        status: this.status,
        lastSyncTime: this.lastSyncTime,
        error: this.error
      })
    )
  }

  async push(data) {
    this.status = syncStatus.SYNCING
    this.error = null
    this.notify()

    try {
      await delay(500 + Math.random() * 500)

      if (Math.random() < 0.05) {
        throw new Error('网络连接失败，请稍后重试')
      }

      try {
        localStorage.setItem('drill-board-remote-backup', JSON.stringify({
          data,
          syncedAt: new Date().toISOString()
        }))
      } catch (e) {
        console.warn('远程备份存储失败:', e)
      }

      this.status = syncStatus.SUCCESS
      this.lastSyncTime = new Date().toISOString()
      this.notify()

      return { success: true, syncedAt: this.lastSyncTime }
    } catch (error) {
      this.status = syncStatus.ERROR
      this.error = error.message
      this.notify()

      return { success: false, error: error.message }
    }
  }

  async pull() {
    this.status = syncStatus.SYNCING
    this.error = null
    this.notify()

    try {
      await delay(300 + Math.random() * 300)

      if (Math.random() < 0.03) {
        throw new Error('无法连接到服务器')
      }

      let remoteData = null
      try {
        const backup = localStorage.getItem('drill-board-remote-backup')
        if (backup) {
          const parsed = JSON.parse(backup)
          remoteData = parsed.data
        }
      } catch (e) {
        console.warn('读取远程备份失败:', e)
      }

      this.status = syncStatus.SUCCESS
      this.lastSyncTime = new Date().toISOString()
      this.notify()

      return { success: true, data: remoteData, syncedAt: this.lastSyncTime }
    } catch (error) {
      this.status = syncStatus.ERROR
      this.error = error.message
      this.notify()

      return { success: false, error: error.message, data: null }
    }
  }

  async deleteRemote() {
    try {
      localStorage.removeItem('drill-board-remote-backup')
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  getStatus() {
    return {
      status: this.status,
      lastSyncTime: this.lastSyncTime,
      error: this.error
    }
  }
}

export const syncService = new SyncService()

export const useSync = () => {
  const [syncState, setSyncState] = useState(syncService.getStatus())

  useEffect(() => {
    return syncService.subscribe(setSyncState)
  }, [])

  const syncData = async (data) => {
    return syncService.push(data)
  }

  const fetchData = async () => {
    return syncService.pull()
  }

  return {
    ...syncState,
    syncData,
    fetchData,
    isSyncing: syncState.status === syncStatus.SYNCING,
    isError: syncState.status === syncStatus.ERROR
  }
}
