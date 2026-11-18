/**
 * Theme persistence and resolution utilities.
 * All storage calls are wrapped in try/catch so the app works even when
 * localStorage is disabled, full, or blocked by browser privacy policies.
 */

export const THEME_STORAGE_KEY = "yatrahub-theme"
export const THEME_MODES = Object.freeze(["system", "light", "dark"])

/**
 * Checks whether a value is a supported theme preference.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidThemeMode(value) {
  return value === "system" || value === "light" || value === "dark"
}

/**
 * Safely reads the stored theme preference from storage.
 * Falls back to "system" if missing, invalid, or storage throws.
 * @param {Pick<Storage, "getItem"> | null | undefined} [storage]
 * @returns {"system" | "light" | "dark"}
 */
export function readStoredTheme(storage) {
  const store = storage === undefined ? getDefaultStorage() : storage
  if (!store || typeof store.getItem !== "function") {
    return "system"
  }
  try {
    const raw = store.getItem(THEME_STORAGE_KEY)
    return isValidThemeMode(raw) ? raw : "system"
  } catch {
    return "system"
  }
}

/**
 * Safely persists the user's theme preference to storage.
 * Never throws if storage is unavailable or quota is exceeded.
 * @param {"system" | "light" | "dark"} mode
 * @param {Pick<Storage, "setItem"> | null | undefined} [storage]
 * @returns {boolean} true if saved, false otherwise
 */
export function writeStoredTheme(mode, storage) {
  if (!isValidThemeMode(mode)) return false
  const store = storage === undefined ? getDefaultStorage() : storage
  if (!store || typeof store.setItem !== "function") {
    return false
  }
  try {
    store.setItem(THEME_STORAGE_KEY, mode)
    return true
  } catch {
    return false
  }
}

/**
 * Resolves a preference ("system" | "light" | "dark") to the effective theme ("light" | "dark").
 * @param {"system" | "light" | "dark" | string} preference
 * @param {boolean} [prefersDark=false]
 * @returns {"light" | "dark"}
 */
export function resolveEffectiveTheme(preference, prefersDark = false) {
  if (preference === "dark") return "dark"
  if (preference === "light") return "light"
  return prefersDark ? "dark" : "light"
}

/**
 * Applies the resolved theme to a document's root element (`data-theme`, `.dark` class, `colorScheme`).
 * @param {"system" | "light" | "dark"} preference
 * @param {Document | null | undefined} [doc]
 * @param {boolean} [prefersDark=false]
 * @returns {"light" | "dark"}
 */
export function applyThemeToDocument(preference, doc, prefersDark = false) {
  const effective = resolveEffectiveTheme(preference, prefersDark)
  const targetDoc = doc === undefined ? (typeof document !== "undefined" ? document : null) : doc
  const root = targetDoc?.documentElement
  if (root) {
    if (root.dataset) {
      root.dataset.theme = effective
    }
    if (root.classList && typeof root.classList.toggle === "function") {
      root.classList.toggle("dark", effective === "dark")
    }
    if (root.style) {
      root.style.colorScheme = effective
    }
  }
  return effective
}

/**
 * Safely queries OS dark-mode preference.
 * @returns {boolean}
 */
export function getSystemPrefersDark() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false
  }
  try {
    return Boolean(window.matchMedia("(prefers-color-scheme: dark)").matches)
  } catch {
    return false
  }
}

function getDefaultStorage() {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}
