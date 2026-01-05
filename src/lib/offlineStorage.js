export const STORAGE_KEYS = {
  BOOKINGS: "yatrahub_bookings",
  TOURS: "yatrahub_tours",
  EXPENSES: "yatrahub_expenses",
  SYNC_QUEUE: "yatrahub_sync_queue",
  LAST_SYNC: "yatrahub_last_sync",
  OFFLINE_MODE: "yatrahub_offline_mode",
}

export class OfflineManager {
  static saveToOffline(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data))
      return true
    } catch (error) {
      console.error("[v0] Error saving to offline storage:", error)
      return false
    }
  }

  static getFromOffline(key) {
    try {
      const data = localStorage.getItem(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      console.error("[v0] Error retrieving from offline storage:", error)
      return null
    }
  }

  static addToSyncQueue(operation) {
    try {
      const queue = this.getFromOffline(STORAGE_KEYS.SYNC_QUEUE) || []
      queue.push({
        ...operation,
        timestamp: new Date().toISOString(),
        id: Date.now(),
      })
      this.saveToOffline(STORAGE_KEYS.SYNC_QUEUE, queue)
      return true
    } catch (error) {
      console.error("[v0] Error adding to sync queue:", error)
      return false
    }
  }

  static getSyncQueue() {
    return this.getFromOffline(STORAGE_KEYS.SYNC_QUEUE) || []
  }

  static clearSyncQueue() {
    localStorage.removeItem(STORAGE_KEYS.SYNC_QUEUE)
  }

  static removeSyncQueueItem(id) {
    const queue = this.getSyncQueue()
    const updatedQueue = queue.filter((item) => item.id !== id)
    this.saveToOffline(STORAGE_KEYS.SYNC_QUEUE, updatedQueue)
  }

  static setLastSync(timestamp) {
    this.saveToOffline(STORAGE_KEYS.LAST_SYNC, timestamp)
  }

  static getLastSync() {
    return this.getFromOffline(STORAGE_KEYS.LAST_SYNC)
  }

  static setOfflineMode(isOffline) {
    this.saveToOffline(STORAGE_KEYS.OFFLINE_MODE, isOffline)
  }

  static isOfflineMode() {
    return this.getFromOffline(STORAGE_KEYS.OFFLINE_MODE) || false
  }
}

export async function syncWithServer(bookings, tours, expenses, token) {
  const syncQueue = OfflineManager.getSyncQueue()

  if (syncQueue.length === 0) {
    OfflineManager.setOfflineMode(false)
    return { success: true, synced: 0 }
  }

  let syncedCount = 0
  const failedOps = []

  for (const operation of syncQueue) {
    try {
      const response = await fetch(`http://localhost:5000/api/${operation.type}/${operation.id || ""}`, {
        method: operation.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(operation.data),
      })

      if (response.ok) {
        OfflineManager.removeSyncQueueItem(operation.id)
        syncedCount++
        console.log("[v0] Synced operation:", operation.id)
      } else {
        failedOps.push(operation)
      }
    } catch (error) {
      console.error("[v0] Sync error for operation:", operation.id, error)
      failedOps.push(operation)
    }
  }

  if (failedOps.length === 0) {
    OfflineManager.setOfflineMode(false)
    OfflineManager.setLastSync(new Date().toISOString())
  }

  return {
    success: failedOps.length === 0,
    synced: syncedCount,
    failed: failedOps.length,
  }
}
