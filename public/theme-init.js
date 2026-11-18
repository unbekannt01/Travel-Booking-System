/* Pre-paint theme initializer — served from 'self' to prevent theme FOUC without CSP unsafe-inline */
(function () {
  var STORAGE_KEY = "yatrahub-theme"
  var preference = "system"
  try {
    var stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark" || stored === "system") {
      preference = stored
    }
  } catch {
    // Storage unavailable (private mode or policy); fall back to system
  }

  var prefersDark = false
  try {
    prefersDark = Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches)
  } catch {
    prefersDark = false
  }

  var effective = preference === "system" ? (prefersDark ? "dark" : "light") : preference
  var root = document.documentElement
  root.dataset.theme = effective
  root.classList.toggle("dark", effective === "dark")
  root.style.colorScheme = effective
})()
