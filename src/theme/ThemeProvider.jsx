import { useState, useEffect, useCallback, useMemo } from "react"
import { ThemeContext } from "./themeContext"
import {
  readStoredTheme,
  writeStoredTheme,
  resolveEffectiveTheme,
  applyThemeToDocument,
  getSystemPrefersDark,
  isValidThemeMode,
} from "./themeStorage"

/**
 * Provides light/dark/system theme state synchronized with document root and localStorage.
 * @param {{ children: import("react").ReactNode }} props
 */
export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => readStoredTheme())
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => getSystemPrefersDark())

  const resolvedTheme = resolveEffectiveTheme(theme, systemPrefersDark)

  useEffect(() => {
    applyThemeToDocument(theme, document, systemPrefersDark)
  }, [theme, systemPrefersDark])

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    let mql
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)")
    } catch {
      return
    }
    const handleChange = (event) => {
      setSystemPrefersDark(Boolean(event.matches))
    }
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", handleChange)
      return () => mql.removeEventListener("change", handleChange)
    }
    if (typeof mql.addListener === "function") {
      mql.addListener(handleChange)
      return () => mql.removeListener(handleChange)
    }
  }, [])

  const setTheme = useCallback((nextMode) => {
    if (!isValidThemeMode(nextMode)) return
    setThemeState(nextMode)
    writeStoredTheme(nextMode)
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const currentEffective = resolveEffectiveTheme(current, systemPrefersDark)
      const next = currentEffective === "dark" ? "light" : "dark"
      writeStoredTheme(next)
      return next
    })
  }, [systemPrefersDark])

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
      toggleTheme,
    }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
