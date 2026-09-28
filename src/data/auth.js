import { request, setAuthToken, removeAuthToken } from "./client"

export async function login(loginIdentifier, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ loginIdentifier, password }),
  })
  if (data.token) {
    setAuthToken(data.token)
    if (data.tokenId) localStorage.setItem("tokenId", data.tokenId)
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user))
  }
  return data
}

export async function register(userName, email, password) {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ userName, email, password }),
  })
  if (data.token) {
    setAuthToken(data.token)
    if (data.tokenId) localStorage.setItem("tokenId", data.tokenId)
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user))
  }
  return data
}

export async function logout() {
  try {
    await request("/api/auth/logout", {
      method: "POST",
    })
  } catch {
    // Continue local cleanup even if network request fails
  } finally {
    removeAuthToken()
    localStorage.removeItem("user")
  }
}

export async function updateProfile(userName) {
  const data = await request("/api/auth/update-profile", {
    method: "PUT",
    body: JSON.stringify({ userName }),
  })
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user))
  }
  return data
}

export async function updateCompany(companySettings) {
  const data = await request("/api/auth/update-company", {
    method: "PUT",
    body: JSON.stringify(companySettings),
  })
  if (data.user) {
    localStorage.setItem("user", JSON.stringify(data.user))
  }
  return data
}

export async function setup2FA(tokenOverride) {
  const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : {}
  return request("/api/auth/setup-2fa", {
    method: "POST",
    headers,
  })
}

export async function verify2FASetup(code, tokenOverride) {
  const headers = tokenOverride ? { Authorization: `Bearer ${tokenOverride}` } : {}
  return request("/api/auth/verify-2fa-setup", {
    method: "POST",
    headers,
    body: JSON.stringify({ code }),
  })
}

export async function verify2FALogin(tempToken, code) {
  const data = await request("/api/auth/verify-2fa-login", {
    method: "POST",
    body: JSON.stringify({ tempToken, code }),
  })
  if (data.token) {
    setAuthToken(data.token)
    if (data.tokenId) localStorage.setItem("tokenId", data.tokenId)
    if (data.user) localStorage.setItem("user", JSON.stringify(data.user))
  }
  return data
}

export async function disable2FA(code) {
  return request("/api/auth/disable-2fa", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
}

export async function forgotPassword(email) {
  return request("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function validateResetToken(token) {
  return request(`/api/auth/validate-reset-token/${token}`)
}

export async function resetPassword(token, newPassword) {
  return request("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, newPassword }),
  })
}

export async function request2FARecovery(email) {
  return request("/api/auth/request-2fa-recovery", {
    method: "POST",
    body: JSON.stringify({ email }),
  })
}

export async function validate2FAToken(token) {
  return request(`/api/auth/validate-2fa-token/${token}`)
}

export async function finalize2FARecovery(token) {
  return request("/api/auth/finalize-2fa-recovery", {
    method: "POST",
    body: JSON.stringify({ token }),
  })
}
