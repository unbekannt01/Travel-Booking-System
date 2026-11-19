import { API_URL } from "../config"

export const API_STATUS_EVENT = "yatrahub:api-status"

export function emitApiStatus(reachable) {
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(API_STATUS_EVENT, { detail: { reachable: Boolean(reachable) } }))
  }
}

export function subscribeApiStatus(callback) {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") {
    return () => {}
  }
  const handler = (e) => callback(Boolean(e.detail?.reachable))
  window.addEventListener(API_STATUS_EVENT, handler)
  return () => window.removeEventListener(API_STATUS_EVENT, handler)
}

export async function checkApiHealth() {
  try {
    const url = `${API_URL}/api/tours`
    const res = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    })
    const isReachable = res.status < 500
    emitApiStatus(isReachable)
    return isReachable
  } catch {
    emitApiStatus(false)
    return false
  }
}

export function getAuthToken() {
  return localStorage.getItem("auth-token")
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("auth-token", token)
  } else {
    localStorage.removeItem("auth-token")
  }
}

export function removeAuthToken() {
  localStorage.removeItem("auth-token")
  localStorage.removeItem("tokenId")
}

export async function request(endpoint, options = {}) {
  const token = getAuthToken()
  const headers = {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`

  try {
    const response = await fetch(url, {
      credentials: "include",
      ...options,
      headers,
    })

    if (response.status >= 502 && response.status <= 504) {
      emitApiStatus(false)
    } else {
      emitApiStatus(true)
    }

    let data = null
    const contentType = response.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      try {
        data = await response.json()
      } catch {
        data = null
      }
    } else {
      try {
        const text = await response.text()
        data = text ? { message: text } : null
      } catch {
        data = null
      }
    }

    if (!response.ok) {
      const error = new Error((data && data.message) || `Request failed with status ${response.status}`)
      error.status = response.status
      error.data = data
      throw error
    }

    return data
  } catch (err) {
    if (
      err.name === "TypeError" ||
      err.message?.includes("fetch") ||
      err.message?.includes("NetworkError") ||
      err.message?.includes("Failed to fetch")
    ) {
      emitApiStatus(false)
    }
    throw err
  }
}
