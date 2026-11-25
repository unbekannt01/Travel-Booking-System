import { useMemo } from "react"
import { Check, Lock, Clock, Pin, User, Layers, Info, Link2 } from "lucide-react"
import { getSeatLayout, DEFAULT_LAYOUT_KEY, resolveSeatId } from "../../../shared/seatLayouts.js"
import { cn } from "../../utils/cn"

/**
 * Reusable, Accessible Coach Seat Map Component (Part 6S-2b)
 *
 * Driven by data definitions from shared/seatLayouts.js.
 * Renders sleeper layouts (2x1-38, 2x2-48, 2x2-40) as ONE unified view without deck switcher:
 * - Rounded bus body container
 * - Amber front strip with "▲ Front" (left) and "Driver" (right)
 * - Four column headers: Left Lower, Left Upper, Central Aisle ("SLEEPER"), Right Lower, Right Upper
 * - Berth boxes with box titles (L1, U1...) and stacked seat buttons inside
 * - Rear section with wide boxes B1, B2 for 2x1-38
 * - Dedicated 2+3 layout for seater-2x3-60
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

  // Count booked, held, and available
  const counts = useMemo(() => {
    if (!layout?.seats) return { booked: 0, held: 0, blocked: 0, available: 0 }
    let booked = 0
    let held = 0
    let blocked = 0
    for (const seat of layout.seats) {
      const state = statesMap.get(seat.id)
      if (state?.status === "booked") booked++
      else if (state?.status === "held") held++
      else if (state?.status === "blocked") blocked++
    }
    return {
      booked,
      held,
      blocked,
      available: layout.totalSeats - booked - held - blocked,
    }
  }, [layout, statesMap])

  if (!layout) {
    return (
      <div className="p-4 rounded-[var(--yh-radius-md)] bg-surface-muted text-ink-muted text-xs text-center">
        No bus layout definition available.
      </div>
    )
  }

  const isSleeper = layout.category === "sleeper"

  // Localized headers dictionary
  const LABELS = {
    front: lang === "gu" ? "▲ આગળ" : lang === "hi" ? "▲ आगे" : "▲ Front",
    driver: lang === "gu" ? "ડ્રાઇવર" : lang === "hi" ? "ड्राइवर" : "Driver",
    leftLower: lang === "gu" ? "ડાબી નીચે" : lang === "hi" ? "बाईં निचली" : "Left Lower",
    leftUpper: lang === "gu" ? "ડાબી ઉપર" : lang === "hi" ? "बाईં ऊपरी" : "Left Upper",
    rightLower: lang === "gu" ? "જમણી નીચે" : lang === "hi" ? "दायीં निचली" : "Right Lower",
    rightUpper: lang === "gu" ? "જમણી ઉપર" : lang === "hi" ? "दायीં ऊपरी" : "Right Upper",
    rearSeats: lang === "gu" ? "પાછળની સીટ (Rear Seats)" : lang === "hi" ? "पिछली सीटें (Rear)" : "Rear Seats",
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
          "w-full min-h-[44px] min-w-[44px]",
          "focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1",
          // Available state
          isAvailable && [
            "bg-surface border-border-subtle text-ink hover:border-brand hover:bg-surface-hover shadow-2xs cursor-pointer",
            isLadies && "border-purple-300 bg-purple-50/40 dark:border-purple-800 dark:bg-purple-950/20",
            pairWith && "border-sky-300 bg-sky-50/40 dark:border-sky-800 dark:bg-sky-950/20",
          ],
          // Selected state
          isSelected && [
            "bg-brand text-brand-fg border-brand font-bold shadow-xs ring-1 ring-brand cursor-pointer",
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

  // Render unified sleeper grid matching owner reference pictures
  const renderUnifiedSleeperGrid = () => {
    const rowsCount = layout.grid.rows // 6 for 2x1 and 2x2-48; 5 for 2x2-40
    const rowsArray = Array.from({ length: rowsCount }, (_, i) => i + 1)

    // Group seats by row and column
    const seatMap = new Map()
    for (const seat of layout.seats) {
      if (seat.section === "main") {
        const key = `${seat.row}-${seat.side}-${seat.deck}-${seat.slot}`
        seatMap.set(key, seat)
      }
    }

    const rearSeats = layout.seats.filter((s) => s.section === "rear")

    return (
      <div className="flex flex-col items-center p-2 sm:p-4 rounded-[var(--yh-radius-xl)] border-2 border-border/80 bg-card shadow-sm w-full max-w-2xl mx-auto">
        {/* Rounded Coach Body Outer Shell */}
        <div className="w-full bg-surface p-2.5 sm:p-3.5 rounded-[var(--yh-radius-2xl)] border-2 border-border-subtle shadow-inner space-y-3">
          {/* 1. Yellow Front Strip with "▲ Front" and "Driver" */}
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-950 dark:text-amber-200 text-xs font-bold uppercase tracking-wide">
            <span className="flex items-center gap-1.5 font-black">{LABELS.front}</span>
            <div className="flex items-center gap-1.5 font-black">
              <span className="text-sm" aria-hidden="true">☸</span>
              <span>{LABELS.driver}</span>
            </div>
          </div>

          {/* 2. Four Column Headers */}
          <div className="grid grid-cols-[1fr_1fr_36px_1fr_1fr] sm:grid-cols-[1fr_1fr_44px_1fr_1fr] gap-1.5 text-center text-[10px] sm:text-xs font-bold text-ink-muted uppercase border-b border-border-subtle pb-1.5">
            <div className="truncate px-0.5" title={LABELS.leftLower}>
              {LABELS.leftLower}
            </div>
            <div className="truncate px-0.5" title={LABELS.leftUpper}>
              {LABELS.leftUpper}
            </div>
            <div className="text-[9px] font-black tracking-widest text-ink-muted/60 self-center">
              ||
            </div>
            <div className="truncate px-0.5" title={LABELS.rightLower}>
              {LABELS.rightLower}
            </div>
            <div className="truncate px-0.5" title={LABELS.rightUpper}>
              {LABELS.rightUpper}
            </div>
          </div>

          {/* 3. Main Rows (Berth Boxes with stacked seats) */}
          <div className="space-y-2">
            {rowsArray.map((rowNum) => {
              // Left Lower Box (L{rowNum})
              const leftLower1 = seatMap.get(`${rowNum}-left-lower-1`)
              const leftLower2 = seatMap.get(`${rowNum}-left-lower-2`)
              // Left Upper Box (U{rowNum})
              const leftUpper1 = seatMap.get(`${rowNum}-left-upper-1`)
              const leftUpper2 = seatMap.get(`${rowNum}-left-upper-2`)
              // Right Lower Box (L{rowNum})
              const rightLower1 = seatMap.get(`${rowNum}-right-lower-1`)
              const rightLower2 = seatMap.get(`${rowNum}-right-lower-2`)
              // Right Upper Box (U{rowNum})
              const rightUpper1 = seatMap.get(`${rowNum}-right-upper-1`)
              const rightUpper2 = seatMap.get(`${rowNum}-right-upper-2`)

              return (
                <div
                  key={`row-${rowNum}`}
                  className="grid grid-cols-[1fr_1fr_36px_1fr_1fr] sm:grid-cols-[1fr_1fr_44px_1fr_1fr] gap-1.5 items-stretch"
                >
                  {/* Col 1: Left Lower Berth Box */}
                  <div className="flex flex-col gap-1 p-1 rounded-lg border border-border-subtle/80 bg-surface-muted/30">
                    <span className="text-[9px] font-extrabold text-ink-muted/70 text-center uppercase tracking-wider">
                      L{rowNum}
                    </span>
                    {renderSeatButton(leftLower1)}
                    {leftLower2 && renderSeatButton(leftLower2)}
                  </div>

                  {/* Col 2: Left Upper Berth Box */}
                  <div className="flex flex-col gap-1 p-1 rounded-lg border border-border-subtle/80 bg-surface-muted/30">
                    <span className="text-[9px] font-extrabold text-ink-muted/70 text-center uppercase tracking-wider">
                      U{rowNum}
                    </span>
                    {renderSeatButton(leftUpper1)}
                    {leftUpper2 && renderSeatButton(leftUpper2)}
                  </div>

                  {/* Col 3: Central Aisle with Vertical "SLEEPER" */}
                  <div
                    aria-hidden="true"
                    className="flex flex-col items-center justify-center border-x-2 border-dashed border-border-subtle/60 text-[9px] font-black text-ink-muted/50 select-none py-1"
                  >
                    <span>S</span>
                    <span>L</span>
                    <span>E</span>
                    <span>E</span>
                    <span>P</span>
                    <span>E</span>
                    <span>R</span>
                  </div>

                  {/* Col 4: Right Lower Berth Box */}
                  <div className="flex flex-col gap-1 p-1 rounded-lg border border-border-subtle/80 bg-surface-muted/30">
                    <span className="text-[9px] font-extrabold text-ink-muted/70 text-center uppercase tracking-wider">
                      L{rowNum}
                    </span>
                    {renderSeatButton(rightLower1)}
                    {rightLower2 && renderSeatButton(rightLower2)}
                  </div>

                  {/* Col 5: Right Upper Berth Box */}
                  <div className="flex flex-col gap-1 p-1 rounded-lg border border-border-subtle/80 bg-surface-muted/30">
                    <span className="text-[9px] font-extrabold text-ink-muted/70 text-center uppercase tracking-wider">
                      U{rowNum}
                    </span>
                    {renderSeatButton(rightUpper1)}
                    {rightUpper2 && renderSeatButton(rightUpper2)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 4. Rear Section for 2x1-38 (Wide Boxes B1 and B2) */}
          {rearSeats.length > 0 && (
            <div className="mt-3 pt-2.5 border-t-2 border-dashed border-border-subtle">
              <div className="text-center text-[10px] font-extrabold text-ink-muted uppercase tracking-wider mb-1.5">
                {LABELS.rearSeats}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {rearSeats.map((rs) => (
                  <div
                    key={rs.id}
                    className="flex flex-col gap-1 p-1.5 rounded-lg border border-border-subtle bg-surface-muted/40"
                  >
                    <span className="text-[9px] font-extrabold text-ink-muted/80 text-center uppercase">
                      Box {rs.box}
                    </span>
                    {renderSeatButton(rs)}
                  </div>
                ))}
              </div>
            </div>
          )}
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
            Rear / Back of Coach • Emergency Exit
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3 w-full", className)}>
      {/* Header bar: Layout summary & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-brand shrink-0" />
          <span className="text-xs font-bold text-ink">{layout.label}</span>
          <span className="text-[11px] text-ink-muted">
            • {counts.booked}/{layout.totalSeats} Booked ({counts.available} Free)
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

      {/* Internal Accessible Scroll Container (Zero page horizontal scroll) */}
      <div
        role="region"
        aria-label="Bus seat layout"
        /* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1 SC 2.1.1: scrollable data region must be keyboard focusable */
        tabIndex={0}
        className="overflow-x-auto overflow-y-auto max-w-full pb-2 focus:outline-none focus:ring-1 focus:ring-brand rounded-[var(--yh-radius-lg)]"
      >
        {isSleeper ? (
          <div className="min-w-[480px] sm:min-w-[540px] flex justify-center py-1">
            {renderUnifiedSleeperGrid()}
          </div>
        ) : (
          <div className="min-w-[340px] flex justify-center py-1">
            {renderSeaterGrid()}
          </div>
        )}
      </div>
    </div>
  )
}
