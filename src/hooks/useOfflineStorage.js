/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import { useEffect, useState } from "react"
import { OfflineManager } from "@/lib/offlineStorage"

export function useOfflineStorage() {
  const [isOnline, setIsOnline] = useState(true)
  const [isOfflineMode, setIsOfflineMode] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setIsOfflineMode(OfflineManager.isOfflineMode())

    const handleOnline = () => {
      setIsOnline(true)
      if (OfflineManager.getSyncQueue().length === 0) {
        OfflineManager.setOfflineMode(false)
        setIsOfflineMode(false)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      OfflineManager.setOfflineMode(true)
      setIsOfflineMode(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  const saveLocally = (operation) => {
    if (!isOnline) {
      OfflineManager.addToSyncQueue(operation)
      console.log("[v0] Operation queued for sync:", operation)
    }
  }

  const getLocalData = (key) => {
    return OfflineManager.getFromOffline(key)
  }

  const syncLocalData = (data, key) => {
    OfflineManager.saveToOffline(key, data)
  }

  return {
    isOnline,
    isOfflineMode,
    saveLocally,
    getLocalData,
    syncLocalData,
    syncQueue: OfflineManager.getSyncQueue(),
  }
}
