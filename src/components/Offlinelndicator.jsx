/* eslint-disable react-hooks/exhaustive-deps */
"use client"

import { useState, useEffect } from "react"
import { Wifi as WiFi, WifiOff, Cloud, X, Check } from "lucide-react"
import { OfflineManager, syncWithServer } from "@/lib/offlineStorage"

export default function OfflineIndicator({ bookings, tours, expenses, token }) {
  const [isOnline, setIsOnline] = useState(true)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const [syncQueue, setSyncQueue] = useState([])
  const [isSyncing, setIsSyncing] = useState(false)
  // eslint-disable-next-line no-unused-vars
  const [lastSync, setLastSync] = useState(null)
  const [showSyncStatus, setShowSyncStatus] = useState(false)

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine)
    setIsOfflineMode(OfflineManager.isOfflineMode())
    setSyncQueue(OfflineManager.getSyncQueue())
    setLastSync(OfflineManager.getLastSync())

    // Listen for online/offline events
    const handleOnline = () => {
      console.log("[v0] Back online, attempting sync...")
      setIsOnline(true)
      setShowSyncStatus(true)
      performSync()
    }

    const handleOffline = () => {
      console.log("[v0] Connection lost, switching to offline mode")
      setIsOnline(false)
      OfflineManager.setOfflineMode(true)
      setIsOfflineMode(true)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Check every 30 seconds
    const interval = setInterval(() => {
      setSyncQueue(OfflineManager.getSyncQueue())
    }, 30000)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      clearInterval(interval)
    }
  }, [])

  const performSync = async () => {
    if (isSyncing || !isOnline || syncQueue.length === 0) return

    setIsSyncing(true)
    try {
      const result = await syncWithServer(bookings, tours, expenses, token)
      setSyncQueue(OfflineManager.getSyncQueue())
      setLastSync(OfflineManager.getLastSync())

      if (result.success) {
        console.log("[v0] Sync completed successfully")
        setIsOfflineMode(false)
      }

      setTimeout(() => {
        setShowSyncStatus(false)
      }, 3000)
    } catch (error) {
      console.error("[v0] Sync error:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  if (!isOnline && isOfflineMode) {
    return (
      <div className="fixed bottom-6 right-6 z-40 space-y-2">
        {/* Offline Mode Alert */}
        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 shadow-xl max-w-sm">
          <div className="flex items-start gap-3">
            <WifiOff className="text-orange-600 shrink-0 mt-1" size={20} />
            <div className="flex-1">
              <h4 className="font-black text-orange-900 text-sm">Offline Mode Active</h4>
              <p className="text-xs text-orange-700 font-bold mt-1">Changes will sync when connection returns</p>
              {syncQueue.length > 0 && (
                <p className="text-xs text-orange-600 font-black mt-2">
                  {syncQueue.length} pending sync{syncQueue.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            <button
              onClick={() => setShowSyncStatus(false)}
              className="p-1 text-orange-400 hover:text-orange-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Sync Status */}
        {showSyncStatus && isOnline && (
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4 shadow-xl">
            <div className="flex items-start gap-3">
              {isSyncing ? (
                <Cloud className="text-blue-600 shrink-0 mt-1 animate-pulse" size={20} />
              ) : (
                <Check className="text-green-600 shrink-0 mt-1" size={20} />
              )}
              <div className="flex-1">
                <h4 className="font-black text-blue-900 text-sm">{isSyncing ? "Syncing..." : "Sync Complete"}</h4>
                {isSyncing ? (
                  <p className="text-xs text-blue-700 font-bold mt-1">Uploading offline changes...</p>
                ) : (
                  <p className="text-xs text-green-700 font-bold mt-1">All changes synced successfully</p>
                )}
              </div>
              {!isSyncing && (
                <button
                  onClick={() => setShowSyncStatus(false)}
                  className="p-1 text-blue-400 hover:text-blue-600 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Online status indicator (minimal)
  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 text-xs font-bold text-slate-500">
      <WiFi size={16} className="text-green-600" />
      <span>Online</span>
    </div>
  )
}
