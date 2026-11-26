import { useState, useMemo } from "react"
import {
  Printer,
  Download,
  Bus,
  Layers,
  LayoutGrid,
} from "lucide-react"
import {
  mapCoachSeatManifest,
  buildSeatLayoutPrintHTML,
  groupSeatsIntoBerthColumns,
  formatShortPassengerName,
} from "../../utils/seatLayout"
import { downloadCsv } from "../../utils/csv"
import { formatDisplayDate } from "../../utils/date"
import { formatSeatLabel } from "../../utils/seatFormatting"
import { Modal, Button, Badge } from "../ui"
import { cn } from "../../utils/cn"

export default function SeatLayoutModal({
  departure,
  bookings = [],
  user,
  onClose,
  isOpen = true,
}) {
  // Layout views: 'unified' (4-column yatriDesk reference) | 'decks' (classic lower/upper deck tabs)
  const [layoutMode, setLayoutMode] = useState("unified")
  // Berth display format: 'combined' (both names separated by &) | 'slots' (separate slot 1 & 2 boxes)
  const [berthFormat, setBerthFormat] = useState("combined")
  // Deck filter for classic deck view: 'both' | 'lower' | 'upper'
  const [deckFilter, setDeckFilter] = useState("both")

  const companyName = user?.companyName || "Yatra Tours"
  const companyPhone = user?.companyPhone || ""
  const companyHQ = user?.companyHeadquarters || ""

  const tourName = departure?.tourName || "All Tours"
  const journeyDateFormatted = formatDisplayDate(departure?.journeyDate)
  const busNumber = departure?.busNumber || "AC Sleeper Coach"
  const busType = departure?.busType || "2x1 Luxury Sleeper"

  // Compute manifest mapping for the coach
  const manifestData = useMemo(() => {
    return mapCoachSeatManifest({
      departure,
      bookings,
      layoutType: busType.startsWith("2x2") ? "2x2" : "2x1",
    })
  }, [departure, bookings, busType])

  // Group physical seats into 4 vertical berth columns (Left Lower, Left Upper, Right Lower, Right Upper)
  const berthColumns = useMemo(() => {
    return groupSeatsIntoBerthColumns(manifestData)
  }, [manifestData])

  const handlePrint = () => {
    const html = buildSeatLayoutPrintHTML({
      manifestData,
      departure,
      user,
      deckFilter: layoutMode === "decks" ? deckFilter : "both",
      layoutMode,
      berthFormat,
    })
    const win = window.open("", "_blank", "width=1000,height=800")
    if (!win) {
      alert("Please allow popups to print the passenger seat layout.")
      return
    }
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
    }, 400)
  }

  const handleExportCsv = () => {
    const header = [
      "Deck",
      "Seat Number",
      "Status",
      "Passenger Name",
      "Display Name (First + Middle)",
      "Age",
      "Gender",
      "Contact Phone",
      "City / Boarding",
      "Invoice No",
      "Payment Status",
      "Balance Due (Rs)",
      "Boarded Check",
    ]

    const allSeats = [
      ...manifestData.lowerDeck.seats.map((s) => ({ ...s, deckName: "Lower Deck" })),
      ...manifestData.upperDeck.seats.map((s) => ({ ...s, deckName: "Upper Deck" })),
    ]

    const rows = allSeats.map((seat) => {
      const isBooked = seat.status === "booked"
      const p = seat.passenger
      return [
        seat.deckName,
        formatSeatLabel(seat.id),
        isBooked ? "BOOKED" : "AVAILABLE",
        isBooked ? p.name : "Available",
        isBooked ? formatShortPassengerName(p.name) : "",
        isBooked && p.age ? p.age : "",
        isBooked && p.gender ? p.gender : "",
        isBooked ? p.contactPhone || p.contact || "" : "",
        isBooked ? p.city || "" : "",
        isBooked ? p.invoiceNo : "",
        isBooked ? (p.isPaid ? "PAID" : "DUE") : "",
        isBooked ? p.balanceDue : 0,
        isBooked && p.checkedIn ? "YES" : "NO",
      ]
    })

    const titleRow = [
      `TOUR: ${tourName} | DATE: ${journeyDateFormatted} | BUS: ${busNumber} | OPERATOR: ${companyName}`,
    ]
    const filename = `Seat-Layout-${tourName.replace(/\s+/g, "_")}-${departure?.journeyDate || "trip"}.csv`

    downloadCsv(filename, [titleRow, [], header, ...rows])
  }

  // Passenger gender badge helper
  const renderPassengerPill = (p, slotNum = null) => {
    if (!p) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10.5px] font-medium text-ink-muted bg-surface-muted border border-dashed border-border-subtle">
          {slotNum ? <span className="opacity-60 text-[9px] font-bold">{slotNum}:</span> : null}
          <span className="italic">Available</span>
        </span>
      )
    }

    const shortName = formatShortPassengerName(p.name)
    const g = String(p.gender || "").toLowerCase().trim()
    let colorClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
    if (g === "female" || g === "f" || g === "woman" || g.includes("સ્ત્રી")) {
      colorClass = "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-800"
    } else if (g !== "male" && g !== "m" && g !== "man" && !g.includes("પુરુષ") && g !== "") {
      colorClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
    }

    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold border max-w-full truncate transition-colors",
          colorClass
        )}
        title={`${p.name} (${p.gender || "Gender unspecified"})`}
      >
        {slotNum ? <span className="opacity-75 text-[9.5px] font-bold">{slotNum}:</span> : null}
        <span className="truncate">{shortName}</span>
      </span>
    )
  }

  // Render a single Berth Card for Unified Coach View
  const renderBerthCard = (berthItem) => {
    if (!berthItem) {
      return (
        <div className="rounded-[var(--yh-radius-lg)] border border-border-subtle/50 bg-surface-muted/30 p-2 min-h-[58px] flex flex-col items-center justify-center opacity-40">
          <span className="text-[10px] text-ink-muted font-bold">—</span>
        </div>
      )
    }

    const boxName = berthItem.box || (berthItem.deck === "lower" ? `L${berthItem.row}` : `U${berthItem.row}`)
    const seats = berthItem.seats || []

    // Single seat berth (e.g. 2x1 sleeper left side, or rear berths)
    if (seats.length === 1) {
      const s = seats[0]
      const p = s.status === "booked" ? s.passenger : null

      return (
        <div
          className={cn(
            "rounded-[var(--yh-radius-lg)] border p-2 min-h-[58px] flex flex-col justify-between transition-colors",
            p
              ? "bg-surface border-brand/40 shadow-xs"
              : "bg-surface border-border-subtle hover:border-border-strong",
          )}
        >
          <div className="text-center font-bold text-xs text-ink pb-1">
            {boxName}
          </div>
          <div className="flex items-center justify-center py-1">
            {p ? (
              renderPassengerPill(p)
            ) : (
              <span className="text-[10.5px] font-medium text-ink-muted italic select-none">
                ખાલી (Available)
              </span>
            )}
          </div>
        </div>
      )
    }

    // Double berth (2 seats: slot 1 and slot 2)
    const s1 = seats[0]
    const s2 = seats[1]
    const p1 = s1?.status === "booked" ? s1.passenger : null
    const p2 = s2?.status === "booked" ? s2.passenger : null
    const hasAnyBooked = Boolean(p1 || p2)

    return (
      <div
        className={cn(
          "rounded-[var(--yh-radius-lg)] border p-2 min-h-[58px] flex flex-col justify-between transition-colors",
          hasAnyBooked
            ? "bg-surface border-brand/35 shadow-xs"
            : "bg-surface border-border-subtle hover:border-border-strong",
        )}
      >
        <div className="text-center font-bold text-xs text-ink pb-0.5">
          {boxName}
        </div>

        {berthFormat === "slots" ? (
          /* Separate Slot 1 & Slot 2 horizontal boxes (yatriDesk PDF style) */
          <div className="flex flex-col gap-1 w-full py-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 text-[9px] font-bold text-ink-muted text-center shrink-0">1</span>
              <div className="flex-1 min-w-0">
                {p1 ? (
                  renderPassengerPill(p1)
                ) : (
                  <div className="text-[10px] text-ink-muted italic py-0.5 px-1.5 rounded bg-surface-muted border border-dashed border-border-subtle text-center">
                    ખાલી
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 text-[9px] font-bold text-ink-muted text-center shrink-0">2</span>
              <div className="flex-1 min-w-0">
                {p2 ? (
                  renderPassengerPill(p2)
                ) : (
                  <div className="text-[10px] text-ink-muted italic py-0.5 px-1.5 rounded bg-surface-muted border border-dashed border-border-subtle text-center">
                    ખાલી
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Combined "&" display format (User Explicit Request) */
          <div className="flex items-center justify-center py-1">
            {p1 && p2 ? (
              <div className="flex items-center justify-center flex-wrap gap-1 text-[11px] leading-snug">
                {renderPassengerPill(p1, 1)}
                <span className="text-brand font-bold text-xs mx-0.5 select-none">&</span>
                {renderPassengerPill(p2, 2)}
              </div>
            ) : p1 || p2 ? (
              <div className="flex items-center justify-center flex-wrap gap-1 text-[11px] leading-snug">
                {renderPassengerPill(p1 || p2, p1 ? 1 : 2)}
                <span className="text-ink-muted font-bold text-xs mx-0.5 select-none">&</span>
                {renderPassengerPill(null, p1 ? 2 : 1)}
              </div>
            ) : (
              <div className="text-[10.5px] font-medium text-ink-muted text-center py-1 italic select-none">
                ખાલી (Available)
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Render Unified Coach View (yatriDesk 4-Column Reference Layout)
  const renderUnifiedCoachView = () => {
    const rows = []
    for (let r = 1; r <= berthColumns.maxRows; r++) {
      const ll = berthColumns.leftLower.find((b) => b.row === r)
      const lu = berthColumns.leftUpper.find((b) => b.row === r)
      const rl = berthColumns.rightLower.find((b) => b.row === r)
      const ru = berthColumns.rightUpper.find((b) => b.row === r)

      rows.push(
        <div
          key={r}
          className="grid grid-cols-[1fr_1fr_40px_1fr_1fr] sm:grid-cols-[1fr_1fr_48px_1fr_1fr] gap-2 items-stretch"
        >
          <div className="min-w-0">{renderBerthCard(ll)}</div>
          <div className="min-w-0">{renderBerthCard(lu)}</div>
          <div className="border-x border-dashed border-border-subtle bg-canvas/30 flex items-center justify-center text-[10px] font-bold text-ink-muted">
            R{r}
          </div>
          <div className="min-w-0">{renderBerthCard(rl)}</div>
          <div className="min-w-0">{renderBerthCard(ru)}</div>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Main Coach Outer Container */}
        <div className="max-w-4xl mx-auto bg-surface rounded-[var(--yh-radius-xl)] border border-border-subtle shadow-xs overflow-hidden">
          {/* Coach Header: Tour Name & Date */}
          <div className="p-3.5 bg-surface-muted/80 border-b border-border-subtle text-center">
            <h3 className="text-lg font-black text-ink tracking-tight">
              {tourName}
            </h3>
            <p className="text-xs font-semibold text-ink-muted mt-0.5">
              {journeyDateFormatted} | કુલ પેસેન્જર:{" "}
              <span className="font-bold text-ink">
                {manifestData.totalBooked} / {manifestData.totalCapacity}
              </span>
            </p>
          </div>

          {/* Front / Driver Cabin Banner (Amber Bar matching Reference) */}
          <div className="bg-amber-500 text-amber-950 font-black px-4 py-2 flex items-center justify-between text-xs tracking-wider shadow-xs">
            <span className="flex items-center gap-1.5">
              <span>▲ આગળ</span>
              <span className="text-[10px] font-semibold opacity-75">(Front)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span>ડ્રાઇવર</span>
              <span className="text-[10px] font-semibold opacity-75">(Driver)</span>
            </span>
          </div>

          {/* 4 Berth Columns Header */}
          <div className="grid grid-cols-[1fr_1fr_40px_1fr_1fr] sm:grid-cols-[1fr_1fr_48px_1fr_1fr] gap-2 px-3 py-2 bg-brand-soft/40 border-b border-border-subtle text-center text-xs font-bold text-brand">
            <div className="flex flex-col">
              <span>( ડાબી નીચે )</span>
              <span className="text-[9.5px] font-medium text-ink-muted">Left Lower</span>
            </div>
            <div className="flex flex-col">
              <span>( ડાબી ઉપર )</span>
              <span className="text-[9.5px] font-medium text-ink-muted">Left Upper</span>
            </div>
            <div className="border-x border-dashed border-border-subtle flex items-center justify-center text-[10px] font-black text-ink-muted">
              aisle
            </div>
            <div className="flex flex-col">
              <span>( જમણી નીચે )</span>
              <span className="text-[9.5px] font-medium text-ink-muted">Right Lower</span>
            </div>
            <div className="flex flex-col">
              <span>( જમણી ઉપર )</span>
              <span className="text-[9.5px] font-medium text-ink-muted">Right Upper</span>
            </div>
          </div>

          {/* Coach Body Grid with Center Vertical SLEEPER Watermark */}
          <div className="relative p-3 sm:p-4 space-y-2.5 overflow-x-auto">
            {rows}

            {/* Rear Section for 2x1 sleeper */}
            {berthColumns.is2x1 &&
              (berthColumns.rearLower.length > 0 || berthColumns.rearUpper.length > 0) && (
                <div className="pt-3 border-t border-dashed border-border-subtle mt-3">
                  <div className="text-center text-[10px] font-bold text-ink-muted tracking-wider uppercase mb-2">
                    Rear of Coach
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      {renderBerthCard(
                        berthColumns.rearLower[0]
                          ? {
                              box: "Rear B1 (Lower)",
                              row: 7,
                              deck: "lower",
                              seats: [berthColumns.rearLower[0]],
                            }
                          : null
                      )}
                    </div>
                    <div>
                      {renderBerthCard(
                        berthColumns.rearUpper[0]
                          ? {
                              box: "Rear B2 (Upper)",
                              row: 7,
                              deck: "upper",
                              seats: [berthColumns.rearUpper[0]],
                            }
                          : null
                      )}
                    </div>
                  </div>
                </div>
              )}
          </div>

          {/* Legend Strip Matching Reference */}
          <div className="p-3 bg-surface-muted/60 border-t border-border-subtle flex items-center justify-center flex-wrap gap-4 text-xs font-semibold text-ink-secondary">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border border-border-strong bg-surface inline-block" />
              <span>ખાલી (Available)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border border-blue-300 bg-blue-100 text-blue-700 inline-block" />
              <span>પુરુષ (Male)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border border-pink-300 bg-pink-100 text-pink-700 inline-block" />
              <span>સ્ત્રી (Female)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded border border-amber-300 bg-amber-100 text-amber-700 inline-block" />
              <span>અન્ય (Other)</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Render a visual deck preview card (Classic Deck View)
  const renderDeckPreview = (deckObj) => {
    const isLower = deckObj.deck === "lower"
    const rows = {}
    deckObj.seats.forEach((s) => {
      if (!rows[s.row]) rows[s.row] = { left: [], right: [] }
      if (s.side === "left") rows[s.row].left.push(s)
      else rows[s.row].right.push(s)
    })

    const rowNumbers = Object.keys(rows)
      .map(Number)
      .sort((a, b) => a - b)

    return (
      <div className="rounded-[var(--yh-radius-xl)] border border-border-subtle bg-surface shadow-xs overflow-hidden flex flex-col">
        {/* Deck Header */}
        <div className="px-4 py-3 bg-surface-muted border-b border-border-subtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-2.5 h-2.5 rounded-full shrink-0",
                isLower ? "bg-[var(--yh-success)]" : "bg-[var(--yh-brand)]",
              )}
            />
            <h4 className="text-sm font-bold text-ink">
              {isLower ? "Lower Deck" : "Upper Deck"}
            </h4>
            <Badge variant="neutral" size="sm">
              {deckObj.bookedCount}/{deckObj.capacity} Booked
            </Badge>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrint}
            title="Print Coach Layout"
            aria-label={`Print ${isLower ? "Lower" : "Upper"} Deck`}
          >
            <Printer size={13} className="mr-1" />
            <span>Print</span>
          </Button>
        </div>

        {/* Coach Diagram Body */}
        <div className="p-3 sm:p-4 flex-1 bg-canvas/60">
          <div className="max-w-md mx-auto bg-surface rounded-[var(--yh-radius-lg)] border border-border-subtle p-3 shadow-xs">
            {/* Driver cabin indicator */}
            <div className="bg-amber-500 text-amber-950 font-bold rounded-[var(--yh-radius-md)] py-1.5 px-3 mb-3 flex items-center justify-between text-[11px] uppercase tracking-wider">
              <span>▲ આગળ / Driver Cabin (Front)</span>
              <span className="bg-surface/90 text-ink px-1.5 py-0.5 rounded text-[10px]">
                Entry
              </span>
            </div>

            {/* Grid */}
            <div className="space-y-2">
              {rowNumbers.map((rowNum) => {
                const rowData = rows[rowNum]
                return (
                  <div key={rowNum} className="grid grid-cols-12 gap-1.5 items-center">
                    {/* Left seats */}
                    <div className="col-span-5 flex gap-1.5">
                      {rowData.left.map((seat) => {
                        const isBooked = seat.status === "booked"
                        const p = seat.passenger
                        const shortName = isBooked ? formatShortPassengerName(p.name) : ""
                        return (
                          <div
                            key={seat.id}
                            className={cn(
                              "flex-1 min-h-12 rounded-[var(--yh-radius-md)] p-1.5 border flex flex-col justify-between transition-colors",
                              isBooked
                                ? "bg-brand-soft/70 border-brand/30 text-ink"
                                : "bg-surface border-dashed border-border-subtle text-ink-muted",
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold text-ink">
                                {formatSeatLabel(seat.id)}
                              </span>
                              {isBooked ? (
                                <span role="img" className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-label="Booked" />
                              ) : (
                                <span className="text-[9px] font-medium text-ink-muted">Free</span>
                              )}
                            </div>
                            {isBooked ? (
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold truncate leading-tight text-ink" title={p.name}>
                                  {shortName}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] font-medium text-ink-muted text-center py-0.5">
                                Available
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Central Aisle */}
                    <div className="col-span-2 text-center text-[10px] font-bold text-ink-muted uppercase tracking-wider py-1 border-x border-dashed border-border-subtle">
                      R{rowNum}
                    </div>

                    {/* Right seats */}
                    <div className="col-span-5 flex gap-1.5">
                      {rowData.right.map((seat) => {
                        const isBooked = seat.status === "booked"
                        const p = seat.passenger
                        const shortName = isBooked ? formatShortPassengerName(p.name) : ""
                        return (
                          <div
                            key={seat.id}
                            className={cn(
                              "flex-1 min-h-12 rounded-[var(--yh-radius-md)] p-1.5 border flex flex-col justify-between transition-colors",
                              isBooked
                                ? "bg-brand-soft/70 border-brand/30 text-ink"
                                : "bg-surface border-dashed border-border-subtle text-ink-muted",
                            )}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold text-ink">
                                {formatSeatLabel(seat.id)}
                              </span>
                              {isBooked ? (
                                <span role="img" className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-label="Booked" />
                              ) : (
                                <span className="text-[9px] font-medium text-ink-muted">Free</span>
                              )}
                            </div>
                            {isBooked ? (
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold truncate leading-tight text-ink" title={p.name}>
                                  {shortName}
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] font-medium text-ink-muted text-center py-0.5">
                                Available
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Rear */}
            <div className="bg-surface-muted rounded-[var(--yh-radius-md)] py-1 mt-3 text-center text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
              Rear of Bus / Emergency Exit
            </div>
          </div>
        </div>
      </div>
    )
  }

  const modalFooter = (
    <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div className="text-xs text-ink-muted">
        <strong>Conductor Instructions:</strong> Clean layout formatted with passenger First + Middle name. Print creates a high-res boarding chart.
      </div>
      <div className="flex items-center gap-2 justify-end shrink-0">
        <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
          <Download size={14} className="mr-1.5" />
          Export CSV
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={handlePrint}>
          <Printer size={14} className="mr-1.5" />
          Print / PDF
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      className="max-w-5xl max-h-[94vh]"
      title={
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-[var(--yh-radius-md)] bg-brand-soft text-brand shrink-0">
            <Bus size={20} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base sm:text-lg font-bold text-ink">
                Passenger Seat Layout & Boarding Chart
              </span>
              <Badge variant="brand" size="sm">
                {manifestData.layoutType} Sleeper
              </Badge>
            </div>
            <p className="text-xs text-ink-muted font-normal mt-0.5 truncate">
              {tourName} • 📅 {journeyDateFormatted} • 🚌 {busNumber}
            </p>
          </div>
        </div>
      }
      footer={modalFooter}
    >
      <div className="space-y-4">
        {/* Controls & Metrics Strip */}
        <div className="p-3 bg-surface-muted/60 rounded-[var(--yh-radius-lg)] border border-border-subtle flex flex-wrap items-center justify-between gap-3">
          {/* Layout Mode Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div role="tablist" aria-label="Layout view selector" className="flex items-center bg-surface p-1 rounded-[var(--yh-radius-md)] border border-border-subtle">
              <button
                type="button"
                role="tab"
                aria-selected={layoutMode === "unified"}
                onClick={() => setLayoutMode("unified")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer min-h-8",
                  layoutMode === "unified"
                    ? "bg-brand text-brand-fg shadow-xs"
                    : "text-ink-secondary hover:text-ink hover:bg-surface-hover",
                )}
                title="Unified 4-column coach view matching yatriDesk reference"
              >
                <LayoutGrid size={13} />
                Unified Coach (Reference)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={layoutMode === "decks"}
                onClick={() => setLayoutMode("decks")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer min-h-8",
                  layoutMode === "decks"
                    ? "bg-brand text-brand-fg shadow-xs"
                    : "text-ink-secondary hover:text-ink hover:bg-surface-hover",
                )}
                title="Classic deck-by-deck preview tabs"
              >
                <Layers size={13} />
                Deck Tabs
              </button>
            </div>

            {/* If in Unified mode: Format selector (& vs Slots) */}
            {layoutMode === "unified" ? (
              <div className="flex items-center bg-surface p-1 rounded-[var(--yh-radius-md)] border border-border-subtle">
                <button
                  type="button"
                  onClick={() => setBerthFormat("combined")}
                  className={cn(
                    "px-2.5 py-1 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer",
                    berthFormat === "combined"
                      ? "bg-surface-muted text-ink shadow-2xs font-bold"
                      : "text-ink-muted hover:text-ink",
                  )}
                  title="Display both passenger names together in same seat block separated by '&'"
                >
                  Combined (&)
                </button>
                <button
                  type="button"
                  onClick={() => setBerthFormat("slots")}
                  className={cn(
                    "px-2.5 py-1 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer",
                    berthFormat === "slots"
                      ? "bg-surface-muted text-ink shadow-2xs font-bold"
                      : "text-ink-muted hover:text-ink",
                  )}
                  title="Display separate slot 1 and slot 2 boxes"
                >
                  Slot Boxes (1 & 2)
                </button>
              </div>
            ) : (
              /* If in Decks mode: Deck switcher */
              <div role="tablist" aria-label="Deck switcher" className="flex items-center bg-surface p-1 rounded-[var(--yh-radius-md)] border border-border-subtle">
                <button
                  type="button"
                  role="tab"
                  aria-selected={deckFilter === "both"}
                  onClick={() => setDeckFilter("both")}
                  className={cn(
                    "px-2.5 py-1 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer",
                    deckFilter === "both"
                      ? "bg-surface-muted text-ink font-bold"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  Both
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={deckFilter === "lower"}
                  onClick={() => setDeckFilter("lower")}
                  className={cn(
                    "px-2.5 py-1 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer",
                    deckFilter === "lower"
                      ? "bg-surface-muted text-ink font-bold"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  Lower
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={deckFilter === "upper"}
                  onClick={() => setDeckFilter("upper")}
                  className={cn(
                    "px-2.5 py-1 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer",
                    deckFilter === "upper"
                      ? "bg-surface-muted text-ink font-bold"
                      : "text-ink-muted hover:text-ink",
                  )}
                >
                  Upper
                </button>
              </div>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand shrink-0" />
              <span className="text-ink-muted">Booked:</span>
              <span className="font-semibold text-ink tabular-nums">
                {manifestData.totalBooked} Berths
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-border-strong shrink-0" />
              <span className="text-ink-muted">Available:</span>
              <span className="font-semibold text-ink tabular-nums">
                {manifestData.totalAvailable} Berths
              </span>
            </div>
            <Badge variant="brand" size="sm">
              {manifestData.occupancyPercentage}% Occupancy
            </Badge>
          </div>
        </div>

        {/* Content Body: Unified Coach View or Decks Layout */}
        {layoutMode === "unified" ? (
          renderUnifiedCoachView()
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(deckFilter === "both" || deckFilter === "lower") &&
              renderDeckPreview(manifestData.lowerDeck)}
            {(deckFilter === "both" || deckFilter === "upper") &&
              renderDeckPreview(manifestData.upperDeck)}
          </div>
        )}

        {companyHQ || companyPhone ? (
          <div className="text-[11px] text-ink-muted text-right">
            {companyName} {companyHQ ? `• ${companyHQ}` : ""} {companyPhone ? `• ${companyPhone}` : ""}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
