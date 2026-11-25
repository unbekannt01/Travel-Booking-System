import { useState, useMemo, lazy, Suspense } from "react"
import {
  Phone,
  Fingerprint,
  FileDown,
  Eye,
  EyeOff,
  Printer,
  Edit3,
  Ticket,
  Users,
  CheckCircle2,
  Share2,
} from "lucide-react"
import { maskAadhaar, formatSeatLabel } from "../utils/formatters"
import { isMaskedAadhaar } from "../utils/validators"
import { formatDisplayDate, toDateInputValue } from "../utils/date"
import { downloadCsv } from "../utils/csv"
import { request } from "../data/client"
import { useConfirm } from "./common/useConfirm"
import { useToast } from "./common/useToast"
import BoardingPassModal from "./common/BoardingPassModal"
import ShareSeatModal from "./seats/ShareSeatModal"

const ManifestPrintModal = lazy(() => import("./common/ManifestPrintModal"))
import {
  Card,
  Button,
  IconButton,
  Select,
  SearchInput,
  Badge,
  StatusPill,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Modal,
  EmptyState,
  FOCUS_RING_CLASS,
} from "./ui"
import { cn } from "../utils/cn"

const STATUS_CHIPS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "pending", label: "Pending" },
  { id: "cancelled", label: "Cancelled" },
]

const BOARDING_CHIPS = [
  { id: "all", label: "All Boarding" },
  { id: "boarded", label: "Boarded" },
  { id: "not_boarded", label: "Not Boarded" },
]

export default function PassengerManagement({
  bookings = [],
  onEditBooking,
  user,
}) {
  const confirm = useConfirm()
  const toast = useToast()
  const [selectedTour, setSelectedTour] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [boardingFilter, setBoardingFilter] = useState("all")
  const [showPreview, setShowPreview] = useState(false)
  const [includeAadhar, setIncludeAadhar] = useState(true)
  const [unmaskedAadhaar, setUnmaskedAadhaar] = useState({})
  const [boardingPassTarget, setBoardingPassTarget] = useState(null)
  const [shareSeatTarget, setShareSeatTarget] = useState(null)

  const shareDepartureInfo = useMemo(() => {
    if (!shareSeatTarget) return null
    return {
      tourName: shareSeatTarget.booking?.tourName,
      journeyDate: shareSeatTarget.booking?.journeyDate,
      busType: shareSeatTarget.booking?.busType,
      layoutKey: shareSeatTarget.booking?.seatLayoutKey,
      companyName: user?.companyName,
      companyPhone: user?.phone,
    }
  }, [shareSeatTarget, user?.companyName, user?.phone])

  const shareOperatorInfo = useMemo(() => {
    return {
      companyName: user?.companyName,
      phone: user?.phone,
    }
  }, [user?.companyName, user?.phone])

  const uniqueTours = useMemo(() => {
    return [...new Set(bookings.map((b) => b.tourName))].filter(Boolean)
  }, [bookings])

  const departures = useMemo(() => {
    const active = bookings.filter((b) => b.status !== "Cancelled" && b.status !== "cancelled")
    const map = new Map()
    for (const b of active) {
      if (!b.tourName || !b.journeyDate) continue
      const dateKey = toDateInputValue(b.journeyDate)
      const bus = b.busType || "2x1 Sleeper Luxury"
      const key = `${b.tourName}___${dateKey}___${bus}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          tourName: b.tourName,
          journeyDate: b.journeyDate,
          dateStr: dateKey,
          busType: bus,
          totalPax: 0,
        })
      }
      map.get(key).totalPax += (b.passengers || []).length
    }
    return Array.from(map.values())
  }, [bookings])

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (selectedTour !== "all" && b.tourName !== selectedTour) return false

      const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
      const balance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
      const isPaid = !isCancelled && (b.isPaid || balance === 0)
      const isPending = !isCancelled && !isPaid

      if (statusFilter === "paid" && !isPaid) return false
      if (statusFilter === "pending" && !isPending) return false
      if (statusFilter === "cancelled" && !isCancelled) return false

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const matchesContact =
          b.contactName?.toLowerCase().includes(q) ||
          b.contactPhone?.toLowerCase().includes(q)
        const matchesInvoice = b.invoiceNo?.toLowerCase().includes(q)
        const matchesTour = b.tourName?.toLowerCase().includes(q)
        const matchesPax = b.passengers?.some(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.city?.toLowerCase().includes(q) ||
            p.seatId?.toLowerCase().includes(q) ||
            p.contact?.toLowerCase().includes(q),
        )
        if (!matchesContact && !matchesInvoice && !matchesTour && !matchesPax) {
          return false
        }
      }

      return true
    })
  }, [bookings, selectedTour, statusFilter, searchTerm])

  // Flattened passengers matching boarding filter
  const passengerEntries = useMemo(() => {
    const list = []
    filteredBookings.forEach((b) => {
      ;(b.passengers || []).forEach((p, idx) => {
        if (boardingFilter === "boarded" && !p.checkedIn) return
        if (boardingFilter === "not_boarded" && p.checkedIn) return
        list.push({ booking: b, passenger: p, paxIndex: idx })
      })
    })
    return list
  }, [filteredBookings, boardingFilter])

  const handleRevealAadhaar = async (booking, pax, idx) => {
    const key = `${booking._id || booking.id}-${pax._id || idx}`
    if (unmaskedAadhaar[key]) {
      setUnmaskedAadhaar((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      return
    }

    const confirmed = await confirm({
      title: "Reveal Aadhaar Number",
      message: `Authorized action: Reveal full Aadhaar number for ${pax.name}?\n\nThis action is logged in the operational audit trail.`,
      confirmText: "Reveal Aadhaar",
      confirmVariant: "accent",
    })
    if (!confirmed) return

    try {
      const res = await request(
        `/api/bookings/${booking._id || booking.id}/passengers/${pax._id || idx}/reveal-aadhaar`,
      )
      if (res && res.aadhar) {
        setUnmaskedAadhaar((prev) => ({
          ...prev,
          [key]: res.aadhar,
        }))
        toast.info("Aadhaar revealed. Auto-hiding in 15 seconds.")
        // Auto-hide after 15 seconds to minimize exposure
        setTimeout(() => {
          setUnmaskedAadhaar((prev) => {
            const next = { ...prev }
            delete next[key]
            return next
          })
        }, 15000)
      }
    } catch {
      toast.error("Could not reveal Aadhaar")
      // Fallback: if already unmasked locally
      if (pax.aadhar && !isMaskedAadhaar(pax.aadhar)) {
        setUnmaskedAadhaar((prev) => ({ ...prev, [key]: pax.aadhar }))
      }
    }
  }

  const handleExportCSV = (withAadhaar) => {
    const headers = [
      "#",
      "Tour",
      "Journey Date",
      "Invoice #",
      "Passenger Name",
      "Age",
      "Gender",
      "City",
      "Contact",
      "Seat",
      ...(withAadhaar ? ["Aadhaar"] : []),
      "Boarding Status",
      "Payment Status",
    ]

    const rows = [headers]
    let counter = 1

    passengerEntries.forEach(({ booking: b, passenger: p }) => {
      const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
      const balance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
      const isPaid = !isCancelled && (b.isPaid || balance === 0)
      const paymentStatus = isCancelled ? "Cancelled" : isPaid ? "Paid" : "Pending"

      rows.push([
        counter++,
        b.tourName || "—",
        formatDisplayDate(b.journeyDate),
        `#${b.invoiceNo}`,
        p.name || "—",
        p.age || "—",
        p.gender ? p.gender.toUpperCase() : "—",
        p.city || "—",
        p.contact || "—",
        formatSeatLabel(p.seatId),
        ...(withAadhaar ? [p.aadhar ? maskAadhaar(p.aadhar) : "—"] : []),
        p.checkedIn ? "Boarded" : "Not Boarded",
        paymentStatus,
      ])
    })

    const slug = selectedTour === "all" ? "all-tours" : selectedTour.toLowerCase().replace(/\s+/g, "-")
    const filename = `yatrahub-travelers-${slug}-${new Date().toISOString().slice(0, 10)}.csv`
    downloadCsv(filename, rows)
  }

  const handleOpenPrintPreview = (withAadhar) => {
    setIncludeAadhar(withAadhar)
    setShowPreview(true)
  }

  return (
    <div className="space-y-6">
      {/* Top Action Toolbar: Filters, CSV & Print Manifest Actions */}
      <Card elevation="sm" padding="md" className="space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search bar */}
          <div className="flex-1 max-w-md">
            <SearchInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClear={() => setSearchTerm("")}
              placeholder="Search traveler, phone, city, tour, seat..."
              size="sm"
              aria-label="Search travelers"
            />
          </div>

          {/* Tour filter & Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-52 shrink-0">
              <Select
                size="sm"
                value={selectedTour}
                onChange={(e) => setSelectedTour(e.target.value)}
                aria-label="Filter by destination"
              >
                <option value="all">All Destinations</option>
                {uniqueTours.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </div>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileDown size={15} />}
              disabled={passengerEntries.length === 0}
              onClick={() => handleExportCSV(false)}
              title="Download CSV without Aadhaar numbers"
            >
              Export CSV
            </Button>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FileDown size={15} />}
              disabled={passengerEntries.length === 0}
              onClick={() => handleExportCSV(true)}
              title="Download CSV including masked Aadhaar numbers"
            >
              CSV with Aadhaar
            </Button>

            <Button
              variant="primary"
              size="sm"
              leftIcon={<Printer size={15} />}
              disabled={passengerEntries.length === 0}
              onClick={() => handleOpenPrintPreview(includeAadhar)}
            >
              Print Manifest
            </Button>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-subtle">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by payment status">
            <span className="text-xs font-semibold text-ink-muted mr-1">Payment:</span>
            {STATUS_CHIPS.map((chip) => {
              const isActive = statusFilter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setStatusFilter(chip.id)}
                  className={cn(
                    "rounded-[var(--yh-radius-full)] px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer",
                    isActive
                      ? "bg-brand text-brand-fg shadow-xs"
                      : "bg-surface-muted text-ink-muted hover:bg-surface-hover hover:text-ink",
                    FOCUS_RING_CLASS,
                  )}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by boarding status">
            <span className="text-xs font-semibold text-ink-muted mr-1">Boarding:</span>
            {BOARDING_CHIPS.map((chip) => {
              const isActive = boardingFilter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setBoardingFilter(chip.id)}
                  className={cn(
                    "rounded-[var(--yh-radius-full)] px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer",
                    isActive
                      ? "bg-brand-primary text-white shadow-xs"
                      : "bg-surface-muted text-ink-muted hover:bg-surface-hover hover:text-ink",
                    FOCUS_RING_CLASS,
                  )}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Filter Active Notice */}
      {selectedTour !== "all" && (
        <div className="flex items-center justify-between p-3 rounded-[var(--yh-radius-md)] bg-brand-soft border border-border-subtle text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="sm">
              Destination
            </Badge>
            <span className="font-semibold text-ink">Showing travelers for {selectedTour}</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedTour("all")}
            className="font-semibold text-brand hover:underline cursor-pointer"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Main Passenger Table / Card List */}
      {passengerEntries.length === 0 ? (
        <EmptyState
          icon={<Users size={28} />}
          title="No travelers found"
          description={
            searchTerm || statusFilter !== "all" || boardingFilter !== "all" || selectedTour !== "all"
              ? "Try adjusting your search query or filters to find what you are looking for."
              : "No passenger reservations have been created yet."
          }
          action={
            searchTerm || statusFilter !== "all" || boardingFilter !== "all" || selectedTour !== "all" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setSearchTerm("")
                  setSelectedTour("all")
                  setStatusFilter("all")
                  setBoardingFilter("all")
                }}
              >
                Reset all filters
              </Button>
            ) : null
          }
        />
      ) : (
        <>
          {/* Desktop Table View (md+) */}
          <div className="hidden md:block">
            <Table ariaLabel="Travelers roster table">
              <TableHeader>
                <TableRow>
                  <TableHead>Tour &amp; Date</TableHead>
                  <TableHead>Traveler Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Seat</TableHead>
                  <TableHead>Aadhaar</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead align="center">Age/Sex</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead align="right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passengerEntries.map(({ booking: b, passenger: p, paxIndex: idx }) => {
                  const passengerKey = `${b._id || b.id}-${p._id || idx}`
                  const isAadhaarVisible = Boolean(unmaskedAadhaar[passengerKey])
                  const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
                  const balance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
                  const isPaid = !isCancelled && (b.isPaid || balance === 0)

                  return (
                    <TableRow key={passengerKey}>
                      <TableCell>
                        <Badge variant="primary" size="sm" className="mb-0.5 block w-fit">
                          {b.tourName}
                        </Badge>
                        <span className="text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">
                          <span>{formatDisplayDate(b.journeyDate)} • #{b.invoiceNo}</span>
                          {b.groupId && (
                            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-brand-soft text-brand border border-brand/20">
                              👥 Group
                            </span>
                          )}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span className="font-bold text-ink block">{p.name}</span>
                        {p.checkedIn ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-status-success-text">
                            <CheckCircle2 size={12} /> Boarded
                          </span>
                        ) : null}
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
                          <Phone size={13} className="text-ink-muted shrink-0" />
                          <span>{p.contact || b.contactPhone || "—"}</span>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="font-bold text-brand tabular-nums">
                          {formatSeatLabel(p.seatId)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Fingerprint size={14} className="text-ink-muted shrink-0" />
                          <span className="font-mono text-xs tabular-nums text-ink">
                            {p.aadhar
                              ? isAadhaarVisible
                                ? unmaskedAadhaar[passengerKey] || p.aadhar
                                : maskAadhaar(p.aadhar)
                              : "—"}
                          </span>
                          {p.aadhar ? (
                            <IconButton
                              aria-label={isAadhaarVisible ? "Hide Aadhaar" : "Reveal Aadhaar"}
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 text-ink-muted hover:text-brand"
                              onClick={() => handleRevealAadhaar(b, p, idx)}
                              title={isAadhaarVisible ? "Hide Aadhaar" : "Reveal Aadhaar"}
                            >
                              {isAadhaarVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                            </IconButton>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell>
                        <span className="text-xs text-ink-secondary">{p.city || "—"}</span>
                      </TableCell>

                      <TableCell align="center">
                        <span className="text-xs font-semibold text-ink tabular-nums">
                          {p.age ? `${p.age}Y` : "—"} / {p.gender ? p.gender.charAt(0).toUpperCase() : "—"}
                        </span>
                      </TableCell>

                      <TableCell>
                        <StatusPill
                          status={isCancelled ? "Cancelled" : isPaid ? "Paid" : "Pending"}
                          size="sm"
                        />
                      </TableCell>

                      <TableCell align="right">
                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            aria-label={`Share seat confirmation for ${p.name}`}
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setShareSeatTarget({
                                booking: b,
                                initialSeatId: p.seatId,
                              })
                            }
                            title="Share Seat via WhatsApp"
                          >
                            <Share2 size={16} />
                          </IconButton>
                          <IconButton
                            aria-label={`View boarding pass for ${p.name}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => setBoardingPassTarget({ booking: b, paxIndex: idx })}
                            title="Boarding Pass & QR"
                          >
                            <Ticket size={16} />
                          </IconButton>
                          <IconButton
                            aria-label={`Edit booking #${b.invoiceNo}`}
                            variant="ghost"
                            size="sm"
                            onClick={() => onEditBooking(b)}
                            title="Edit booking"
                          >
                            <Edit3 size={16} />
                          </IconButton>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Stacked Card View (<md) */}
          <div className="space-y-3 md:hidden">
            {passengerEntries.map(({ booking: b, passenger: p, paxIndex: idx }) => {
              const passengerKey = `${b._id || b.id}-${p._id || idx}`
              const isAadhaarVisible = Boolean(unmaskedAadhaar[passengerKey])
              const isCancelled = b.status === "Cancelled" || b.status === "cancelled"
              const balance = Math.max(0, (b.totalAmount || 0) - (b.advanceReceived || 0))
              const isPaid = !isCancelled && (b.isPaid || balance === 0)

              return (
                <div
                  key={passengerKey}
                  className="rounded-[var(--yh-radius-lg)] border border-border-subtle bg-surface p-4 space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-bold text-ink text-base block truncate">{p.name}</span>
                      <span className="text-xs text-ink-muted flex items-center gap-1.5 flex-wrap">
                        <span>Seat: <strong className="text-brand tabular-nums">{formatSeatLabel(p.seatId)}</strong></span>
                        {b.groupId && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold bg-brand-soft text-brand border border-brand/20">
                            👥 Group
                          </span>
                        )}
                      </span>
                    </div>
                    <StatusPill
                      status={isCancelled ? "Cancelled" : isPaid ? "Paid" : "Pending"}
                      size="sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div>
                      <span className="text-ink-muted block text-[11px]">Tour</span>
                      <span className="font-semibold text-ink truncate block">{b.tourName}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-[11px]">Journey Date</span>
                      <span className="font-semibold text-ink">{formatDisplayDate(b.journeyDate)}</span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-[11px]">Contact</span>
                      <span className="font-semibold text-ink truncate block">
                        {p.contact || b.contactPhone || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-ink-muted block text-[11px]">Age / Sex / City</span>
                      <span className="font-semibold text-ink">
                        {p.age}Y • {p.gender ? p.gender.charAt(0).toUpperCase() : "—"} • {p.city || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Aadhaar row with Reveal button */}
                  <div className="flex items-center justify-between p-2 rounded-[var(--yh-radius-sm)] bg-surface-muted/60 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Fingerprint size={14} className="text-ink-muted shrink-0" />
                      <span className="font-mono text-xs tabular-nums text-ink truncate">
                        {p.aadhar
                          ? isAadhaarVisible
                            ? unmaskedAadhaar[passengerKey] || p.aadhar
                            : maskAadhaar(p.aadhar)
                          : "Aadhaar: Not on file"}
                      </span>
                    </div>
                    {p.aadhar ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs font-semibold text-brand"
                        onClick={() => handleRevealAadhaar(b, p, idx)}
                      >
                        {isAadhaarVisible ? "Hide" : "Reveal"}
                      </Button>
                    ) : null}
                  </div>

                  {/* Touch Action Bar */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="min-h-11 flex-1 text-emerald-700 dark:text-emerald-400"
                      leftIcon={<Share2 size={16} />}
                      onClick={() =>
                        setShareSeatTarget({
                          booking: b,
                          initialSeatId: p.seatId,
                        })
                      }
                    >
                      Share Seat
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="min-h-11 flex-1"
                      leftIcon={<Ticket size={16} />}
                      onClick={() => setBoardingPassTarget({ booking: b, paxIndex: idx })}
                    >
                      Boarding Pass
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="min-h-11 flex-1"
                      leftIcon={<Edit3 size={16} />}
                      onClick={() => onEditBooking(b)}
                    >
                      Edit Booking
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* Passenger Manifest Print Builder Modal (Part 6d) */}
      {showPreview && (
        <Suspense fallback={null}>
          <ManifestPrintModal
            isOpen={showPreview}
            onClose={() => setShowPreview(false)}
            departures={departures}
            user={user}
            initialPreset={includeAadhar ? "with-aadhaar" : "without-aadhaar"}
          />
        </Suspense>
      )}

      {/* Boarding Pass Modal */}
      {boardingPassTarget && (
        <BoardingPassModal
          booking={boardingPassTarget.booking}
          user={user}
          initialPassengerIndex={boardingPassTarget.paxIndex}
          onClose={() => setBoardingPassTarget(null)}
        />
      )}

      {/* WhatsApp Seat Share Modal (Part 6S-3a) */}
      {shareSeatTarget && (
        <ShareSeatModal
          isOpen={Boolean(shareSeatTarget)}
          onClose={() => setShareSeatTarget(null)}
          booking={shareSeatTarget.booking}
          initialSeatId={shareSeatTarget.initialSeatId}
          departureInfo={shareDepartureInfo || undefined}
          operatorInfo={shareOperatorInfo}
        />
      )}
    </div>
  )
}
