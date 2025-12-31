"use client"

import { useState } from "react"
import { Map, Plus, Trash2, Bus, Clock, Calendar, Edit3, X, Check } from "lucide-react"

export default function TourInventory({ tours, onAdd, onDelete }) {
  const [newTour, setNewTour] = useState({
    name: "",
    duration: "",
    busType: "",
    journeyDate: "",
    lowerPrice: "", // added price fields
    upperPrice: "",
  })
  const [editingId, setEditingId] = useState(null)
  const [editTour, setEditTour] = useState({
    name: "",
    duration: "",
    busType: "",
    journeyDate: "",
    lowerPrice: "",
    upperPrice: "",
  })

  const handleAdd = (e) => {
    e.preventDefault()
    if (newTour.name) {
      onAdd({ ...newTour, id: Date.now().toString() })
      setNewTour({ name: "", duration: "", busType: "", journeyDate: "", lowerPrice: "", upperPrice: "" })
    }
  }

  const startEdit = (tour) => {
    setEditingId(tour.id)
    setEditTour(tour)
  }

  const handleUpdate = () => {
    onAdd(editTour) // onAdd in App.jsx handles both create and update
    setEditingId(null)
  }

  return (
    <div className="space-y-8 animate-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Tour Inventory</h2>
          <p className="text-sm text-slate-500 font-medium">Manage your available travel packages</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Add New Tour Form */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-4xl p-8 shadow-sm border border-slate-100 sticky top-24">
            <h3 className="font-black text-lg text-slate-900 mb-6">Create Tour Template</h3>
            <form onSubmit={handleAdd} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tour Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nepal Special Tour"
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  value={newTour.name}
                  onChange={(e) => setNewTour({ ...newTour, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Duration</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 10 Days / 11 Nights"
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  value={newTour.duration}
                  onChange={(e) => setNewTour({ ...newTour, duration: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Bus Type</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 2x1 Sleeper Luxury"
                  className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                  value={newTour.busType}
                  onChange={(e) => setNewTour({ ...newTour, busType: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Default Journey Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="date"
                    className="w-full pl-11 pr-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                    value={newTour.journeyDate}
                    onChange={(e) => setNewTour({ ...newTour, journeyDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Lower Berth ₹
                  </label>
                  <input
                    type="number"
                    placeholder="12000"
                    className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                    value={newTour.lowerPrice}
                    onChange={(e) => setNewTour({ ...newTour, lowerPrice: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Upper Berth ₹
                  </label>
                  <input
                    type="number"
                    placeholder="11000"
                    className="w-full px-5 py-3.5 bg-slate-50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all outline-none"
                    value={newTour.upperPrice}
                    onChange={(e) => setNewTour({ ...newTour, upperPrice: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black text-xs shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 mt-4"
              >
                <Plus size={16} strokeWidth={3} /> Save Tour Template
              </button>
            </form>
          </div>
        </div>

        {/* Tour List */}
        <div className="lg:col-span-8 space-y-4">
          {tours.map((tour) => (
            <div
              key={tour.id}
              className={`bg-white p-6 rounded-4xl shadow-sm border transition-all ${
                editingId === tour.id
                  ? "border-indigo-500 ring-2 ring-indigo-50"
                  : "border-slate-100 group hover:border-indigo-200"
              }`}
            >
              {editingId === tour.id ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      className="px-4 py-2 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                      value={editTour.name}
                      onChange={(e) => setEditTour({ ...editTour, name: e.target.value })}
                    />
                    <input
                      type="text"
                      className="px-4 py-2 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                      value={editTour.duration}
                      onChange={(e) => setEditTour({ ...editTour, duration: e.target.value })}
                    />
                    <input
                      type="text"
                      className="px-4 py-2 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                      value={editTour.busType}
                      onChange={(e) => setEditTour({ ...editTour, busType: e.target.value })}
                    />
                    <input
                      type="date"
                      className="px-4 py-2 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                      value={editTour.journeyDate}
                      onChange={(e) => setEditTour({ ...editTour, journeyDate: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="Lower Price"
                      className="px-4 py-2 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                      value={editTour.lowerPrice}
                      onChange={(e) => setEditTour({ ...editTour, lowerPrice: e.target.value })}
                    />
                    <input
                      type="number"
                      placeholder="Upper Price"
                      className="px-4 py-2 bg-slate-50 border rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100"
                      value={editTour.upperPrice}
                      onChange={(e) => setEditTour({ ...editTour, upperPrice: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditingId(null)} className="p-2 text-slate-400 hover:text-slate-600">
                      <X size={20} />
                    </button>
                    <button
                      onClick={handleUpdate}
                      className="p-2 text-indigo-600 hover:text-indigo-800 bg-indigo-50 rounded-lg"
                    >
                      <Check size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="bg-indigo-50 text-indigo-600 p-4 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <Map size={24} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-lg leading-none mb-2">{tour.name}</h4>
                      <div className="flex flex-wrap gap-4">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                          <Clock size={14} className="text-indigo-400" /> {tour.duration}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                          <Bus size={14} className="text-indigo-400" /> {tour.busType}
                        </span>
                        {tour.journeyDate && (
                          <span className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            <Calendar size={14} className="text-indigo-400" /> {tour.journeyDate}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 uppercase tracking-wider">
                          Lower: ₹{tour.lowerPrice || 0} | Upper: ₹{tour.upperPrice || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => startEdit(tour)}
                      className="p-3 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                    >
                      <Edit3 size={20} />
                    </button>
                    <button
                      onClick={() => onDelete(tour.id)}
                      className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {tours.length === 0 && (
            <div className="bg-white rounded-4xl p-20 text-center border-2 border-dashed border-slate-200">
              <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Map className="text-slate-300" size={32} />
              </div>
              <p className="font-bold text-slate-400">No tour templates created yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
