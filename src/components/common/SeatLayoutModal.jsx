import { useState, useMemo } from "react"
import {
  Printer,
  Download,
  Bus,
  Layers,
} from "lucide-react"
import {
  mapCoachSeatManifest,
  buildSeatLayoutPrintHTML,
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
  const [deckFilter, setDeckFilter] = useState("both") // 'both' | 'lower' | 'upper'

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

  const handlePrint = (filter = deckFilter) => {
    const html = buildSeatLayoutPrintHTML({
      manifestData,
      departure,
      user,
      deckFilter: filter,
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

  // Render a visual deck preview card
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
                isLower ? "bg-emerald-500" : "bg-indigo-500",
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
            onClick={() => handlePrint(isLower ? "lower" : "upper")}
            title="Print just this deck"
            aria-label={`Print ${isLower ? "Lower" : "Upper"} Deck`}
          >
            <Printer size={13} className="mr-1" />
            <span>Print Deck</span>
          </Button>
        </div>

        {/* Coach Diagram Body */}
        <div className="p-3 sm:p-4 flex-1 bg-canvas/60">
          <div className="max-w-md mx-auto bg-surface rounded-[var(--yh-radius-lg)] border border-border-subtle p-3 shadow-xs">
            {/* Driver cabin indicator */}
            <div className="bg-surface-muted rounded-[var(--yh-radius-md)] py-1.5 px-3 mb-3 flex items-center justify-between text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              <span>☸ Driver Cabin (Front)</span>
              <span className="bg-surface border border-border-subtle px-1.5 py-0.5 rounded text-[10px]">
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
                                <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-label="Booked" />
                              ) : (
                                <span className="text-[9px] font-medium text-ink-muted">Free</span>
                              )}
                            </div>
                            {isBooked ? (
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold truncate leading-tight text-ink">
                                  {p.name}
                                </div>
                                <div className="text-[10px] font-medium text-brand truncate">
                                  #{p.invoiceNo}
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
                                <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" aria-label="Booked" />
                              ) : (
                                <span className="text-[9px] font-medium text-ink-muted">Free</span>
                              )}
                            </div>
                            {isBooked ? (
                              <div className="min-w-0">
                                <div className="text-[11px] font-semibold truncate leading-tight text-ink">
                                  {p.name}
                                </div>
                                <div className="text-[10px] font-medium text-brand truncate">
                                  #{p.invoiceNo}
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
        <strong>Conductor Instructions:</strong> Printed PDF generates separate dedicated pages for Upper and Lower decks with check-in checkboxes.
      </div>
      <div className="flex items-center gap-2 justify-end shrink-0">
        <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
          <Download size={14} className="mr-1.5" />
          Export CSV
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={() => handlePrint(deckFilter)}>
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
      className="max-w-5xl max-h-[92vh]"
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
      <div className="space-y-5">
        {/* Controls & Metrics Strip */}
        <div className="p-3 bg-surface-muted/60 rounded-[var(--yh-radius-lg)] border border-border-subtle flex flex-wrap items-center justify-between gap-3">
          {/* Deck Switcher */}
          <div role="tablist" aria-label="Deck view selector" className="flex items-center bg-surface p-1 rounded-[var(--yh-radius-md)] border border-border-subtle">
            <button
              type="button"
              role="tab"
              aria-selected={deckFilter === "both"}
              onClick={() => setDeckFilter("both")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer min-h-9",
                deckFilter === "both"
                  ? "bg-brand text-brand-fg shadow-xs"
                  : "text-ink-secondary hover:text-ink hover:bg-surface-hover",
              )}
            >
              <Layers size={13} />
              Both Decks
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={deckFilter === "lower"}
              onClick={() => setDeckFilter("lower")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer min-h-9",
                deckFilter === "lower"
                  ? "bg-brand text-brand-fg shadow-xs"
                  : "text-ink-secondary hover:text-ink hover:bg-surface-hover",
              )}
            >
              Lower Deck ({manifestData.lowerDeck.bookedCount}/{manifestData.lowerDeck.capacity})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={deckFilter === "upper"}
              onClick={() => setDeckFilter("upper")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer min-h-9",
                deckFilter === "upper"
                  ? "bg-brand text-brand-fg shadow-xs"
                  : "text-ink-secondary hover:text-ink hover:bg-surface-hover",
              )}
            >
              Upper Deck ({manifestData.upperDeck.bookedCount}/{manifestData.upperDeck.capacity})
            </button>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand shrink-0" />
              <span className="text-ink-muted">Booked:</span>
              <span className="font-semibold text-ink tabular-nums">{manifestData.totalBooked} Berths</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-border-strong shrink-0" />
              <span className="text-ink-muted">Available:</span>
              <span className="font-semibold text-ink tabular-nums">{manifestData.totalAvailable} Berths</span>
            </div>
            <Badge variant="brand" size="sm">
              {manifestData.occupancyPercentage}% Occupancy
            </Badge>
          </div>
        </div>

        {/* Content Body: Decks Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(deckFilter === "both" || deckFilter === "lower") &&
            renderDeckPreview(manifestData.lowerDeck)}
          {(deckFilter === "both" || deckFilter === "upper") &&
            renderDeckPreview(manifestData.upperDeck)}
        </div>

        {companyHQ || companyPhone ? (
          <div className="text-[11px] text-ink-muted text-right">
            {companyName} {companyHQ ? `• ${companyHQ}` : ""} {companyPhone ? `• ${companyPhone}` : ""}
          </div>
        ) : null}
      </div>
    </Modal>
  )
}
