import { useState, useEffect, useMemo } from "react"
import {
  Users,
  Bus,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  ChevronRight,
  ChevronLeft,
  Wand2,
  Lock,
} from "lucide-react"
import { Modal, Button, Input, Select, Field, Badge, Card } from "../ui"
import SeatMap from "../seats/SeatMap"
import { useToast } from "../common/ToastContext"
import { formatINR } from "../../utils/formatters"
import { toDateInputValue } from "../../utils/date"
import {
  layoutKeyForBusType,
  STANDARD_BUS_TYPES,
  resolveSeatId,
} from "../../../shared/seatLayouts.js"
import { validateIndianPhone } from "../../../shared/businessLogic.js"

export default function GroupBookingModal({
  isOpen,
  onClose,
  initialDeparture = null, // { tourName, journeyDate, busType, key }
  tours = [],
  bookings = [],
  onGroupCreated,
}) {
  const { toast } = useToast()
  const [step, setStep] = useState(1) // 1: Group Info, 2: Members

  // Step 1: Group metadata
  const [groupName, setGroupName] = useState("")
  const [leaderName, setLeaderName] = useState("")
  const [leaderPhone, setLeaderPhone] = useState("")
  const [tourName, setTourName] = useState("")
  const [journeyDate, setJourneyDate] = useState("")
  const [busType, setBusType] = useState("2x1 Sleeper Luxury (38 berths)")
  const [note, setNote] = useState("")
  const [defaultPickupPoint, setDefaultPickupPoint] = useState("")
  const [defaultPickupTime, setDefaultPickupTime] = useState("")
  const [defaultDropPoint, setDefaultDropPoint] = useState("")

  // Step 2: Member booking rows
  const [members, setMembers] = useState([
    {
      id: "mem-1",
      contactName: "",
      contactPhone: "",
      fare: "",
      pickupPoint: "",
      pickupTime: "",
      dropPoint: "",
      overrideLadies: false,
      overrideReason: "",
      passengers: [
        { id: "p-1-1", name: "", age: "30", gender: "Male", city: "", seatId: "" },
      ],
    },
  ])

  const [activeSeatMemberIdx, setActiveSeatMemberIdx] = useState(0)
  const [activeSeatPaxIdx, setActiveSeatPaxIdx] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [serverError, setServerError] = useState("")
  const [departureSeatConfig, setDepartureSeatConfig] = useState(null)

  // Initialize from initialDeparture if provided
  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setServerError("")
      setIsSubmitting(false)
      if (initialDeparture) {
        setTourName(initialDeparture.tourName || "")
        setJourneyDate(toDateInputValue(initialDeparture.journeyDate))
        setBusType(initialDeparture.busType || "2x1 Sleeper Luxury (38 berths)")
        setGroupName(`${initialDeparture.tourName} Group`)
      } else {
        setTourName(tours[0]?.name || "")
        setJourneyDate(toDateInputValue(new Date()))
        setBusType("2x1 Sleeper Luxury (38 berths)")
        setGroupName("")
      }
      setLeaderName("")
      setLeaderPhone("")
      setNote("")
      setDefaultPickupPoint("")
      setDefaultPickupTime("")
      setDefaultDropPoint("")
      setMembers([
        {
          id: "mem-1",
          contactName: "",
          contactPhone: "",
          fare: "",
          pickupPoint: "",
          pickupTime: "",
          dropPoint: "",
          overrideLadies: false,
          overrideReason: "",
          passengers: [
            { id: "p-1-1", name: "", age: "30", gender: "Male", city: "", seatId: "" },
          ],
        },
      ])
    }
  }, [isOpen, initialDeparture, tours])

  // Fetch departure seat config (ladies seats, couple pairs, fare presets)
  useEffect(() => {
    if (!tourName || !journeyDate || !busType) {
      setDepartureSeatConfig(null)
      return
    }
    const key = `${tourName}___${journeyDate}___${busType}`
    fetch(`/api/departures/${encodeURIComponent(key)}/seat-config`, {
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setDepartureSeatConfig(data))
      .catch(() => setDepartureSeatConfig(null))
  }, [tourName, journeyDate, busType])

  const layoutKey = useMemo(() => layoutKeyForBusType(busType), [busType])

  // Compute occupied seats on departure from existing bookings
  const occupiedDepartureSeats = useMemo(() => {
    if (!tourName || !journeyDate) return new Set()
    const targetDate = toDateInputValue(journeyDate)
    const taken = new Set()
    bookings
      .filter((b) => {
        const sameTour = b.tourName === tourName
        const bDate = toDateInputValue(b.journeyDate || b.date)
        return sameTour && bDate === targetDate && !b.deletedAt && b.status !== "Cancelled"
      })
      .forEach((b) => {
        ;(b.passengers || []).forEach((p) => {
          if (p.seatId) taken.add(resolveSeatId(layoutKey, p.seatId))
        })
      })
    return taken
  }, [tourName, journeyDate, bookings, layoutKey])

  // Compute seats selected by group members
  const memberAssignedSeats = useMemo(() => {
    const map = new Map() // seatId -> { memberIdx, paxIdx, memberName }
    members.forEach((m, mIdx) => {
      ;(m.passengers || []).forEach((p, pIdx) => {
        if (p.seatId) {
          map.set(resolveSeatId(layoutKey, p.seatId), {
            memberIdx: mIdx,
            paxIdx: pIdx,
            memberName: m.contactName || `Member ${mIdx + 1}`,
          })
        }
      })
    })
    return map
  }, [members, layoutKey])

  // Seat states and active passenger seat for shared SeatMap
  const groupSeatStates = useMemo(() => {
    const states = {}
    for (const seatId of occupiedDepartureSeats) {
      states[seatId] = { status: "booked" }
    }
    for (const [seatId, info] of memberAssignedSeats.entries()) {
      const isCurrentPax =
        info.memberIdx === activeSeatMemberIdx &&
        info.paxIdx === activeSeatPaxIdx
      if (!isCurrentPax) {
        states[seatId] = {
          status: "booked",
          groupName: `M#${info.memberIdx + 1}`,
          passengerName: info.memberName,
        }
      }
    }
    return states
  }, [occupiedDepartureSeats, memberAssignedSeats, activeSeatMemberIdx, activeSeatPaxIdx])

  const currentSelectedSeatId = useMemo(() => {
    const activeMember = members[activeSeatMemberIdx]
    const activePax = activeMember?.passengers?.[activeSeatPaxIdx]
    return activePax?.seatId ? [resolveSeatId(layoutKey, activePax.seatId)] : []
  }, [members, activeSeatMemberIdx, activeSeatPaxIdx, layoutKey])

  // Total metrics
  const totalSeats = useMemo(() => {
    return members.reduce((sum, m) => sum + (m.passengers?.length || 0), 0)
  }, [members])

  const totalFare = useMemo(() => {
    return members.reduce((sum, m) => sum + Number(m.fare || 0), 0)
  }, [members])

  // Validation
  const step1Valid = Boolean(groupName.trim() && tourName && journeyDate && busType)

  const step2Errors = useMemo(() => {
    const errs = []
    if (members.length === 0) errs.push("At least one member booking is required.")
    members.forEach((m, i) => {
      if (!m.contactName?.trim()) errs.push(`Member ${i + 1}: Contact name is required.`)
      if (!validateIndianPhone(m.contactPhone)) {
        errs.push(`Member ${i + 1}: Valid 10-digit mobile number required.`)
      }
      if (Number(m.fare || 0) <= 0) {
        errs.push(`Member ${i + 1}: Fare must be greater than zero.`)
      }
      ;(m.passengers || []).forEach((p, pi) => {
        if (!p.name?.trim()) errs.push(`Member ${i + 1}, Pax ${pi + 1}: Name required.`)
        if (!p.seatId) errs.push(`Member ${i + 1}, Pax ${pi + 1}: Seat selection required.`)
      })
    })
    return errs
  }, [members])

  const handleAddMember = () => {
    setMembers((prev) => [
      ...prev,
      {
        id: `mem-${Date.now()}`,
        contactName: "",
        contactPhone: "",
        fare: "",
        pickupPoint: defaultPickupPoint,
        pickupTime: defaultPickupTime,
        dropPoint: defaultDropPoint,
        overrideLadies: false,
        overrideReason: "",
        passengers: [
          { id: `p-${Date.now()}-1`, name: "", age: "30", gender: "Male", city: "", seatId: "" },
        ],
      },
    ])
  }

  const handleRemoveMember = (idx) => {
    if (members.length <= 1) return
    setMembers((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleAddPassenger = (mIdx) => {
    setMembers((prev) => {
      const copy = [...prev]
      const member = { ...copy[mIdx] }
      member.passengers = [
        ...member.passengers,
        {
          id: `p-${Date.now()}-${member.passengers.length + 1}`,
          name: "",
          age: "30",
          gender: "Male",
          city: member.passengers[0]?.city || "",
          seatId: "",
        },
      ]
      copy[mIdx] = member
      return copy
    })
  }

  const handleRemovePassenger = (mIdx, pIdx) => {
    setMembers((prev) => {
      const copy = [...prev]
      const member = { ...copy[mIdx] }
      if (member.passengers.length <= 1) return prev
      member.passengers = member.passengers.filter((_, i) => i !== pIdx)
      copy[mIdx] = member
      return copy
    })
  }

  const handleSelectSeat = (seatId) => {
    const canonical = resolveSeatId(layoutKey, seatId)
    // Check if taken on departure
    if (occupiedDepartureSeats.has(canonical)) {
      toast.error(`Seat ${canonical} is already booked on this departure.`)
      return
    }

    // Check if taken by another member
    const existing = memberAssignedSeats.get(canonical)
    if (existing && (existing.memberIdx !== activeSeatMemberIdx || existing.paxIdx !== activeSeatPaxIdx)) {
      toast.error(`Seat ${canonical} is already assigned to ${existing.memberName}.`)
      return
    }

    setMembers((prev) => {
      const copy = [...prev]
      const member = { ...copy[activeSeatMemberIdx] }
      const pax = { ...member.passengers[activeSeatPaxIdx] }
      pax.seatId = canonical
      member.passengers[activeSeatPaxIdx] = pax

      // Auto-suggest fare if preset exists and fare is empty
      if (!member.fare && departureSeatConfig?.fares) {
        let suggestedRupees = 0
        if (canonical.includes("-U") && departureSeatConfig.fares.upper) {
          suggestedRupees = Math.round(departureSeatConfig.fares.upper / 100)
        } else if (canonical.includes("-L") && departureSeatConfig.fares.lower) {
          suggestedRupees = Math.round(departureSeatConfig.fares.lower / 100)
        } else if (canonical.startsWith("rear-") && (departureSeatConfig.fares.rear || departureSeatConfig.fares.lower)) {
          suggestedRupees = Math.round((departureSeatConfig.fares.rear || departureSeatConfig.fares.lower) / 100)
        } else if (departureSeatConfig.fares.seat) {
          suggestedRupees = Math.round(departureSeatConfig.fares.seat / 100)
        }
        if (suggestedRupees > 0) {
          member.fare = suggestedRupees * member.passengers.length
        }
      }

      copy[activeSeatMemberIdx] = member
      return copy
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (step !== 2 || !step1Valid || step2Errors.length > 0) return

    setServerError("")
    setIsSubmitting(true)

    try {
      const formattedMembers = members.map((m) => ({
        contactName: m.contactName.trim(),
        contactPhone: m.contactPhone.trim(),
        pickupPoint: m.pickupPoint?.trim() || defaultPickupPoint.trim(),
        pickupTime: m.pickupTime?.trim() || defaultPickupTime.trim(),
        dropPoint: m.dropPoint?.trim() || defaultDropPoint.trim(),
        totalAmount: Number(m.fare || 0),
        baseAmount: Number(m.fare || 0),
        advanceReceived: 0,
        overrideLadies: Boolean(m.overrideLadies),
        overrideReason: m.overrideReason?.trim() || "",
        passengers: m.passengers.map((p) => ({
          name: p.name.trim(),
          age: Number(p.age || 30),
          gender: p.gender || "Male",
          city: p.city?.trim() || "City",
          seatId: resolveSeatId(layoutKey, p.seatId),
          pickupPoint: m.pickupPoint?.trim() || defaultPickupPoint.trim(),
          pickupTime: m.pickupTime?.trim() || defaultPickupTime.trim(),
        })),
      }))

      const payload = {
        name: groupName.trim(),
        leaderName: leaderName.trim(),
        leaderPhone: leaderPhone.trim(),
        tourName,
        journeyDate,
        busType,
        note: note.trim(),
        members: formattedMembers,
      }

      const res = await fetch("/api/groups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.message || "Failed to create group booking")
      }

      toast.success(`Group '${groupName}' created with ${formattedMembers.length} bookings!`)
      if (onGroupCreated) onGroupCreated(data.group)
      onClose()
    } catch (err) {
      setServerError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose()
      }}
      title={step === 1 ? "New Group Booking — Step 1: Group Info" : `New Group Booking — Step 2: Member Details`}
      size="xl"
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
            e.preventDefault()
          }
        }}
        className="space-y-4"
      >
        {serverError && (
          <div
            role="alert"
            className="p-3 rounded-[var(--yh-radius-md)] bg-danger-soft border border-danger/30 text-danger-text text-sm flex items-start gap-2"
          >
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-danger" />
            <div>
              <p className="font-semibold">Creation failed</p>
              <p className="text-xs mt-0.5">{serverError}</p>
            </div>
          </div>
        )}

        {/* ── STEP 1: GROUP INFO ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field id="grp-name" label="Group Name" required hint="e.g. Patel Family Yatra, TCS Tour Group">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    value={groupName}
                    maxLength={80}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Enter group name"
                    aria-describedby={describedBy}
                    required
                  />
                )}
              </Field>

              <Field id="grp-tour" label="Tour Destination" required>
                {({ id, describedBy }) => (
                  <Select
                    id={id}
                    value={tourName}
                    onChange={(e) => setTourName(e.target.value)}
                    aria-describedby={describedBy}
                    required
                  >
                    {tours.map((t) => {
                      const name = typeof t === "string" ? t : (t.name || "")
                      const key = typeof t === "string" ? t : (t._id || t.id || t.name)
                      return (
                        <option key={key} value={name}>
                          {name}
                        </option>
                      )
                    })}
                  </Select>
                )}
              </Field>

              <Field id="grp-date" label="Journey Date" required>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    type="date"
                    value={journeyDate}
                    onChange={(e) => setJourneyDate(e.target.value)}
                    aria-describedby={describedBy}
                    required
                  />
                )}
              </Field>

              <Field id="grp-bus" label="Bus Arrangement" required>
                {({ id, describedBy }) => (
                  <Select
                    id={id}
                    value={busType}
                    onChange={(e) => setBusType(e.target.value)}
                    aria-describedby={describedBy}
                    required
                  >
                    {STANDARD_BUS_TYPES.map((bt) => (
                      <option key={bt} value={bt}>
                        {bt}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field id="grp-leader-name" label="Group Leader / Coordinator Name">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    value={leaderName}
                    maxLength={80}
                    onChange={(e) => setLeaderName(e.target.value)}
                    placeholder="e.g. Ramesh Bhai Patel"
                    aria-describedby={describedBy}
                  />
                )}
              </Field>

              <Field id="grp-leader-phone" label="Leader Mobile Number" hint="10-digit Indian number">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    value={leaderPhone}
                    maxLength={10}
                    onChange={(e) => setLeaderPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    aria-describedby={describedBy}
                  />
                )}
              </Field>
            </div>

            {/* Default Boarding Info for members */}
            <div className="p-3 bg-surface-muted/50 border border-border-subtle rounded-[var(--yh-radius-md)] space-y-2">
              <p className="text-xs font-semibold text-ink">Default Boarding &amp; Drop (Applied to all members)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="Pickup Stop"
                  value={defaultPickupPoint}
                  onChange={(e) => setDefaultPickupPoint(e.target.value)}
                  className="text-xs"
                />
                <Input
                  placeholder="Pickup Time (HH:MM)"
                  value={defaultPickupTime}
                  onChange={(e) => setDefaultPickupTime(e.target.value)}
                  className="text-xs"
                />
                <Input
                  placeholder="Drop Stop"
                  value={defaultDropPoint}
                  onChange={(e) => setDefaultDropPoint(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border-subtle">
              <Button
                type="button"
                variant="primary"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                rightIcon={<ChevronRight size={14} />}
              >
                Proceed to Member Details
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: MEMBER DETAILS & SEATS ── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Live Summary Bar */}
            <div className="p-3 bg-brand-soft border border-brand/20 rounded-[var(--yh-radius-md)] flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-4">
                <span>
                  Group: <strong>{groupName}</strong>
                </span>
                <span>
                  Members: <strong>{members.length}</strong>
                </span>
                <span>
                  Seats: <strong>{totalSeats}</strong>
                </span>
              </div>
              <div>
                Total Fare: <strong className="text-brand tabular-nums font-bold">{formatINR(totalFare)}</strong>
              </div>
            </div>

            {/* Member list and seat allocation */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Member input column */}
              <div className="lg:col-span-2 space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {members.map((m, mIdx) => (
                  <Card key={m.id} padding="sm" elevation="sm" className="space-y-2.5 border border-border-subtle">
                    <div className="flex items-center justify-between border-b border-border-subtle pb-1.5">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <Users size={13} className="text-brand" />
                        Member #{mIdx + 1}
                      </span>
                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(mIdx)}
                          className="text-danger hover:text-danger-dark text-xs p-1"
                          title="Remove member"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input
                        placeholder="Contact Name"
                        value={m.contactName}
                        onChange={(e) => {
                          const copy = [...members]
                          copy[mIdx].contactName = e.target.value
                          setMembers(copy)
                        }}
                        className="text-xs"
                        required
                      />
                      <Input
                        placeholder="Mobile (10 digits)"
                        value={m.contactPhone}
                        maxLength={10}
                        onChange={(e) => {
                          const copy = [...members]
                          copy[mIdx].contactPhone = e.target.value
                          setMembers(copy)
                        }}
                        className="text-xs"
                        required
                      />
                      <Input
                        type="number"
                        placeholder="Total Fare (₹)"
                        value={m.fare}
                        onChange={(e) => {
                          const copy = [...members]
                          copy[mIdx].fare = e.target.value
                          setMembers(copy)
                        }}
                        className="text-xs font-bold"
                        required
                      />
                    </div>

                    {/* Passenger / Seat rows */}
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-semibold text-ink-muted">Passengers &amp; Berths:</p>
                      {m.passengers.map((p, pIdx) => {
                        const isSelectedSeat = p.seatId
                        const isActivePicker = activeSeatMemberIdx === mIdx && activeSeatPaxIdx === pIdx

                        return (
                          <div
                            key={p.id}
                            className={`p-2 rounded border text-xs flex flex-wrap sm:flex-nowrap items-center gap-2 ${
                              isActivePicker ? "border-brand bg-brand-soft/30" : "border-border-subtle bg-surface"
                            }`}
                          >
                            <Input
                              placeholder="Passenger Name"
                              value={p.name}
                              onChange={(e) => {
                                const copy = [...members]
                                copy[mIdx].passengers[pIdx].name = e.target.value
                                setMembers(copy)
                              }}
                              className="text-xs flex-1 min-w-[120px]"
                            />
                            <Select
                              value={p.gender}
                              onChange={(e) => {
                                const copy = [...members]
                                copy[mIdx].passengers[pIdx].gender = e.target.value
                                setMembers(copy)
                              }}
                              className="text-xs w-20"
                            >
                              <option value="Male">M</option>
                              <option value="Female">F</option>
                              <option value="Other">O</option>
                            </Select>
                            <Input
                              type="number"
                              placeholder="Age"
                              value={p.age}
                              onChange={(e) => {
                                const copy = [...members]
                                copy[mIdx].passengers[pIdx].age = e.target.value
                                setMembers(copy)
                              }}
                              className="text-xs w-14"
                            />
                            <Button
                              type="button"
                              variant={isSelectedSeat ? "outline" : "primary"}
                              size="xs"
                              className={`shrink-0 ${isSelectedSeat ? "border-brand font-bold" : ""}`}
                              onClick={() => {
                                setActiveSeatMemberIdx(mIdx)
                                setActiveSeatPaxIdx(pIdx)
                              }}
                            >
                              {isSelectedSeat ? `Seat: ${p.seatId}` : "Pick Seat"}
                            </Button>
                            {m.passengers.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemovePassenger(mIdx, pIdx)}
                                className="text-ink-muted hover:text-danger p-0.5"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        )
                      })}

                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        leftIcon={<Plus size={11} />}
                        onClick={() => handleAddPassenger(mIdx)}
                        className="text-brand text-xs h-auto p-1 mt-1"
                      >
                        Add Passenger to Member #{mIdx + 1}
                      </Button>
                    </div>
                  </Card>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  leftIcon={<Plus size={14} />}
                  onClick={handleAddMember}
                  className="w-full border-dashed"
                >
                  + Add Another Member Booking
                </Button>
              </div>

              {/* Quick Seat Selector Grid */}
              <div className="border border-border-subtle rounded-[var(--yh-radius-md)] p-3 bg-surface-muted/30 space-y-2">
                <div className="flex items-center justify-between text-xs pb-1.5 border-b border-border-subtle">
                  <span className="font-bold text-ink">
                    Assign Seat for: M#{activeSeatMemberIdx + 1} (Pax {activeSeatPaxIdx + 1})
                  </span>
                  <span className="text-[10px] text-ink-muted">{busType.split("(")[0]}</span>
                </div>

                <p className="text-[11px] text-ink-muted">
                  Click any free berth to assign to selected passenger:
                </p>

                {/* Shared SeatMap with Deck Tabs */}
                <div
                  role="region"
                  aria-label="Coach Seat Grid"
                  className="max-h-[460px] overflow-y-auto space-y-1.5 text-xs p-1"
                >
                  <SeatMap
                    layout={layoutKey}
                    seatStates={groupSeatStates}
                    selectedIds={currentSelectedSeatId}
                    onSeatClick={(seatId) => handleSelectSeat(seatId)}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Error messages summary */}
            {step2Errors.length > 0 && (
              <div className="p-2.5 bg-danger-soft/60 border border-danger/20 rounded text-xs text-danger-text space-y-0.5">
                <p className="font-bold">Please complete all required fields:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {step2Errors.slice(0, 5).map((e, idx) => (
                    <li key={idx}>{e}</li>
                  ))}
                  {step2Errors.length > 5 && <li>...and {step2Errors.length - 5} more issues</li>}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                leftIcon={<ChevronLeft size={14} />}
              >
                Back to Group Info
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={step2Errors.length > 0 || isSubmitting}
                leftIcon={isSubmitting ? undefined : <Check size={14} />}
              >
                {isSubmitting ? "Creating Group..." : `Create Group (${members.length} Bookings)`}
              </Button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  )
}
