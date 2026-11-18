import { useEffect, useRef } from "react"

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(",")

/**
 * Traps keyboard focus inside containerRef while open, closes on Escape,
 * locks document body scroll, and restores focus to the previously focused element on close.
 * @param {{ isOpen: boolean, containerRef: import("react").RefObject<HTMLElement | null>, onClose?: () => void, closeOnEscape?: boolean }} params
 */
export function useFocusTrap({ isOpen, containerRef, onClose, closeOnEscape = true }) {
  const previousActiveElementRef = useRef(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const container = containerRef.current
    if (container) {
      const focusables = container.querySelectorAll(FOCUSABLE_SELECTOR)
      if (focusables.length > 0) {
        focusables[0].focus()
      } else {
        container.focus()
      }
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.stopPropagation()
        if (onCloseRef.current) onCloseRef.current()
        return
      }

      if (event.key !== "Tab" || !containerRef.current) return
      const focusables = Array.from(containerRef.current.querySelectorAll(FOCUSABLE_SELECTOR))
      if (focusables.length === 0) {
        event.preventDefault()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey) {
        if (document.activeElement === first || !containerRef.current.contains(document.activeElement)) {
          event.preventDefault()
          last.focus()
        }
      } else if (document.activeElement === last || !containerRef.current.contains(document.activeElement)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === "function") {
        previousActiveElementRef.current.focus()
      }
    }
  }, [isOpen, containerRef, closeOnEscape])
}
