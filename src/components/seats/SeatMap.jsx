import { useMemo, useState, useEffect } from "react"
import { Check, Lock, Clock, Pin, Layers, Link2 } from "lucide-react"
import { getSeatLayout, DEFAULT_LAYOUT_KEY, resolveSeatId } from "../../../shared/seatLayouts.js"
import { cn } from "../../utils/cn"
import { Tabs } from "../ui/Tabs"
import { Badge } from "../ui/Badge"

/**
 * Reusable, Accessible Coach Seat Map Component with Deck Tabs (Part 6S-4)
 *
 * Driven by canonical data definitions from shared/seatLayouts.js:
 * - Sleeper layouts (sleeper-2x1-38, sleeper-2x2-48, sleeper-2x2-40):
 *   Separated Lower and Upper decks displayed via accessible Design System Tabs.
 *   - Lower deck screen: Front/driver strip, Left column (1 berth for 2x1, 2 for 2x2),
 *     central aisle, Right column (2 berths side-by-side), rear section (B1 for 2x1-38).
 *   - Upper deck screen: Front/driver strip, Left column, central aisle, Right column,
 *     rear section (B2 for 2x1-38).
 *   - Dedicated Rear Berths tab for quick inspection of B1/B2 rear berths.
 * - Seater layout (seater-2x3-60):
 *   Single deck display with Front/driver, 2+3 seating with central aisle, rear exit.
 *
 * @param {Object} props
 * @param {Object|string} props.layout - Layout definition object or layout key
 * @param {Object|Map} [props.seatStates] - Map/object of canonicalId -> state
 * @param {Function} [props.onSeatClick] - (seatId, seat) => void
 * @param {string[]} [props.selectedIds=[]] - Array of currently selected seat IDs
 * @param {boolean} [props.readOnly=false] - Whether clicking seats is disabled
 * @param {boolean} [props.interactiveAll=false] - If true, booked, held and blocked seats are also clickable
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Visual density sizing
 * @param {string} [props.className] - Container class name
 * @param {string} [props.lang='en'] - 'en' | 'gu' | 'hi'
 * @param {'lower'|'upper'|'rear'} [props.activeDeck] - Optional controlled deck tab
 * @param {Function} [props.onDeckChange] - Callback when active deck tab changes
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
  lang = "en",
  activeDeck: activeDeckProp,
  onDeckChange,
}) {
  const layout = useMemo(() => {
    if (typeof layoutProp === "string") {
      return getSeatLayout(layoutProp) || getSeatLayout(DEFAULT_LAYOUT_KEY)
    }
    return layoutProp || getSeatLayout(DEFAULT_LAYOUT_KEY)
  }, [layoutProp])

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

  const isSleeper = layout?.category === "sleeper"
  const hasRearSeats = Boolean(layout?.seats?.some((s) => s.section === "rear"))

  // Auto-select starting deck tab based on current selected seat if present
  const defaultStartingDeck = useMemo(() => {
    if (!isSleeper) return "lower"
    if (selectedIds && selectedIds.length > 0) {
      for (const id of selectedIds) {
        const canonical = resolveSeatId(layout?.key, id)
        const seat = layout?.seats?.find((s) => s.id === canonical)
        if (seat?.section === "rear") return "rear"
        if (seat?.deck === "upper") return "upper"
        if (seat?.deck === "lower") return "lower"
      }
    }
    return "lower"
  }, [selectedIds, layout, isSleeper])

  const [internalDeck, setInternalDeck] = useState(defaultStartingDeck)
  const currentDeck = activeDeckProp !== undefined ? activeDeckProp : internalDeck

  const handleDeckTabSelect = (deckId) => {
    if (activeDeckProp === undefined) {
      setInternalDeck(deckId)
    }
    if (onDeckChange) {
      onDeckChange(deckId)
    }
  }

  // Update internal deck if selectedIds change externally
  useEffect(() => {
    if (selectedIds && selectedIds.length > 0 && activeDeckProp === undefined) {
      const canonical = resolveSeatId(layout?.key, selectedIds[selectedIds.length - 1])
      const seat = layout?.seats?.find((s) => s.id === canonical)
      if (seat) {
        if (seat.section === "rear" && internalDeck !== "rear" && internalDeck !== seat.deck) {
          // Keep current view or sync
        } else if (seat.deck && seat.deck !== internalDeck && internalDeck !== "rear") {
          setInternalDeck(seat.deck)
        }
      }
    }
  }, [selectedIds, layout]) // eslint-disable-line react-hooks/exhaustive-deps

  // Deck-wise and bus-wide counts
  const { summaryCounts, deckCounts } = useMemo(() => {
    const summary = { booked: 0, held: 0, blocked: 0, available: 0, total: layout?.totalSeats || 0 }
    const decks = {
      lower: { total: 0, booked: 0, held: 0, blocked: 0, available: 0, selected: 0 },
      upper: { total: 0, booked: 0, held: 0, blocked: 0, available: 0, selected: 0 },
      rear: { total: 0, booked: 0, held: 0, blocked: 0, available: 0, selected: 0 },
    }

    if (!layout?.seats) return { summaryCounts: summary, deckCounts: decks }

    for (const seat of layout.seats) {
      const state = statesMap.get(seat.id)
      const status = state?.status || "available"
      const isSel = selectedSet.has(seat.id)
      const deckKey = seat.deck === "upper" ? "upper" : "lower"

      // Summary
      if (status === "booked") summary.booked++
      else if (status === "held") summary.held++
      else if (status === "blocked") summary.blocked++

      // Deck
      decks[deckKey].total++
      if (status === "booked") decks[deckKey].booked++
      else if (status === "held") decks[deckKey].held++
      else if (status === "blocked") decks[deckKey].blocked++
      else decks[deckKey].available++
      if (isSel) decks[deckKey].selected++

      // Rear
      if (seat.section === "rear") {
        decks.rear.total++
        if (status === "booked") decks.rear.booked++
        else if (status === "held") decks.rear.held++
        else if (status === "blocked") decks.rear.blocked++
        else decks.rear.available++
        if (isSel) decks.rear.selected++
      }
    }

    summary.available = summary.total - summary.booked - summary.held - summary.blocked
    return { summaryCounts: summary, deckCounts: decks }
  }, [layout, statesMap, selectedSet])

  // Localized headers dictionary
  const LABELS = useMemo(() => ({
    front: lang === "gu" ? "▲ આગળ" : lang === "hi" ? "▲ आगे" : "▲ Front",
    driver: lang === "gu" ? "ડ્રાઇવર" : lang === "hi" ? "ड्राइवर" : "Driver",
    lowerDeck: lang === "gu" ? "નીચેનો ડેક" : lang === "hi" ? "निचला ડેक" : "Lower deck",
    upperDeck: lang === "gu" ? "ઉપરનો ડેક" : lang === "hi" ? "ऊपरी डेक" : "Upper deck",
    rearSeats: lang === "gu" ? "પાછળની સીટ (Rear)" : lang === "hi" ? "पिछली सीटें (Rear)" : "Rear berths (2)",
    leftSide: lang === "gu" ? "ડાબી બાજુ" : lang === "hi" ? "बाईं ओर" : "Left Berth",
    rightSide: lang === "gu" ? "જમણી બાજુ" : lang === "hi" ? "दायीં ओर" : "Right Berths",
    aisle: lang === "gu" ? "રસ્તો" : lang === "hi" ? "गलियारा" : "SLEEPER",
    rearSection: lang === "gu" ? "પાછળનો વિભાગ (Rear Cabin)" : lang === "hi" ? "पिछला केबिन (Rear)" : "Rear Cabin",
    emergencyExit: lang === "gu" ? "પાછળનો ભાગ • ઇમરજન્સી એક્ઝિટ" : lang === "hi" ? "पिछला भाग • आपातकालीन निकास" : "Rear / Back of Coach • Emergency Exit",
  }), [lang])

  // Sleeper Deck Tab Items (must be defined before any early return)
  const deckTabItems = useMemo(() => {
    if (!isSleeper) return []

    const items = [
      {
        id: "lower",
        label: (
          <span className="flex items-center gap-1.5">
            <span>{LABELS.lowerDeck}</span>
            <span className="text-[11px] font-normal text-ink-muted">
              ({deckCounts.lower.booked}/{deckCounts.lower.total})
            </span>
          </span>
        ),
        badge: deckCounts.lower.selected > 0 ? (
          <Badge variant="primary" size="sm">
            {deckCounts.lower.selected} selected
          </Badge>
        ) : null,
      },
      {
        id: "upper",
        label: (
          <span className="flex items-center gap-1.5">
            <span>{LABELS.upperDeck}</span>
            <span className="text-[11px] font-normal text-ink-muted">
              ({deckCounts.upper.booked}/{deckCounts.upper.total})
            </span>
          </span>
        ),
        badge: deckCounts.upper.selected > 0 ? (
          <Badge variant="primary" size="sm">
            {deckCounts.upper.selected} selected
          </Badge>
        ) : null,
      },
    ]

    if (hasRearSeats) {
      items.push({
        id: "rear",
        label: (
          <span className="flex items-center gap-1.5">
            <span>{LABELS.rearSeats}</span>
            <span className="text-[11px] font-normal text-ink-muted">
              ({deckCounts.rear.booked}/{deckCounts.rear.total})
            </span>
          </span>
        ),
        badge: deckCounts.rear.selected > 0 ? (
          <Badge variant="primary" size="sm">
            {deckCounts.rear.selected} selected
          </Badge>
        ) : null,
      })
    }

    return items
  }, [isSleeper, hasRearSeats, deckCounts, LABELS])

  if (!layout) {
    return (
      <div className="p-4 rounded-[var(--yh-radius-md)] bg-surface-muted text-ink-muted text-xs text-center">
        No bus layout definition available.
      </div>
    )
  }

  const renderSeatButton = (seat) => {
    if (!seat) return null

    const state = statesMap.get(seat.id)
    const status = state?.status || "available"
    const isBooked = status === "booked"
    const isHeld = status === "held"
    const isBlocked = status === "blocked"
    const isSelected = selectedSet.has(seat.id)
    const isAvailable = status === "available" && !isSelected
    const isLadies = Boolean(state?.ladies || seat?.ladies)
    const pairWith = state?.pairWith || seat?.pairWith || null

    let statusText = "available"
    if (isSelected) statusText = "selected"
    else if (isBooked) statusText = "booked"
    else if (isHeld) statusText = "held"
    else if (isBlocked) statusText = "blocked"

    let accessibleName = `Seat ${seat.number}, ${seat.name}, ${statusText}`
    if (isLadies) accessibleName += ", ladies reserved"
    if (pairWith) accessibleName += `, couple pair with ${pairWith}`

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

    const groupTag = state?.groupName
      ? state.groupName.slice(0, 8)
      : state?.bookingRef
        ? state.bookingRef.split("-").slice(-1)[0]
        : state?.groupId
          ? state.groupId.slice(-3).toUpperCase()
          : null

    return (
      <button
        key={seat.id}
        type="button"
        data-seat-id={seat.id}
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
          "w-full min-h-[46px] min-w-[44px]",
          "focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1",
          // Available state
          isAvailable && [
            "bg-surface border-border-subtle text-ink hover:border-brand hover:bg-surface-hover shadow-2xs cursor-pointer",
            isLadies && "border-purple-300 bg-purple-50/40 dark:border-purple-800 dark:bg-purple-950/20",
            pairWith && "border-sky-300 bg-sky-50/40 dark:border-sky-800 dark:bg-sky-950/20",
          ],
          // Selected state
          isSelected && [
            "bg-brand text-brand-fg border-brand font-bold shadow-xs ring-2 ring-brand cursor-pointer",
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
          // Density sizing
          size === "sm" && "min-h-[40px] p-0.5 text-[10px]",
        )}
      >
        {/* Top row: Seat Number & Indicators */}
        <div className="flex items-center justify-between w-full gap-0.5 px-0.5">
          <div className="flex items-center gap-1">
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
              #{seat.number}
            </span>

            {/* Ladies mark */}
            {isLadies && (
              <span
                className="text-[11px] font-black leading-none text-purple-600 dark:text-purple-400"
                title="Ladies Reserved Seat"
                aria-hidden="true"
              >
                ♀
              </span>
            )}

            {/* Couple Pair mark */}
            {pairWith && (
              <span
                className="text-sky-600 dark:text-sky-400"
                title={`Couple pair with ${pairWith}`}
                aria-hidden="true"
              >
                <Link2 size={10} />
              </span>
            )}
          </div>

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

                {/* Gender Badge */}
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

        {/* Center / Bottom: Seat Name & Passenger or Countdown details */}
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
            {seat.name}
          </span>

          {/* Passenger First Name (Booked) */}
          {isBooked && state?.passengerName && (
            <span
              className={cn(
                "block text-[9px] font-medium truncate",
                isSelected ? "text-brand-fg/90" : "text-slate-600 dark:text-slate-300",
              )}
            >
              {state.passengerName.split(" ")[0]}
            </span>
          )}

          {/* Group booking indicator */}
          {isBooked && groupTag && (
            <span
              className={`block text-[8px] font-mono leading-none ${
                state?.groupName
                  ? "font-bold text-brand bg-brand-soft/70 px-0.5 py-0.5 rounded border border-brand/20 truncate max-w-[55px]"
                  : "text-ink-muted/80"
              }`}
            >
              {state?.groupName ? `👥 ${groupTag}` : `#${groupTag}`}
            </span>
          )}

          {/* Countdown timer for timed hold */}
          {isHeld && state?.remainingText && (
            <span className="block text-[9px] font-mono font-bold text-amber-700 dark:text-amber-300 leading-none mt-0.5">
              {state.remainingText}
            </span>
          )}

          {/* Manual hold indicator */}
          {isHeld && state?.mode === "manual" && (
            <span className="block text-[8px] font-bold text-amber-800 dark:text-amber-200 leading-none mt-0.5">
              Manual
            </span>
          )}

          {/* Block note */}
          {isBlocked && (
            <span className="block text-[8px] font-bold text-rose-800 dark:text-rose-200 leading-none mt-0.5 truncate">
              {state?.note || "Blocked"}
            </span>
          )}
        </div>
      </button>
    )
  }

  // Render a Single Deck Screen (Lower or Upper)
  const renderDeckScreen = (deck) => {
    const rowsCount = layout.grid.rows // 6 for 2x1 and 2x2-48; 5 for 2x2-40
    const rowsArray = Array.from({ length: rowsCount }, (_, i) => i + 1)

    // Build index of seats on this deck
    const seatMap = new Map()
    for (const seat of layout.seats) {
      if (seat.deck === deck && seat.section === "main") {
        const key = `${seat.row}-${seat.side}-${seat.slot}`
        seatMap.set(key, seat)
      }
    }

    const deckRearSeats = layout.seats.filter(
      (s) => s.section === "rear" && (s.deck === deck || !s.deck),
    )

    const is2x1 = layout.key === "sleeper-2x1-38"

    return (
      <div className="w-full max-w-xl mx-auto space-y-3">
        {/* Coach Body Outer Shell */}
        <div className="w-full bg-surface p-2.5 sm:p-4 rounded-[var(--yh-radius-2xl)] border-2 border-border-subtle shadow-inner space-y-3">
          {/* 1. Yellow Front Strip with "▲ Front" and "Driver" */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs font-bold uppercase tracking-wide">
            <span className="flex items-center gap-1.5 font-black">{LABELS.front}</span>
            <div className="flex items-center gap-1.5 font-black">
              <span className="text-sm" aria-hidden="true">☸</span>
              <span>{LABELS.driver}</span>
            </div>
          </div>

          {/* 2. Column Headers: Left Berth(s) | Aisle | Right Berths */}
          <div className={cn(
            "grid gap-2 text-center text-[10px] sm:text-xs font-bold text-ink-muted uppercase border-b border-border-subtle pb-1.5",
            is2x1
              ? "grid-cols-[1fr_36px_2fr] sm:grid-cols-[1fr_44px_2fr]"
              : "grid-cols-[1fr_36px_1fr] sm:grid-cols-[1fr_44px_1fr]",
          )}>
            <div className="truncate px-0.5">
              {is2x1 ? (deck === "lower" ? "Left Berth (L1-L6)" : "Left Berth (U1-U6)") : (deck === "lower" ? "Left Berths (Lower)" : "Left Berths (Upper)")}
            </div>
            <div className="text-[9px] font-black tracking-widest text-ink-muted/60 self-center">
              ||
            </div>
            <div className="truncate px-0.5">
              {deck === "lower" ? "Right Berths (Lower)" : "Right Berths (Upper)"}
            </div>
          </div>

          {/* 3. Main Berth Rows */}
          <div className="space-y-2">
            {rowsArray.map((rowNum) => {
              const left1 = seatMap.get(`${rowNum}-left-1`)
              const left2 = seatMap.get(`${rowNum}-left-2`)
              const right1 = seatMap.get(`${rowNum}-right-1`)
              const right2 = seatMap.get(`${rowNum}-right-2`)

              const boxLabel = deck === "lower" ? `L${rowNum}` : `U${rowNum}`

              return (
                <div
                  key={`deck-${deck}-row-${rowNum}`}
                  className={cn(
                    "grid gap-2 items-stretch",
                    is2x1
                      ? "grid-cols-[1fr_36px_2fr] sm:grid-cols-[1fr_44px_2fr]"
                      : "grid-cols-[1fr_36px_1fr] sm:grid-cols-[1fr_44px_1fr]",
                  )}
                >
                  {/* Left Compartment */}
                  <div className="flex flex-col gap-1 p-1 rounded-lg border border-border-subtle/80 bg-surface-muted/30">
                    <span className="text-[9px] font-extrabold text-ink-muted/70 text-center uppercase tracking-wider">
                      {boxLabel}
                    </span>
                    {is2x1 ? (
                      renderSeatButton(left1)
                    ) : (
                      <div className="grid grid-cols-2 gap-1">
                        {renderSeatButton(left1)}
                        {renderSeatButton(left2)}
                      </div>
                    )}
                  </div>

                  {/* Central Walking Aisle */}
                  <div
                    aria-hidden="true"
                    className="flex flex-col items-center justify-center border-x-2 border-dashed border-border-subtle/60 text-[9px] font-black text-ink-muted/50 select-none py-1"
                  >
                    <span>{boxLabel}</span>
                  </div>

                  {/* Right Compartment (2 berths side-by-side) */}
                  <div className="flex flex-col gap-1 p-1 rounded-lg border border-border-subtle/80 bg-surface-muted/30">
                    <span className="text-[9px] font-extrabold text-ink-muted/70 text-center uppercase tracking-wider">
                      {boxLabel}
                    </span>
                    <div className="grid grid-cols-2 gap-1">
                      {renderSeatButton(right1)}
                      {renderSeatButton(right2)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* 4. Rear Section (if this deck holds rear berth) */}
          {deckRearSeats.length > 0 && (
            <div className="mt-3 pt-2.5 border-t-2 border-dashed border-border-subtle">
              <div className="text-center text-[10px] font-extrabold text-ink-muted uppercase tracking-wider mb-1.5">
                {LABELS.rearSection} ({deck === "lower" ? "Berth B1" : "Berth B2"})
              </div>
              <div className="max-w-xs mx-auto">
                {deckRearSeats.map((rs) => (
                  <div
                    key={rs.id}
                    className="flex flex-col gap-1 p-1.5 rounded-lg border border-border-subtle bg-surface-muted/40"
                  >
                    <span className="text-[9px] font-extrabold text-ink-muted/80 text-center uppercase">
                      Box {rs.box} ({deck === "lower" ? "Lower Deck Rear" : "Upper Deck Rear"})
                    </span>
                    {renderSeatButton(rs)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Emergency Exit / Back of Coach */}
          <div className="mt-2 py-1 text-center text-[9px] font-bold text-ink-muted/60 uppercase tracking-widest border-t border-border-subtle">
            {LABELS.emergencyExit}
          </div>
        </div>
      </div>
    )
  }

  // Dedicated Rear Screen for 2x1-38
  const renderRearScreen = () => {
    const rearSeats = layout.seats.filter((s) => s.section === "rear")

    return (
      <div className="w-full max-w-md mx-auto space-y-3">
        <div className="w-full bg-surface p-3 sm:p-4 rounded-[var(--yh-radius-2xl)] border-2 border-border-subtle shadow-inner space-y-3">
          <div className="text-center text-xs font-bold text-ink-muted uppercase tracking-wider pb-1 border-b border-border-subtle">
            Rear Berths (B1 Lower • B2 Upper)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rearSeats.map((rs) => (
              <div
                key={rs.id}
                className="flex flex-col gap-1.5 p-2 rounded-lg border border-border-subtle bg-surface-muted/40"
              >
                <div className="flex items-center justify-between text-[10px] font-extrabold text-ink-muted uppercase">
                  <span>Box {rs.box}</span>
                  <Badge variant="neutral" size="sm">
                    {rs.deck === "lower" ? "Lower Deck" : "Upper Deck"}
                  </Badge>
                </div>
                {renderSeatButton(rs)}
              </div>
            ))}
          </div>

          <div className="py-1 text-center text-[9px] font-bold text-ink-muted/60 uppercase tracking-widest border-t border-border-subtle">
            {LABELS.emergencyExit}
          </div>
        </div>
      </div>
    )
  }

  // Render Seater Grid (seater-2x3-60)
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
      <div className="flex flex-col items-center p-3 sm:p-4 rounded-[var(--yh-radius-xl)] border border-border-subtle bg-surface-muted/40 shadow-xs w-full max-w-xl mx-auto">
        <div className="relative w-full bg-surface p-3 rounded-[var(--yh-radius-xl)] border-2 border-border-subtle shadow-inner">
          {/* Front / Driver Indicator */}
          <div className="flex items-center justify-between px-3 py-1.5 mb-3 rounded-md bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[10px] font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wider">
            <span className="font-black">{LABELS.front}</span>
            <div className="flex items-center gap-1.5 font-black">
              <span className="text-xs" aria-hidden="true">☸</span>
              <span>{LABELS.driver}</span>
            </div>
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
            {LABELS.emergencyExit}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3 w-full", className)}>
      {/* 1. Whole-Bus Summary Bar & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border-subtle">
        <div className="flex flex-wrap items-center gap-2">
          <Layers size={16} className="text-brand shrink-0" />
          <span className="text-xs font-bold text-ink">{layout.label}</span>
          <span className="text-[11px] text-ink-muted">
            • {summaryCounts.booked}/{layout.totalSeats} Booked ({summaryCounts.available} Free)
          </span>
          {summaryCounts.held > 0 && (
            <Badge variant="warning" size="sm">
              {summaryCounts.held} Held
            </Badge>
          )}
          {summaryCounts.blocked > 0 && (
            <Badge variant="danger" size="sm">
              {summaryCounts.blocked} Blocked
            </Badge>
          )}
        </div>

        {/* Status Legend (Non-color reliant with icons & labels) */}
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
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-700 dark:text-amber-300">
              <Clock size={9} />
            </span>
            <span className="text-amber-800 dark:text-amber-300">Held</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-purple-500/20 border border-purple-400 flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold text-[9px]">
              ♀
            </span>
            <span className="text-purple-800 dark:text-purple-300">Ladies</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-sky-500/20 border border-sky-400 flex items-center justify-center text-sky-700 dark:text-sky-300 font-bold text-[9px]">
              <Link2 size={9} />
            </span>
            <span className="text-sky-800 dark:text-sky-300">Couple Pair</span>
          </div>
        </div>
      </div>

      {/* 2. Accessible Deck Tabs for Sleeper Coaches */}
      {isSleeper ? (
        <div className="space-y-3">
          <div className="flex justify-center">
            <Tabs
              items={deckTabItems}
              value={currentDeck}
              onChange={handleDeckTabSelect}
              ariaLabel="Bus Decks"
              className="w-auto"
            />
          </div>

          {/* 3. Internal Accessible Scroll Region */}
          <div
            role="region"
            aria-label={`${currentDeck === "lower" ? LABELS.lowerDeck : currentDeck === "upper" ? LABELS.upperDeck : LABELS.rearSeats} seat layout`}
            /* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1 SC 2.1.1: scrollable data region must be keyboard focusable */
            tabIndex={0}
            className="overflow-x-auto overflow-y-auto max-w-full pb-2 focus:outline-none focus:ring-1 focus:ring-brand rounded-[var(--yh-radius-lg)]"
          >
            <div className="min-w-[320px] flex justify-center py-1">
              {currentDeck === "lower" && renderDeckScreen("lower")}
              {currentDeck === "upper" && renderDeckScreen("upper")}
              {currentDeck === "rear" && renderRearScreen()}
            </div>
          </div>
        </div>
      ) : (
        /* Seater Coach Single Deck */
        <div
          role="region"
          aria-label="Bus seat layout"
          /* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1 SC 2.1.1: scrollable data region must be keyboard focusable */
          tabIndex={0}
          className="overflow-x-auto overflow-y-auto max-w-full pb-2 focus:outline-none focus:ring-1 focus:ring-brand rounded-[var(--yh-radius-lg)]"
        >
          <div className="min-w-[340px] flex justify-center py-1">
            {renderSeaterGrid()}
          </div>
        </div>
      )}
    </div>
  )
}
