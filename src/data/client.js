import { API_URL } from "../config"

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
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers,
  })

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
}
