/**
 * Frontend Passenger Exchange API Client (Part 6X)
 *
 * Connects UI to /api/exchange and /api/import/passengers.
 */

import { getAuthToken } from "./client.js"

const API_URL = import.meta.env.VITE_API_URL || ""

async function request(path, options = {}) {
  const token = getAuthToken()
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const error = new Error(data.message || data.error || `Request failed with status ${res.status}`)
    error.status = res.status
    error.data = data
    throw error
  }

  return data
}

export async function fetchExchangeDepartures() {
  return request("/api/exchange/departures")
}

export async function exportPassengersExchange({
  tourName = "",
  startDate = "",
  endDate = "",
  departureKey = "",
  includeAadhaar = false,
} = {}) {
  const query = new URLSearchParams()
  if (tourName && tourName !== "all") query.set("tourName", tourName)
  if (startDate) query.set("startDate", startDate)
  if (endDate) query.set("endDate", endDate)
  if (departureKey) query.set("departureKey", departureKey)
  if (includeAadhaar) query.set("includeAadhaar", "true")

  const qs = query.toString() ? `?${query.toString()}` : ""
  return request(`/api/exchange/passengers${qs}`)
}

export async function previewPassengerImport({ exchange, mapping = {}, options = {} }) {
  return request("/api/import/passengers/preview", {
    method: "POST",
    body: JSON.stringify({ exchange, mapping, options }),
  })
}

export async function commitPassengerImport({ exchange, mapping = {}, options = {}, previewToken }) {
  return request("/api/import/passengers/commit", {
    method: "POST",
    body: JSON.stringify({ exchange, mapping, options, previewToken }),
  })
}
