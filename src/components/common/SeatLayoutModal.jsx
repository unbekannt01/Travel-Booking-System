import { useState, useMemo } from "react"
import {
  Printer,
  Download,
  Bus,
  Languages,
  Edit3,
  Check,
  RotateCcw,
  X,
} from "lucide-react"
import {
  mapCoachSeatManifest,
  buildSeatLayoutPrintHTML,
  groupSeatsIntoBerthColumns,
  formatShortPassengerName,
} from "../../utils/seatLayout"
import { getPassengerScriptDisplayName, transliterateToGujarati } from "../../../shared/gujaratiTransliteration.js"
import { downloadCsv } from "../../utils/csv"
import { formatDisplayDate } from "../../utils/date"
import { formatSeatLabel } from "../../utils/seatFormatting"
import { Modal, Button, Badge } from "../ui"
import { useToast } from "./ToastContext"
import { request } from "../../data/client"
import { cn } from "../../utils/cn"

export default function SeatLayoutModal({
  departure,
  bookings = [],
  user,
  onClose,
  isOpen = true,
}) {
  const { toast } = useToast()

  // Berth display format: 'combined' (both names separated by &) | 'slots' (separate slot 1 & 2 boxes)
  const [berthFormat, setBerthFormat] = useState("combined")
  // Name script: 'gu' (ગુજરાતી) | 'en' (English) | 'both' (English + ગુજરાતી)
  const [nameScript, setNameScript] = useState("gu")

  // Gujarati name editor dialog state
  const [showEditNamesModal, setShowEditNamesModal] = useState(false)
  const [editedNames, setEditedNames] = useState({})
  const [savingNames, setSavingNames] = useState(false)
  const [nameOverrides, setNameOverrides] = useState({})

  const companyName = user?.companyName || "Yatra Tours"
  const companyPhone = user?.companyPhone || ""
  const companyHQ = user?.companyHeadquarters || ""

  const tourName = departure?.tourName || "All Tours"
  const journeyDateFormatted = formatDisplayDate(departure?.journeyDate)
  const busNumber = departure?.busNumber || "AC Sleeper Coach"
  const busType = departure?.busType || "2x1 Luxury Sleeper"

  // Compute manifest mapping for the coach, applying any in-memory name overrides
  const manifestData = useMemo(() => {
    const raw = mapCoachSeatManifest({
      departure,
      bookings,
      layoutType: busType.startsWith("2x2") ? "2x2" : "2x1",
    })

    if (Object.keys(nameOverrides).length === 0) return raw

    // Apply manual Gujarati name corrections to the mapped seats
    const applyOverrides = (seatList) =>
      seatList.map((s) => {
        if (!s.passenger) return s
        const key = `${s.passenger.bookingId}-${s.passenger.passengerIndex}`
        const ov = nameOverrides[key]
        if (ov !== undefined) {
          return {
            ...s,
            passenger: {
              ...s.passenger,
              nameGu: ov,
            },
          }
        }
        return s
      })

    return {
      ...raw,
      lowerDeck: {
        ...raw.lowerDeck,
        seats: applyOverrides(raw.lowerDeck.seats),
      },
      upperDeck: {
        ...raw.upperDeck,
        seats: applyOverrides(raw.upperDeck.seats),
      },
    }
  }, [departure, bookings, busType, nameOverrides])

  // Group physical seats into 4 vertical berth columns (Left Lower, Left Upper, Right Lower, Right Upper)
  const berthColumns = useMemo(() => {
    return groupSeatsIntoBerthColumns(manifestData)
  }, [manifestData])

  // Extract all booked passengers for the Gujarati Name Editor
  const bookedPassengers = useMemo(() => {
    const list = []
    const seen = new Set()
    const checkSeat = (s) => {
      if (s.status === "booked" && s.passenger) {
        const p = s.passenger
        const key = `${p.bookingId}-${p.passengerIndex}`
        if (!seen.has(key)) {
          seen.add(key)
          list.push({
            key,
            seatId: s.id,
            bookingId: p.bookingId,
            passengerIndex: p.passengerIndex,
            invoiceNo: p.invoiceNo,
            contactName: p.contactName,
            name: p.name,
            nameGu: nameOverrides[key] ?? p.nameGu ?? transliterateToGujarati(p.name),
          })
        }
      }
    }
    manifestData.lowerDeck.seats.forEach(checkSeat)
    manifestData.upperDeck.seats.forEach(checkSeat)
    return list
  }, [manifestData, nameOverrides])

  // Open Gujarati Name Editor modal
  const handleOpenEditNames = () => {
    const initialMap = {}
    bookedPassengers.forEach((p) => {
      initialMap[p.key] = p.nameGu || transliterateToGujarati(p.name)
    })
    setEditedNames(initialMap)
    setShowEditNamesModal(true)
  }

  // Save Gujarati name corrections to backend
  const handleSaveEditedNames = async () => {
    setSavingNames(true)
    try {
      let savedCount = 0
      for (const p of bookedPassengers) {
        const newVal = (editedNames[p.key] || "").trim()
        if (newVal !== (p.nameGu || "")) {
          // Persist to backend
          await request(`/api/bookings/${p.bookingId}/passengers/${p.passengerIndex}`, {
            method: "PUT",
            body: JSON.stringify({ nameGu: newVal }),
          })
          savedCount++
        }
      }

      setNameOverrides((prev) => ({ ...prev, ...editedNames }))
      toast.success(savedCount > 0 ? `Updated ${savedCount} Gujarati names successfully!` : "No changes were made.")
      setShowEditNamesModal(false)
    } catch (err) {
      console.error("Save Gujarati names error:", err)
      toast.error(err.message || "Failed to save Gujarati name corrections")
    } finally {
      setSavingNames(false)
    }
  }

  const handlePrint = () => {
    const html = buildSeatLayoutPrintHTML({
      manifestData,
      departure,
      user,
      layoutMode: "unified",
      berthFormat,
      nameScript,
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
      "Passenger Name (English)",
      "Passenger Name (Gujarati)",
      "Display Name (Last + First)",
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
        isBooked ? p.nameGu || transliterateToGujarati(p.name) : "",
        isBooked ? getPassengerScriptDisplayName(p, nameScript) : "",
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
          <span className="italic">ખાલી</span>
        </span>
      )
    }

    // Last Name + First Name in selected script (middle omitted)
    const displayName = getPassengerScriptDisplayName(p, nameScript) || formatShortPassengerName(p.name)
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
        <span className="truncate">{displayName}</span>
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

  const modalFooter = (
    <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
      <div className="text-xs text-ink-muted">
        <strong>Conductor Instructions:</strong> Clean layout formatted with Last + First name. Print creates a high-res boarding chart.
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
    <>
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
            {/* Left Controls: Language Script & Name Editor */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Language Script Selector */}
              <div className="flex items-center bg-surface p-1 rounded-[var(--yh-radius-md)] border border-border-subtle">
                <Languages size={14} className="text-ink-muted ml-1 mr-1.5 shrink-0" />
                <button
                  type="button"
                  onClick={() => setNameScript("gu")}
                  className={cn(
                    "px-2.5 py-1 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer",
                    nameScript === "gu"
                      ? "bg-brand text-brand-fg shadow-2xs font-bold"
                      : "text-ink-muted hover:text-ink",
                  )}
                  title="Display names in Gujarati script (અટક + નામ)"
                >
                  ગુજરાતી
                </button>
                <button
                  type="button"
                  onClick={() => setNameScript("en")}
                  className={cn(
                    "px-2.5 py-1 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer",
                    nameScript === "en"
                      ? "bg-brand text-brand-fg shadow-2xs font-bold"
                      : "text-ink-muted hover:text-ink",
                  )}
                  title="Display names in English (Last Name + First Name)"
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setNameScript("both")}
                  className={cn(
                    "px-2.5 py-1 rounded-[var(--yh-radius-sm)] text-xs font-semibold transition-colors cursor-pointer",
                    nameScript === "both"
                      ? "bg-brand text-brand-fg shadow-2xs font-bold"
                      : "text-ink-muted hover:text-ink",
                  )}
                  title="Display English + Gujarati"
                >
                  Both
                </button>
              </div>

              {/* Berth Display Format (& vs Slots) */}
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

              {/* Edit Gujarati Names button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenEditNames}
                title="Review and manually correct transliterated Gujarati passenger names"
              >
                <Edit3 size={13} className="mr-1.5 text-brand" />
                <span>નામો સુધારો (Edit Gujarati)</span>
              </Button>
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

          {/* Content Body: Unified Coach View (Reference Layout) */}
          {renderUnifiedCoachView()}

          {companyHQ || companyPhone ? (
            <div className="text-[11px] text-ink-muted text-right">
              {companyName} {companyHQ ? `• ${companyHQ}` : ""} {companyPhone ? `• ${companyPhone}` : ""}
            </div>
          ) : null}
        </div>
      </Modal>

      {/* Manual Gujarati Names Correction Modal */}
      {showEditNamesModal && (
        <Modal
          isOpen={showEditNamesModal}
          onClose={() => setShowEditNamesModal(false)}
          size="lg"
          title={
            <div className="flex items-center gap-2">
              <Edit3 size={18} className="text-brand" />
              <span className="font-bold text-ink">ગુજરાતી નામો સુધારો / Edit Gujarati Names</span>
            </div>
          }
          footer={
            <div className="w-full flex items-center justify-between gap-3">
              <span className="text-xs text-ink-muted">
                {bookedPassengers.length} મુસાફરો (Passengers)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEditNamesModal(false)}
                  disabled={savingNames}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSaveEditedNames}
                  loading={savingNames}
                >
                  <Check size={14} className="mr-1.5" />
                  Save Corrections
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <p className="text-xs text-ink-muted">
              અંગ્રેજી નામો આપમેળે ગુજરાતીમાં ટ્રાન્સલેટ થયેલ છે. જો કોઈ નામમાં ભૂલ હોય તો અહી સુધારી લો:
            </p>

            <div className="border border-border-subtle rounded-[var(--yh-radius-md)] overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-muted border-b border-border-subtle">
                  <tr>
                    <th className="py-2 px-3 font-bold text-ink-muted w-16">Seat</th>
                    <th className="py-2 px-3 font-bold text-ink-muted">English Name</th>
                    <th className="py-2 px-3 font-bold text-ink-muted">ગુજરાતી નામ (Last + First)</th>
                    <th className="py-2 px-2 text-center w-12 font-bold text-ink-muted">Reset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {bookedPassengers.map((p) => {
                    const currentVal = editedNames[p.key] !== undefined ? editedNames[p.key] : p.nameGu || ""
                    return (
                      <tr key={p.key} className="hover:bg-surface-hover">
                        <td className="py-2 px-3 font-mono font-bold text-ink whitespace-nowrap">
                          {formatSeatLabel(p.seatId)}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-ink">{p.name}</span>
                          {p.invoiceNo ? (
                            <span className="block text-[10px] text-ink-muted">#{p.invoiceNo}</span>
                          ) : null}
                        </td>
                        <td className="py-1.5 px-3">
                          <input
                            type="text"
                            value={currentVal}
                            onChange={(e) =>
                              setEditedNames((prev) => ({
                                ...prev,
                                [p.key]: e.target.value,
                              }))
                            }
                            className="w-full text-xs font-semibold px-2.5 py-1 rounded border border-border-subtle focus:border-brand focus:ring-1 focus:ring-brand bg-surface text-ink outline-none"
                            placeholder="અટક નામ"
                          />
                        </td>
                        <td className="py-1.5 px-2 text-center">
                          <button
                            type="button"
                            onClick={() =>
                              setEditedNames((prev) => ({
                                ...prev,
                                [p.key]: transliterateToGujarati(p.name),
                              }))
                            }
                            className="p-1 rounded text-ink-muted hover:text-brand hover:bg-surface-muted transition-colors"
                            title="Auto-transliterate from English"
                          >
                            <RotateCcw size={12} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
