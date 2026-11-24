import { useState, useMemo } from "react"
import { Check, Lock, Clock, Pin, Ban, User, Layers, Info } from "lucide-react"
import { getSeatLayout, DEFAULT_LAYOUT_KEY, resolveSeatId } from "../../../shared/seatLayouts.js"
import { cn } from "../../utils/cn"

/**
 * Reusable, Accessible Coach Seat Map Component
 *
 * Driven by data definitions from shared/seatLayouts.js.
 * Supports sleepers (2x1 38, 2x2 48, 2x2 40) and seaters (2+3 60).
 *
 * @param {Object} props
 * @param {Object|string} props.layout - Layout definition object or layout key
 * @param {Object|Map} [props.seatStates] - Map/object of canonicalId -> { status, passengerName, invoiceNo, ... }
 * @param {Function} [props.onSeatClick] - (seatId, seat) => void
 * @param {string[]} [props.selectedIds=[]] - Array of currently selected seat IDs
 * @param {boolean} [props.readOnly=false] - Whether clicking seats is disabled
 * @param {boolean} [props.interactiveAll=false] - If true, booked, held and blocked seats are also clickable
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Visual density sizing
 * @param {string} [props.className] - Container class name
 */
export default function SeatMap({
  layout: layoutProp,
  seatStates = {},
  onSeatClick,
  selectedIds = [],
  readOnly = false,
  interactiveAll = false,
  size = "md",
  className,
}) {
  const layout = useMemo(() => {
    if (typeof layoutProp === "string") {
      return getSeatLayout(layoutProp) || getSeatLayout(DEFAULT_LAYOUT_KEY)
    }
    return layoutProp || getSeatLayout(DEFAULT_LAYOUT_KEY)
  }, [layoutProp])

  const [activeDeck, setActiveDeck] = useState("lower") // 'lower' | 'upper' | 'all'

  const selectedSet = useMemo(() => {
    return new Set((selectedIds || []).map((id) => resolveSeatId(layout?.key, id)))
  }, [selectedIds, layout])

  const statesMap = useMemo(() => {
    if (seatStates instanceof Map) return seatStates
    const map = new Map()
    if (seatStates && typeof seatStates === "object") {
      for (const [k, v] of Object.entries(seatStates)) {
        map.set(resolveSeatId(layout?.key, k), v)
      }
    }
    return map
  }, [seatStates, layout])

  // Filter seats by active deck (hooks placed before any conditional early returns)
  const lowerSeats = useMemo(() => {
    return layout?.seats ? layout.seats.filter((s) => s.deck === "lower") : []
  }, [layout])

  const upperSeats = useMemo(() => {
    return layout?.seats ? layout.seats.filter((s) => s.deck === "upper") : []
  }, [layout])

  // Count booked and selected
  const bookedCount = useMemo(() => {
    if (!layout?.seats) return 0
    let count = 0
    for (const seat of layout.seats) {
      const state = statesMap.get(seat.id)
      if (state?.status === "booked") count++
    }
    return count
  }, [layout, statesMap])

  if (!layout) {
    return (
      <div className="p-4 rounded-[var(--yh-radius-md)] bg-surface-muted text-ink-muted text-xs text-center">
        No bus layout definition available.
      </div>
    )
  }

  const isSleeper = layout.category === "sleeper"

  const renderSeatButton = (seat) => {
    if (!seat) {
      return <div key="empty" className="min-w-[44px] min-h-[44px] opacity-0 pointer-events-none" />
    }

    const state = statesMap.get(seat.id)
    const status = state?.status || "available"
    const isBooked = status === "booked"
    const isHeld = status === "held"
    const isBlocked = status === "blocked"
    const isSelected = selectedSet.has(seat.id)
    const isAvailable = status === "available" && !isSelected

    let statusText = "available"
    if (isSelected) statusText = "selected"
    else if (isBooked) statusText = "booked"
    else if (isHeld) statusText = "held"
    else if (isBlocked) statusText = "blocked"

    let accessibleName = `Seat ${seat.number}, ${seat.name}, ${statusText}`
    if (isBooked && state?.passengerName) {
      accessibleName += `, booked by ${state.passengerName}, ${state.gender || ""}, payment ${state.paymentState || ""}`
    } else if (isHeld) {
      accessibleName += `, held${state?.holderName ? ` for ${state.holderName}` : ""}${
        state?.remainingText ? ` (${state.remainingText})` : ""
      }`
    } else if (isBlocked) {
      accessibleName += `, blocked${state?.note ? `: ${state.note}` : ""}`
    }

    const isClickable = interactiveAll ? !readOnly : !readOnly && !isBooked && !isHeld && !isBlocked

    const groupTag = state?.bookingRef
      ? state.bookingRef.split("-").slice(-1)[0]
      : state?.groupId
        ? state.groupId.slice(-3).toUpperCase()
        : null

    return (
      <button
        key={seat.id}
        type="button"
        disabled={!isClickable}
        aria-label={accessibleName}
        aria-pressed={isSelected}
        onClick={() => {
          if (isClickable && onSeatClick) {
            onSeatClick(seat.id, { ...seat, ...state })
          }
        }}
        className={cn(
          "relative flex flex-col items-center justify-between p-1 rounded-[var(--yh-radius-md)] border text-left transition-all",
          "min-w-[48px] min-h-[48px] sm:min-w-[54px] sm:min-h-[52px]",
          "focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1",
          // Available state
          isAvailable && [
            "bg-surface border-border-subtle text-ink hover:border-brand hover:bg-surface-hover shadow-xs cursor-pointer",
          ],
          // Selected state
          isSelected && [
            "bg-brand text-brand-fg border-brand font-bold shadow-sm ring-1 ring-brand cursor-pointer",
          ],
          // Booked state
          isBooked && [
            "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-200",
            interactiveAll ? "cursor-pointer hover:border-slate-400 hover:shadow-xs" : "cursor-not-allowed opacity-90",
          ],
          // Held state
          isHeld && [
            "bg-amber-500/15 border-amber-400 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-200",
            interactiveAll ? "cursor-pointer hover:border-amber-500 hover:shadow-xs" : "cursor-not-allowed opacity-90",
          ],
          // Blocked state
          isBlocked && [
            "bg-rose-500/15 border-rose-400 text-rose-900 dark:bg-rose-950/40 dark:border-rose-700 dark:text-rose-200",
            interactiveAll ? "cursor-pointer hover:border-rose-500 hover:shadow-xs" : "cursor-not-allowed opacity-90",
          ],
          // Sizing adjustments
          size === "sm" && "min-w-[44px] min-h-[44px] p-0.5 text-[10px]",
        )}
      >
        {/* Top bar: Seat number & Indicators */}
        <div className="flex items-center justify-between w-full gap-0.5 px-0.5">
          <span
            className={cn(
              "font-bold tabular-nums text-xs leading-none",
              isSelected
                ? "text-brand-fg"
                : isBooked
                  ? "text-ink"
                  : isHeld
                    ? "text-amber-800 dark:text-amber-300"
                    : isBlocked
                      ? "text-rose-800 dark:text-rose-300"
                      : "text-ink",
            )}
          >
            {seat.number}
          </span>

          <div className="flex items-center gap-0.5 shrink-0" aria-hidden="true">
            {isSelected ? (
              <Check size={12} className="text-brand-fg stroke-[3]" />
            ) : isBooked ? (
              <div className="flex items-center gap-0.5">
                {/* Payment Mark */}
                <span
                  className={cn(
                    "text-[10px] font-black leading-none",
                    state.paymentState === "paid" && "text-emerald-600 dark:text-emerald-400",
                    state.paymentState === "partial" && "text-amber-600 dark:text-amber-400",
                    state.paymentState === "unpaid" && "text-rose-600 dark:text-rose-400",
                  )}
                  title={`Payment: ${state.paymentState || "unpaid"}`}
                >
                  {state.paymentState === "paid" ? "✓" : state.paymentState === "partial" ? "½" : "✗"}
                </span>
                {/* Gender Mark */}
                {state.gender && (
                  <span
                    className={cn(
                      "px-0.5 rounded text-[8px] font-bold leading-none",
                      state.gender.toLowerCase() === "female"
                        ? "bg-purple-200 text-purple-800 dark:bg-purple-900/60 dark:text-purple-300"
                        : state.gender.toLowerCase() === "male"
                          ? "bg-blue-200 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300"
                          : "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-300",
                    )}
                    title={`Gender: ${state.gender}`}
                  >
                    {state.gender.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            ) : isHeld ? (
              <span className="text-amber-600 dark:text-amber-400" title="Held Seat">
                {state.mode === "manual" ? <Pin size={10} /> : <Clock size={10} />}
              </span>
            ) : isBlocked ? (
              <span className="text-rose-600 dark:text-rose-400" title="Blocked Seat">
                <Lock size={10} />
              </span>
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            )}
          </div>
        </div>

        {/* Center / Bottom: Cabin / Berth display & contextual tags */}
        <div className="w-full text-center mt-0.5 px-0.5">
          <span
            className={cn(
              "block text-[10px] font-semibold truncate leading-tight",
              isSelected
                ? "text-brand-fg"
                : isBooked
                  ? "text-ink"
                  : isHeld
                    ? "text-amber-900 dark:text-amber-200"
                    : isBlocked
                      ? "text-rose-900 dark:text-rose-200"
                      : "text-ink-secondary",
            )}
          >
            {isSleeper ? (seat.deck === "lower" ? `${seat.cabin} L` : `${seat.cabin} U`) : seat.name}
          </span>

          {isBooked && (
            <div className="flex items-center justify-center gap-0.5 mt-0.5">
              {groupTag && (
                <span
                  className="px-1 py-0.2 rounded text-[7px] font-mono bg-slate-200/90 dark:bg-slate-700/90 text-slate-700 dark:text-slate-300 shrink-0"
                  title={`Group Ref: ${state.bookingRef || state.groupId}`}
                >
                  #{groupTag}
                </span>
              )}
              {state.passengerName && (
                <span
                  className="block text-[8px] truncate font-medium text-ink-muted max-w-[42px]"
                  title={state.passengerName}
                >
                  {state.passengerName.split(" ")[0]}
                </span>
              )}
            </div>
          )}

          {isHeld && (
            <span
              className="block text-[8px] font-bold text-amber-700 dark:text-amber-300 truncate mt-0.5"
              title={state.holderName || "Held"}
            >
              {state.remainingText || (state.mode === "manual" ? "Manual" : "Held")}
            </span>
          )}

          {isBlocked && (
            <span className="block text-[8px] font-bold text-rose-700 dark:text-rose-300 truncate mt-0.5">
              Blocked
            </span>
          )}
        </div>
      </button>
    )
  }

  const renderDeckGrid = (deckName, seatsList) => {
    const isLower = deckName === "lower"
    const maxCols = layout.grid.cols
    const maxRows = layout.grid.rows
    const aisleCol = layout.grid.aisleCol

    // Group seats by row and col
    const seatMap = new Map()
    seatsList.forEach((s) => {
      seatMap.set(`${s.row}-${s.col}`, s)
    })

    const rowsArray = Array.from({ length: maxRows }, (_, i) => i + 1)
    const colsArray = Array.from({ length: maxCols }, (_, i) => i + 1)

    return (
      <div className="flex flex-col items-center p-3 sm:p-4 rounded-[var(--yh-radius-lg)] border border-border-subtle bg-surface-muted/40 shadow-xs">
        {/* Deck Title Bar */}
        <div className="flex items-center justify-between w-full mb-3 px-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-2.5 h-2.5 rounded-full",
                isLower ? "bg-[var(--yh-success)]" : "bg-[var(--yh-brand)]",
              )}
            />
            <span className="text-xs font-bold text-ink uppercase tracking-wider">
              {isLower ? "Lower Deck" : "Upper Deck"}
            </span>
            <span className="text-[11px] text-ink-muted">
              ({seatsList.length} berths)
            </span>
          </div>

          <span className="text-[11px] font-medium text-ink-muted">
            {seatsList.filter((s) => statesMap.get(s.id)?.status === "booked").length} booked
          </span>
        </div>

        {/* Coach Outline Container */}
        <div className="relative w-full max-w-md bg-surface p-3 rounded-[var(--yh-radius-xl)] border-2 border-border-subtle shadow-inner">
          {/* Front / Driver Indicator */}
          <div className="flex items-center justify-between px-3 py-1 mb-3 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-ink-muted uppercase tracking-wider border border-border-subtle">
            <div className="flex items-center gap-1.5">
              <span className="text-xs" aria-hidden="true">☸</span>
              <span>Front / Driver</span>
            </div>
            <span className="text-[9px]">Door</span>
          </div>

          {/* Grid Rows */}
          <div className="flex flex-col gap-2">
            {rowsArray.map((rowNum) => (
              <div key={`row-${rowNum}`} className="flex items-center justify-between gap-1.5">
                {colsArray.map((colNum) => {
                  if (colNum === aisleCol) {
                    return (
                      <div
                        key={`aisle-${rowNum}-${colNum}`}
                        aria-hidden="true"
                        className="w-5 sm:w-7 flex items-center justify-center text-[9px] font-bold text-ink-muted/50 uppercase select-none"
                      >
                        ·
                      </div>
                    )
                  }

                  const seat = seatMap.get(`${rowNum}-${colNum}`)
                  if (!seat) {
                    return (
                      <div
                        key={`empty-${rowNum}-${colNum}`}
                        aria-hidden="true"
                        className="min-w-[48px] min-h-[48px] sm:min-w-[54px] sm:min-h-[52px] opacity-0"
                      />
                    )
                  }

                  return renderSeatButton(seat)
                })}
              </div>
            ))}
          </div>

          {/* Rear / Back Indicator */}
          <div className="mt-3 py-1 text-center text-[9px] font-bold text-ink-muted/60 uppercase tracking-widest border-t border-border-subtle">
            Rear / Back of Coach
          </div>
        </div>
      </div>
    )
  }

  const renderSeaterGrid = () => {
    const maxCols = layout.grid.cols
    const maxRows = layout.grid.rows
    const aisleCol = layout.grid.aisleCol

    const seatMap = new Map()
    layout.seats.forEach((s) => {
      seatMap.set(`${s.row}-${s.col}`, s)
    })

    const rowsArray = Array.from({ length: maxRows }, (_, i) => i + 1)
    const colsArray = Array.from({ length: maxCols }, (_, i) => i + 1)

    return (
      <div className="flex flex-col items-center p-3 sm:p-4 rounded-[var(--yh-radius-lg)] border border-border-subtle bg-surface-muted/40 shadow-xs">
        <div className="relative w-full max-w-lg bg-surface p-3 rounded-[var(--yh-radius-xl)] border-2 border-border-subtle shadow-inner">
          {/* Front / Driver Indicator */}
          <div className="flex items-center justify-between px-3 py-1 mb-3 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-ink-muted uppercase tracking-wider border border-border-subtle">
            <div className="flex items-center gap-1.5">
              <span className="text-xs" aria-hidden="true">☸</span>
              <span>Front / Driver</span>
            </div>
            <span className="text-[9px]">Entrance Door</span>
          </div>

          {/* Grid Rows */}
          <div className="flex flex-col gap-2">
            {rowsArray.map((rowNum) => (
              <div key={`row-${rowNum}`} className="flex items-center justify-between gap-1.5">
                {colsArray.map((colNum) => {
                  if (colNum === aisleCol) {
                    return (
                      <div
                        key={`aisle-${rowNum}-${colNum}`}
                        aria-hidden="true"
                        className="w-6 sm:w-8 flex items-center justify-center text-[9px] font-bold text-ink-muted/50 uppercase select-none"
                      >
                        R{rowNum}
                      </div>
                    )
                  }

                  const seat = seatMap.get(`${rowNum}-${colNum}`)
                  if (!seat) {
                    return (
                      <div
                        key={`empty-${rowNum}-${colNum}`}
                        aria-hidden="true"
                        className="min-w-[44px] min-h-[44px] opacity-0"
                      />
                    )
                  }

                  return renderSeatButton(seat)
                })}
              </div>
            ))}
          </div>

          {/* Rear / Back Indicator */}
          <div className="mt-3 py-1 text-center text-[9px] font-bold text-ink-muted/60 uppercase tracking-widest border-t border-border-subtle">
            Rear / Back of Coach • Emergency Exit
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4 w-full", className)}>
      {/* Header bar: Layout summary & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-brand shrink-0" />
          <span className="text-xs font-bold text-ink">{layout.label}</span>
          <span className="text-[11px] text-ink-muted">
            • {bookedCount}/{layout.totalSeats} Booked
          </span>
        </div>

        {/* Status Legend (Non-color reliant with patterns & labels) */}
        <div className="flex flex-wrap items-center gap-3 text-[11px]" aria-label="Seat Status Legend">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded border border-border-subtle bg-surface shadow-xs" />
            <span className="text-ink">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-brand flex items-center justify-center text-brand-fg">
              <Check size={9} strokeWidth={3} />
            </span>
            <span className="text-ink font-medium">Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-200 dark:bg-slate-700 border border-slate-300 flex items-center justify-center text-slate-500">
              <Lock size={9} />
            </span>
            <span className="text-ink-muted">Booked</span>
          </div>
        </div>
      </div>

      {/* Deck Selector for Sleepers */}
      {isSleeper && (
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex p-1 rounded-[var(--yh-radius-md)] bg-surface-muted border border-border-subtle gap-1" role="tablist" aria-label="Select Deck View">
            <button
              type="button"
              role="tab"
              aria-selected={activeDeck === "lower"}
              onClick={() => setActiveDeck("lower")}
              className={cn(
                "px-3 py-1.5 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-all cursor-pointer min-h-[36px]",
                activeDeck === "lower"
                  ? "bg-surface text-ink font-bold shadow-xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              Lower Deck ({lowerSeats.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDeck === "upper"}
              onClick={() => setActiveDeck("upper")}
              className={cn(
                "px-3 py-1.5 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-all cursor-pointer min-h-[36px]",
                activeDeck === "upper"
                  ? "bg-surface text-ink font-bold shadow-xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              Upper Deck ({upperSeats.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeDeck === "all"}
              onClick={() => setActiveDeck("all")}
              className={cn(
                "hidden sm:inline-flex px-3 py-1.5 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-all cursor-pointer min-h-[36px]",
                activeDeck === "all"
                  ? "bg-surface text-ink font-bold shadow-xs"
                  : "text-ink-muted hover:text-ink",
              )}
            >
              Both Decks
            </button>
          </div>

          <div className="text-[11px] text-ink-muted flex items-center gap-1">
            <Info size={12} className="shrink-0" />
            <span>Click any available berth to select</span>
          </div>
        </div>
      )}

      {/* Internal Accessible Scroll Container (Zero page horizontal scroll) */}
      <div
        role="region"
        aria-label="Coach Seat Layout"
        className="overflow-x-auto overflow-y-auto max-w-full pb-2 focus:outline-none focus:ring-1 focus:ring-brand rounded-[var(--yh-radius-lg)]"
      >
        {isSleeper ? (
          activeDeck === "all" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-[560px]">
              {renderDeckGrid("lower", lowerSeats)}
              {renderDeckGrid("upper", upperSeats)}
            </div>
          ) : activeDeck === "upper" ? (
            <div className="flex justify-center min-w-[320px]">
              {renderDeckGrid("upper", upperSeats)}
            </div>
          ) : (
            <div className="flex justify-center min-w-[320px]">
              {renderDeckGrid("lower", lowerSeats)}
            </div>
          )
        ) : (
          <div className="flex justify-center min-w-[340px]">
            {renderSeaterGrid()}
          </div>
        )}
      </div>
    </div>
  )
}
