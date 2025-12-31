"use client";

import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Save,
  UserPlus,
  Trash2,
  Bus,
  CreditCard,
  Users,
  Calendar,
  Building,
  ChevronDown,
  Check,
  Layout,
  X,
  LockKeyhole,
} from "lucide-react";

const CustomSelect = ({
  label,
  value,
  options,
  onChange,
  placeholder,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`space-y-2 relative ${className}`}>
      {label && (
        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-left focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-600 transition-all outline-none flex items-center justify-between group"
        >
          <span className={value ? "text-slate-900" : "text-slate-400"}>
            {options.find((opt) => opt.value === value)?.label || placeholder}
          </span>
          <ChevronDown
            size={18}
            className={`text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="max-h-60 overflow-y-auto custom-scrollbar p-2">
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                      value === option.value
                        ? "bg-indigo-600 text-white"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {option.label}
                    {value === option.value && <Check size={14} />}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const GenderSelector = ({ value, onChange }) => {
  const options = [
    { label: "Male", value: "Male" },
    { label: "Female", value: "Female" },
  ];

  return (
    <div className="flex gap-2 w-full">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
            value === opt.value
              ? "bg-indigo-600 text-white shadow-md"
              : "bg-white border-2 border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-slate-700"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

const rows = [1, 2, 3, 4, 5, 6];

const Seat = ({ id, label, passengers, onSeatSelect, bookedSeats }) => {
  const getSeatInfo = (id) => passengers.find((p) => p.seatId === id);
  const occupant = getSeatInfo(id);
  const isSelectedInCurrentBooking = !!occupant;

  const bookedBy = bookedSeats.find((bs) => bs.seatId === id);
  const isBookedByOther = !!bookedBy;

  return (
    <button
      type="button"
      onClick={() => !isBookedByOther && onSeatSelect(id)}
      disabled={isBookedByOther}
      className={`relative h-14 md:h-16 rounded-lg border-2 transition-all flex flex-col items-center justify-center p-1 group ${
        isBookedByOther
          ? "border-red-300 bg-red-50 cursor-not-allowed opacity-75"
          : isSelectedInCurrentBooking
          ? "border-indigo-600 bg-indigo-50 cursor-pointer"
          : "border-slate-200 bg-white hover:border-indigo-300 cursor-pointer"
      }`}
    >
      <span
        className={`text-[8px] md:text-[9px] font-black mb-0.5 ${
          isBookedByOther
            ? "text-red-600"
            : isSelectedInCurrentBooking
            ? "text-indigo-600"
            : "text-slate-400"
        }`}
      >
        {label}
      </span>
      {isBookedByOther ? (
        <div className="flex flex-col items-center">
          <LockKeyhole size={10} className="text-red-500 mb-0.5" />
          <div className="text-[7px] font-bold text-red-700 leading-tight text-center truncate w-full px-1">
            {bookedBy.passengerName?.split(" ")[0] || "Booked"}
          </div>
        </div>
      ) : isSelectedInCurrentBooking ? (
        <div className="text-[8px] font-bold text-indigo-900 leading-tight text-center truncate w-full px-1">
          {occupant.name?.split(" ")[0] || "USER"}
        </div>
      ) : (
        <div className="w-1 h-1 rounded-full bg-slate-200 group-hover:bg-indigo-300" />
      )}
    </button>
  );
};

const DeckGrid = ({ deck, passengers, onSeatSelect, bookedSeats }) => (
  <div className="flex flex-col items-center space-y-4">
    <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 mb-2">
      {deck} DECK
    </div>
    <div className="relative bg-slate-100 p-4 rounded-2xl border-4 border-slate-200 shadow-inner">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-300 px-3 py-1 rounded-full text-[8px] font-black text-slate-600 uppercase tracking-widest z-10">
        FRONT
      </div>

      <div className="flex gap-4">
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <Seat
              key={`${deck}-L${row}`}
              id={`${deck}-L${row}`}
              label={`${deck[0].toUpperCase()}${row}-L`}
              passengers={passengers}
              onSeatSelect={onSeatSelect}
              bookedSeats={bookedSeats}
            />
          ))}
        </div>

        <div className="w-8 md:w-10 bg-slate-200/50 rounded-lg flex items-center justify-center relative overflow-hidden">
          <div className="rotate-90 whitespace-nowrap text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-[0.5em] flex items-center gap-2">
            <span className="opacity-20">----------</span>
            GALLARY
            <span className="opacity-20">----------</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {rows.map((row) => (
            <div key={`${deck}-R${row}-group`} className="contents">
              <Seat
                id={`${deck}-R${row}-1`}
                label={`${deck[0].toUpperCase()}${row}-R1`}
                passengers={passengers}
                onSeatSelect={onSeatSelect}
                bookedSeats={bookedSeats}
              />
              <Seat
                id={`${deck}-R${row}-2`}
                label={`${deck[0].toUpperCase()}${row}-R2`}
                passengers={passengers}
                onSeatSelect={onSeatSelect}
                bookedSeats={bookedSeats}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

const SeatLayout = ({ passengers, bookedSeats, onSeatSelect }) => {
  return (
    <div className="flex flex-col md:flex-row items-start justify-center gap-8 md:gap-16 p-4 overflow-x-auto custom-scrollbar min-h-150">
      <DeckGrid
        deck="lower"
        passengers={passengers}
        onSeatSelect={onSeatSelect}
        bookedSeats={bookedSeats}
      />
      <DeckGrid
        deck="upper"
        passengers={passengers}
        onSeatSelect={onSeatSelect}
        bookedSeats={bookedSeats}
      />
    </div>
  );
};

export default function BookingForm({
  onSave,
  tours,
  editData,
  onCancel,
  bookings = [],
}) {
  const [formData, setFormData] = useState(() => ({
    id: editData?.id || Date.now().toString(),
    invoiceNo:
      editData?.invoiceNo || `SBT-${Math.floor(Math.random() * 9000) + 1000}`,
    date: editData?.date || new Date().toISOString().split("T")[0],
    contactName: editData?.contactName || "",
    contactPhone: editData?.contactPhone || "",
    contactEmail: editData?.contactEmail || "",
    tourName: editData?.tourName || "",
    journeyDate: editData?.journeyDate || "",
    duration: editData?.duration || "",
    busType: editData?.busType || "",
    paymentMode: editData?.paymentMode || "Cash",
    totalAmount: editData?.totalAmount || 0,
    advanceReceived: editData?.advanceReceived || 0,
    passengers: editData?.passengers || [
      {
        name: "",
        city: "",
        age: "",
        gender: "Male",
        contact: "",
        aadhar: "",
        seatId: "",
      },
    ],
    isFixedPrice: false, // Track if the selected tour has fixed pricing
  }));

  const [showSeatMap, setShowSeatMap] = useState(false);
  const [activePassengerIndex, setActivePassengerIndex] = useState(0);

  const calculateTotal = (passengers, tourName) => {
    const tour = tours.find((t) => t.name === tourName);
    if (!tour) return 0;

    return passengers.reduce((sum, p) => {
      // Check if tour uses fixed pricing
      if (
        tour.pricingType === "fixed" ||
        (tour.fixedPrice && !tour.pricingType)
      ) {
        return sum + (Number(tour.fixedPrice) || 0);
      }

      // Otherwise use berth-based pricing
      const isUpper = p.seatId?.startsWith("upper");
      const price = isUpper
        ? Number(tour.upperPrice) || 0
        : Number(tour.lowerPrice) || 0;
      return sum + price;
    }, 0);
  };

  const handleTourSelect = (tourName) => {
    if (tourName === "custom") {
      setFormData({ ...formData, tourName: "" });
      return;
    }
    const tour = tours.find((t) => t.name === tourName);
    if (tour) {
      const newTotal = calculateTotal(formData.passengers, tour.name);
      setFormData((prev) => ({
        ...prev,
        tourName: tour.name,
        duration: tour.duration,
        busType: tour.busType,
        journeyDate: tour.journeyDate || prev.journeyDate,
        totalAmount: newTotal,
        isFixedPrice: tour.isFixedPrice,
      }));
    } else {
      setFormData({ ...formData, tourName: tourName });
    }
  };

  const handleSeatSelection = (seatId) => {
    const updated = [...formData.passengers];
    const occupantIdx = updated.findIndex((p) => p.seatId === seatId);
    if (occupantIdx !== -1 && occupantIdx !== activePassengerIndex) return;

    updated[activePassengerIndex].seatId =
      updated[activePassengerIndex].seatId === seatId ? "" : seatId;

    const newTotal = calculateTotal(updated, formData.tourName);
    setFormData({ ...formData, passengers: updated, totalAmount: newTotal });
  };

  const addPassenger = () => {
    setFormData({
      ...formData,
      passengers: [
        ...formData.passengers,
        {
          name: "",
          city: "",
          age: "",
          gender: "Male",
          contact: "",
          aadhar: "",
          seatId: "",
        },
      ],
    });
  };

  const removePassenger = (index) => {
    if (formData.passengers.length > 1) {
      const updated = formData.passengers.filter((_, i) => i !== index);
      setFormData({ ...formData, passengers: updated });
    }
  };

  const updatePassenger = (index, field, value) => {
    const updated = [...formData.passengers];
    updated[index][field] = value;
    setFormData({ ...formData, passengers: updated });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const bookedSeats = useMemo(() => {
    if (!formData.tourName || !formData.journeyDate) return [];

    const targetDate = new Date(formData.journeyDate)
      .toISOString()
      .split("T")[0];

    const relevantBookings = bookings.filter((b) => {
      const isSameTour = b.tourName === formData.tourName;
      const bookingDate = new Date(b.journeyDate).toISOString().split("T")[0];
      const isSameDate = bookingDate === targetDate;
      const isNotCurrentBooking = b.id !== formData.id && b._id !== formData.id;
      return isSameTour && isSameDate && isNotCurrentBooking;
    });

    const seats = [];
    relevantBookings.forEach((booking) => {
      booking.passengers.forEach((passenger) => {
        if (passenger.seatId) {
          seats.push({
            seatId: passenger.seatId,
            passengerName: passenger.name,
            bookingId: booking.id,
            invoiceNo: booking.invoiceNo,
          });
        }
      });
    });

    return seats;
  }, [formData.tourName, formData.journeyDate, bookings, formData.id]);

  return (
    <form onSubmit={handleSubmit} className="space-y-10 pb-20 animate-entrance">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-2 text-slate-400 hover:text-primary font-bold text-sm mb-2 transition-colors group"
          >
            <ArrowLeft
              size={16}
              className="group-hover:-translate-x-1 transition-transform"
            />{" "}
            Dashboard
          </button>
          <h2 className="text-4xl font-black text-slate-900 tracking-tight">
            {editData ? "Refine Reservation" : "Plan New Journey"}
          </h2>
        </div>
        <button
          type="submit"
          className="w-full md:w-auto bg-primary hover:bg-primary/90 text-white px-10 py-4 rounded-2xl font-black text-sm shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          <Save size={18} /> {editData ? "Update Details" : "Confirm Booking"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white rounded-[2.5rem] p-8 lg:p-10 shadow-sm border border-slate-200/50">
            <div className="flex items-center gap-3 mb-10">
              <div className="bg-primary/10 text-primary p-3 rounded-2xl">
                <Building size={20} />
              </div>
              <h3 className="font-black text-xl text-slate-900">
                Contact Information
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-2.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Primary Traveler
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full name as per ID"
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:border-primary/20 transition-all outline-none"
                  value={formData.contactName}
                  onChange={(e) =>
                    setFormData({ ...formData, contactName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2.5">
                <label className="text-[11px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  Mobile Contact
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 XXXX XXX XXX"
                  className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={
                    formData.contactPhone ? `+91 ${formData.contactPhone}` : ""
                  }
                  onChange={(e) => {
                    const value = e.target.value
                      .replace(/^\+91\s*/, "")
                      .replace(/\D/g, "")
                      .slice(0, 10);
                    setFormData({ ...formData, contactPhone: value });
                  }}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Email ID (Optional)
                </label>
                <input
                  type="email"
                  placeholder="email@address.com"
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.contactEmail}
                  onChange={(e) =>
                    setFormData({ ...formData, contactEmail: e.target.value })
                  }
                />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                  <Users size={20} />
                </div>
                <h3 className="font-black text-lg text-slate-900">
                  Passenger Manifest
                </h3>
              </div>
              <button
                type="button"
                onClick={addPassenger}
                className="text-white bg-indigo-600 hover:bg-indigo-700 px-5 py-2.5 rounded-xl font-black text-xs transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 active:scale-95"
              >
                <UserPlus size={16} /> Add Passenger
              </button>
            </div>

            <div className="space-y-6">
              {formData.passengers.map((p, i) => (
                <div
                  key={i}
                  className="bg-slate-50/50 p-6 rounded-3xl border border-slate-100 relative group transition-all overflow-visible"
                >
                  <div className="flex items-center justify-between mb-6">
                    <span className="bg-indigo-100 text-indigo-700 w-8 h-8 rounded-full flex items-center justify-center font-black text-xs">
                      #{i + 1}
                    </span>
                    {formData.passengers.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePassenger(i)}
                        className="p-2 text-slate-300 hover:text-white hover:bg-red-500 rounded-xl transition-all shadow-sm"
                        title="Remove Passenger"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Name
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full px-0 py-1 bg-transparent border-b border-slate-200 text-sm font-bold focus:border-indigo-600 transition-all outline-none"
                          value={p.name}
                          onChange={(e) =>
                            updatePassenger(i, "name", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          City
                        </label>
                        <input
                          type="text"
                          required
                          className="w-full px-0 py-1 bg-transparent border-b border-slate-200 text-sm font-bold focus:border-indigo-600 transition-all outline-none"
                          value={p.city}
                          onChange={(e) =>
                            updatePassenger(i, "city", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Age
                        </label>
                        <input
                          type="number"
                          required
                          className="w-full px-0 py-1 bg-transparent border-b border-slate-200 text-sm font-bold focus:border-indigo-600 transition-all outline-none"
                          value={p.age}
                          onChange={(e) =>
                            updatePassenger(i, "age", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          Gender
                        </label>
                        <GenderSelector
                          value={p.gender}
                          onChange={(val) => updatePassenger(i, "gender", val)}
                        />
                      </div>
                      <div className="space-y-2.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-indigo-600">
                          Selected Seat
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setActivePassengerIndex(i);
                            setShowSeatMap(true);
                          }}
                          className={`w-full py-2.5 rounded-xl text-xs font-black border-2 transition-all flex items-center justify-center gap-2 ${
                            p.seatId
                              ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                              : "border-slate-200 text-slate-400 bg-white"
                          }`}
                        >
                          <Layout size={14} /> {p.seatId || "Select Seat"}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 border-dashed">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                          Internal Contact (Admin Only)
                        </label>
                        <input
                          type="tel"
                          placeholder="+91 XXXXXXXXXX"
                          className="w-full px-4 py-2 bg-white border-transparent rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-100 transition-all outline-none"
                          value={p.contact ? `+91 ${p.contact}` : ""}
                          onChange={(e) => {
                            const value = e.target.value
                              .replace(/^\+91\s*/, "") // remove +91
                              .replace(/\D/g, "") // only digits
                              .slice(0, 10); // max 10 digits

                            updatePassenger(i, "contact", value);
                          }}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                          Aadhar Card (Admin Only)
                        </label>
                        <input
                          type="text"
                          placeholder="XXXX XXXX XXXX"
                          maxLength={14}
                          className="w-full px-4 py-2 bg-white border-transparent rounded-xl text-xs font-bold focus:ring-1 focus:ring-indigo-100 transition-all outline-none"
                          value={
                            p.aadhar
                              ? p.aadhar.replace(/(\d{4})(?=\d)/g, "$1 ")
                              : ""
                          }
                          onChange={(e) => {
                            const raw = e.target.value
                              .replace(/\D/g, "") // only digits
                              .slice(0, 12); // max 12 digits

                            updatePassenger(i, "aadhar", raw);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {showSeatMap && (
            <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-white/95 backdrop-blur-md animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl animate-in zoom-in-95 duration-300 max-h-[95vh] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-6 md:p-8 border-b border-slate-100">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900">
                      Choose Seat
                    </h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1.5">
                      Assigning seat for:{" "}
                      <span className="text-indigo-600">
                        {formData.passengers[activePassengerIndex].name ||
                          "Passenger " + (activePassengerIndex + 1)}
                      </span>
                    </p>
                    {bookedSeats.length > 0 && (
                      <p className="text-[11px] font-bold text-red-600 uppercase tracking-wide mt-2 flex items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-full">
                        <LockKeyhole size={12} /> {bookedSeats.length} seats
                        already booked
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSeatMap(false)}
                    className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all active:scale-95"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1 p-6 md:p-8">
                  <SeatLayout
                    passengers={formData.passengers}
                    bookedSeats={bookedSeats}
                    onSeatSelect={handleSeatSelection}
                  />
                </div>

                <div className="p-6 md:p-8 border-t border-slate-100 bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() => setShowSeatMap(false)}
                    className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-12 py-4 rounded-2xl font-black text-sm shadow-xl shadow-indigo-200 transition-all active:scale-[0.98] float-right"
                  >
                    Confirm Selection
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="lg:col-span-4 space-y-10">
          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-orange-50 text-orange-600 p-2.5 rounded-xl">
                <Bus size={20} />
              </div>
              <h3 className="font-black text-lg text-slate-900">
                Tour Logistics
              </h3>
            </div>
            <div className="space-y-6">
              <CustomSelect
                label="Quick Tour Selection"
                value={formData.tourName}
                onChange={handleTourSelect}
                placeholder="Select a pre-defined tour..."
                options={[
                  ...tours.map((t) => ({ label: t.name, value: t.name })),
                  { label: "+ Manual Entry", value: "custom" },
                ]}
              />

              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Tour Destination Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nepal-Special Package"
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.tourName}
                  onChange={(e) =>
                    setFormData({ ...formData, tourName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Journey Date
                </label>
                <div className="relative">
                  <Calendar
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={18}
                  />
                  <input
                    type="date"
                    required
                    className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                    value={formData.journeyDate}
                    onChange={(e) =>
                      setFormData({ ...formData, journeyDate: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Bus Arrangement
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2x1 Sleeper Luxury"
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.busType}
                  onChange={(e) =>
                    setFormData({ ...formData, busType: e.target.value })
                  }
                />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                <CreditCard size={20} />
              </div>
              <h3 className="font-black text-lg text-slate-900">
                Billing Summary
              </h3>
            </div>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Total Package Cost (₹)
                </label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.totalAmount || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      totalAmount: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Advance Received (₹)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full px-5 py-3.5 bg-emerald-50 text-emerald-700 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-600 transition-all outline-none"
                  value={formData.advanceReceived || ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      advanceReceived: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="p-6 bg-indigo-600 rounded-3xl text-white shadow-xl shadow-indigo-100">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 block mb-1">
                  Balance Due
                </span>
                <div className="text-3xl font-black">
                  ₹
                  {(
                    formData.totalAmount - formData.advanceReceived
                  ).toLocaleString()}
                </div>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}
