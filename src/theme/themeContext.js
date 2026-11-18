import { createContext, useContext } from "react"

export const ThemeContext = createContext(null)

/**
 * Access current theme preference ("system" | "light" | "dark"),
 * resolvedTheme ("light" | "dark"), setTheme, and toggleTheme.
 */
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return ctx
}
