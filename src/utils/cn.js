import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merges conditional class names cleanly with Tailwind conflict resolution.
 * @param {...import("clsx").ClassValue} inputs
 * @returns {string}
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
