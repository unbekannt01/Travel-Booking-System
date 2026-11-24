import { useState, useEffect, useMemo, useCallback } from "react"
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  Lock,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Layers,
  Users,
  Check,
  Info,
} from "lucide-react"
import { Card, Button, Badge, Spinner, EmptyState } from "../ui"
import PanelErrorBoundary from "../common/PanelErrorBoundary"
import RateLimitNotice from "../common/RateLimitNotice"
import SeatMap from "../seats/SeatMap"
import SeatActionDrawer from "./SeatActionDrawer"
import HoldModal from "./HoldModal"
import MoveSeatModal from "./MoveSeatModal"
import { formatDisplayDate } from "../../utils/date"
import { getAuthToken } from "../../data/adapters/rest"

export default function LiveSeatMap({
  departureKey,
  onBack,
  onBookSeat,
}) {
  const [mapData, setMapData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [rateLimitReset, setRateLimitReset] = useState(null)

  // Drawer & Modals state
  const [selectedSeatForDrawer, setSelectedSeatForDrawer] = useState(null)
  const [holdModalConfig, setHoldModalConfig] = useState(null) // { selectedSeats: [], kind: 'hold' }
  const [moveModalConfig, setMoveModalConfig] = useState(null) // { bookingId, passenger }

  // Multi-select batch mode
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedSeatIds, setSelectedSeatIds] = useState([])

  // Local ticker for dynamic timed hold countdowns (every 30s)
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now())
    }, 30000)
    return () => clearInterval(timer)
  }, [])

  const fetchSeatMap = useCallback(
    async (isSilent = false) => {
      if (!departureKey) return
      if (!isSilent) setLoading(true)
      else setRefreshing(true)
      setError(null)
      setIsRateLimited(false)

      try {
        const token = getAuthToken()
        const res = await fetch(`/api/departures/${encodeURIComponent(departureKey)}/seat-map`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-store",
          },
        })

        if (res.status === 429) {
          setIsRateLimited(true)
          const retryAfter = res.headers.get("Retry-After")
          setRateLimitReset(retryAfter ? new Date(Date.now() + parseInt(retryAfter, 10) * 1000) : null)
          return
        }

        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.message || data.error || "Failed to load seat map")
        }

        setMapData(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [departureKey],
  )

  // Initial fetch and 60-second visibility-aware polling
  useEffect(() => {
    fetchSeatMap()

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchSeatMap(true)
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchSeatMap(true)
      }
    }, 60000)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      clearInterval(pollInterval)
    }
  }, [fetchSeatMap])

  // Compute countdown remaining for timed holds
  const formatHoldRemaining = useCallback((expiresAt, currentNow) => {
    if (!expiresAt) return "Manual"
    const exp = new Date(expiresAt).getTime()
    const diffMs = exp - currentNow
    if (diffMs <= 0) return "Expired"
    const diffMins = Math.ceil(diffMs / (60 * 1000))
    if (diffMins < 60) return `${diffMins}m`
    const hours = Math.floor(diffMins / 60)
    const mins = diffMins % 60
    if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    const days = Math.floor(hours / 24)
    const remHours = hours % 24
    return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`
  }, [])

  // Enriched seat states for the SeatMap component
  const enrichedSeatStates = useMemo(() => {
    if (!mapData?.seats) return {}
    const states = {}

    for (const [seatId, seatInfo] of Object.entries(mapData.seats)) {
      if (seatInfo.status === "held" && seatInfo.mode === "timed" && seatInfo.expiresAt) {
        const remaining = formatHoldRemaining(seatInfo.expiresAt, nowMs)
        // If expired locally, treat as available until next refresh
        if (remaining === "Expired") {
          states[seatId] = {
            ...seatInfo,
            status: "available",
          }
          continue
        }
        states[seatId] = {
          ...seatInfo,
          remainingText: remaining,
        }
      } else {
        states[seatId] = seatInfo
      }
    }
    return states
  }, [mapData, nowMs, formatHoldRemaining])

  // Extract list of all genuinely available seats for Move Seat selector
  const availableSeatsList = useMemo(() => {
    if (!mapData?.seats) return []
    return Object.values(mapData.seats).filter((s) => s.status === "available")
  }, [mapData])

  // Seat click dispatcher
  const handleSeatClick = (seatId, seatInfo) => {
    if (isMultiSelectMode) {
      if (seatInfo?.status === "available") {
        setSelectedSeatIds((prev) =>
          prev.includes(seatId) ? prev.filter((id) => id !== seatId) : [...prev, seatId],
        )
      }
      return
    }

    // Single click opens action drawer
    setSelectedSeatForDrawer({
      ...seatInfo,
      seatId,
    })
  }

  // Handle book seat shortcut from drawer
  const handleBookFromDrawer = ({ seatId, holdId, holderName, phone }) => {
    if (onBookSeat) {
      onBookSeat({
        tourName: mapData.tourName,
        journeyDate: mapData.journeyDate,
        busType: mapData.busType,
        seatId,
        holdId,
        holderName,
        phone,
      })
    }
  }

  return (
    <PanelErrorBoundary panelName="Live Seat Map">
      <div className="space-y-5">
        {/* Top Navigation & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={onBack}
              icon={<ArrowLeft size={16} />}
              className="shrink-0"
            >
              Back to Departures
            </Button>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-ink">
                  {mapData?.tourName || "Departure"}
                </h2>
                <Badge variant="brand" size="sm">
                  Live Coach Layout
                </Badge>
              </div>
              <p className="text-xs text-ink-muted mt-0.5">
                {mapData?.journeyDate ? formatDisplayDate(mapData.journeyDate) : "—"} • {mapData?.busType || "Coach"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant={isMultiSelectMode ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode)
                setSelectedSeatIds([])
              }}
              icon={<Check size={14} />}
            >
              {isMultiSelectMode ? "Cancel Multi-Select" : "Select Multiple"}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => fetchSeatMap()}
              loading={refreshing}
              icon={<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />}
            >
              Refresh Map
            </Button>
          </div>
        </div>

        {/* Rate limit banner */}
        {isRateLimited && (
          <RateLimitNotice
            featureName="Live Seat Map"
            resetTime={rateLimitReset}
            onRetry={() => fetchSeatMap()}
          />
        )}

        {/* Error message */}
        {error && !isRateLimited && (
          <div className="flex items-center justify-between p-4 rounded-[var(--yh-radius-lg)] bg-danger-soft text-danger border border-danger-border text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
            <Button variant="secondary" size="sm" onClick={() => fetchSeatMap()}>
              Retry
            </Button>
          </div>
        )}

        {/* Loading state */}
        {loading && !mapData && (
          <div className="flex flex-col items-center justify-center p-12 bg-surface rounded-[var(--yh-radius-xl)] border border-border-subtle shadow-xs space-y-3">
            <Spinner size="lg" />
            <p className="text-xs font-semibold text-ink-muted">Loading live coach berth layout...</p>
          </div>
        )}

        {/* Main Content */}
        {!loading && mapData && (
          <div className="space-y-5">
            {/* Summary Counters Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-3 bg-surface rounded-[var(--yh-radius-lg)] border border-border-subtle shadow-xs">
                <span className="text-[11px] font-bold text-ink-muted uppercase tracking-wider block">Total Berths</span>
                <span className="text-xl font-bold text-ink tabular-nums mt-0.5 block">
                  {mapData.counts?.total || 0}
                </span>
              </div>

              <div className="p-3 bg-emerald-500/10 rounded-[var(--yh-radius-lg)] border border-emerald-500/25 shadow-xs">
                <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">Available</span>
                <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums mt-0.5 block">
                  {mapData.counts?.available || 0}
                </span>
              </div>

              <div className="p-3 bg-blue-500/10 rounded-[var(--yh-radius-lg)] border border-blue-500/25 shadow-xs">
                <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 uppercase tracking-wider block">Booked</span>
                <span className="text-xl font-bold text-blue-700 dark:text-blue-300 tabular-nums mt-0.5 block">
                  {mapData.counts?.booked || 0}
                </span>
              </div>

              <div className="p-3 bg-amber-500/15 rounded-[var(--yh-radius-lg)] border border-amber-500/30 shadow-xs">
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">Held (Holds)</span>
                <span className="text-xl font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-0.5 block">
                  {mapData.counts?.held || 0}
                </span>
              </div>

              <div className="p-3 bg-rose-500/10 rounded-[var(--yh-radius-lg)] border border-rose-500/25 shadow-xs">
                <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">Blocked</span>
                <span className="text-xl font-bold text-rose-700 dark:text-rose-300 tabular-nums mt-0.5 block">
                  {mapData.counts?.blocked || 0}
                </span>
              </div>
            </div>

            {/* Accessible Legend */}
            <div className="p-3 bg-surface rounded-[var(--yh-radius-lg)] border border-border-subtle shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 text-xs">
                {/* State legend */}
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-bold text-ink-muted uppercase text-[10px] tracking-wider">Statuses:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm border border-border-subtle bg-surface shadow-xs" />
                    <span className="text-ink">Available</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-slate-200 border border-slate-300 dark:bg-slate-700" />
                    <span className="text-ink">Booked</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-amber-500/25 border border-amber-400" />
                    <span className="text-ink">Held (Timed/Manual)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm bg-rose-500/25 border border-rose-400" />
                    <span className="text-ink">Blocked</span>
                  </div>
                </div>

                {/* Badges legend */}
                <div className="flex flex-wrap items-center gap-3 border-t sm:border-t-0 sm:border-l border-border-subtle pt-2 sm:pt-0 sm:pl-4">
                  <span className="font-bold text-ink-muted uppercase text-[10px] tracking-wider">Cues:</span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="px-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-bold">M</span>
                    <span className="px-1 rounded bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300 font-bold">F</span>
                    <span className="text-ink-muted text-[10px]">Gender</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="font-bold text-emerald-600">✓ Paid</span>
                    <span className="font-bold text-amber-600">½ Partial</span>
                    <span className="font-bold text-rose-600">✗ Unpaid</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px]">
                    <span className="px-1 rounded bg-slate-200 dark:bg-slate-700 font-mono text-[9px]">#G1</span>
                    <span className="text-ink-muted text-[10px]">Group Booking</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-ink-muted mt-2 pt-2 border-t border-border-subtle flex items-center gap-1.5">
                <Info size={13} className="text-brand shrink-0" />
                <span>Tap any seat to open the action drawer (book, hold, block, or move seat). Multi-select mode allows batch holding/blocking.</span>
              </p>
            </div>

            {/* Interactive Coach Map Scrollable Region */}
            <div
              role="region"
              aria-label="Coach Seat Layout"
              className="overflow-x-auto p-4 bg-surface rounded-[var(--yh-radius-xl)] border border-border-subtle shadow-xs focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <SeatMap
                layout={mapData.layoutKey}
                seatStates={enrichedSeatStates}
                selectedIds={selectedSeatIds}
                onSeatClick={handleSeatClick}
                interactiveAll={true}
                size="md"
              />
            </div>

            {/* Multi-Select Floating Action Bar */}
            {isMultiSelectMode && selectedSeatIds.length > 0 && (
              <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-[var(--yh-radius-xl)] bg-surface border-2 border-brand shadow-lg animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2">
                  <Badge variant="brand" size="md">
                    {selectedSeatIds.length} seat(s) selected
                  </Badge>
                  <span className="text-xs font-semibold text-ink">
                    ({selectedSeatIds.join(", ")})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="border-amber-400 text-amber-800 dark:text-amber-200"
                    onClick={() =>
                      setHoldModalConfig({
                        selectedSeats: selectedSeatIds,
                        kind: "hold",
                      })
                    }
                  >
                    Hold {selectedSeatIds.length} Seats
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="border-rose-400 text-rose-800 dark:text-rose-200"
                    onClick={() =>
                      setHoldModalConfig({
                        selectedSeats: selectedSeatIds,
                        kind: "block",
                      })
                    }
                  >
                    Block {selectedSeatIds.length} Seats
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSeatIds([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Slide-Out Action Drawer ── */}
        <SeatActionDrawer
          isOpen={Boolean(selectedSeatForDrawer)}
          onClose={() => setSelectedSeatForDrawer(null)}
          seat={selectedSeatForDrawer}
          departureKey={departureKey}
          onOpenHoldModal={({ seatId, kind }) =>
            setHoldModalConfig({ selectedSeats: [seatId], kind })
          }
          onOpenMoveModal={({ bookingId, passenger }) =>
            setMoveModalConfig({ bookingId, passenger })
          }
          onBookSeat={handleBookFromDrawer}
          onRefresh={() => fetchSeatMap(true)}
        />

        {/* ── Hold / Block Modal ── */}
        {holdModalConfig && (
          <HoldModal
            isOpen={Boolean(holdModalConfig)}
            onClose={() => setHoldModalConfig(null)}
            departureKey={departureKey}
            selectedSeats={holdModalConfig.selectedSeats}
            initialKind={holdModalConfig.kind || "hold"}
            onSuccess={() => {
              setSelectedSeatIds([])
              fetchSeatMap(true)
            }}
          />
        )}

        {/* ── Move Seat Modal ── */}
        {moveModalConfig && (
          <MoveSeatModal
            isOpen={Boolean(moveModalConfig)}
            onClose={() => setMoveModalConfig(null)}
            bookingId={moveModalConfig.bookingId}
            passenger={moveModalConfig.passenger}
            availableSeats={availableSeatsList}
            onSuccess={() => fetchSeatMap(true)}
          />
        )}
      </div>
    </PanelErrorBoundary>
  )
}
