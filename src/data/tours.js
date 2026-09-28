import { request } from "./client"

function normalizeTour(t) {
  if (!t) return t
  return {
    ...t,
    id: t._id || t.id,
  }
}

export async function listTours() {
  const data = await request("/api/tours")
  return (data || []).map(normalizeTour)
}

export async function createTour(tourData) {
  const data = await request("/api/tours", {
    method: "POST",
    body: JSON.stringify(tourData),
  })
  return normalizeTour(data)
}

export async function updateTour(id, tourData) {
  const data = await request(`/api/tours/${id}`, {
    method: "PUT",
    body: JSON.stringify(tourData),
  })
  return normalizeTour(data)
}

export async function deleteTour(id) {
  return request(`/api/tours/${id}`, {
    method: "DELETE",
  })
}
