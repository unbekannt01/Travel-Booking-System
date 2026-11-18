import { cva } from "class-variance-authority"

export const FOCUS_RING_CLASS =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 font-semibold rounded-[var(--yh-radius-md)]",
    "transition-colors duration-150 select-none cursor-pointer",
    "disabled:opacity-50 disabled:pointer-events-none",
    FOCUS_RING_CLASS,
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg hover:bg-brand-hover shadow-[var(--yh-shadow-xs)]",
        accent: "bg-accent-warm text-accent-warm-fg hover:bg-accent-warm-hover shadow-[var(--yh-shadow-xs)]",
        secondary: "bg-surface-muted text-ink border border-border-subtle hover:bg-surface-hover",
        outline: "bg-surface text-ink border border-border-strong hover:bg-surface-muted",
        ghost: "bg-transparent text-ink-secondary hover:bg-surface-muted hover:text-ink",
        danger: "bg-danger text-danger-fg hover:opacity-90 shadow-[var(--yh-shadow-xs)]",
        success: "bg-success text-success-fg hover:opacity-90 shadow-[var(--yh-shadow-xs)]",
      },
      size: {
        sm: "min-h-11 sm:min-h-8 px-3 text-xs",
        md: "min-h-11 sm:min-h-10 px-4 text-sm",
        lg: "min-h-12 px-5 text-base",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  },
)

export const iconButtonVariants = cva(
  [
    "inline-flex items-center justify-center rounded-[var(--yh-radius-md)] shrink-0",
    "transition-colors duration-150 select-none cursor-pointer",
    "disabled:opacity-50 disabled:pointer-events-none",
    FOCUS_RING_CLASS,
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-brand text-brand-fg hover:bg-brand-hover shadow-[var(--yh-shadow-xs)]",
        accent: "bg-accent-warm text-accent-warm-fg hover:bg-accent-warm-hover shadow-[var(--yh-shadow-xs)]",
        secondary: "bg-surface-muted text-ink border border-border-subtle hover:bg-surface-hover",
        outline: "bg-surface text-ink border border-border-strong hover:bg-surface-muted",
        ghost: "bg-transparent text-ink-secondary hover:bg-surface-muted hover:text-ink",
        danger: "bg-danger-soft text-danger-text border border-danger-border hover:bg-danger hover:text-danger-fg",
      },
      size: {
        sm: "min-h-11 min-w-11 sm:min-h-8 sm:min-w-8",
        md: "min-h-11 min-w-11 sm:min-h-10 sm:min-w-10",
        lg: "min-h-12 min-w-12",
      },
    },
    defaultVariants: {
      variant: "ghost",
      size: "md",
    },
  },
)

export const inputVariants = cva(
  [
    "w-full rounded-[var(--yh-radius-md)] bg-surface text-ink placeholder:text-ink-muted",
    "border transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
    "disabled:opacity-55 disabled:bg-surface-muted disabled:cursor-not-allowed",
  ].join(" "),
  {
    variants: {
      size: {
        sm: "min-h-11 sm:min-h-8 px-3 py-1.5 text-xs",
        md: "min-h-11 sm:min-h-10 px-3.5 py-2 text-sm",
        lg: "min-h-12 px-4 py-2.5 text-base",
      },
      invalid: {
        true: "border-danger focus-visible:ring-danger",
        false: "border-border-subtle hover:border-border-strong",
      },
    },
    defaultVariants: {
      size: "md",
      invalid: false,
    },
  },
)

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-semibold rounded-[var(--yh-radius-full)] border whitespace-nowrap leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-ink-secondary border-border-subtle",
        primary: "bg-brand-soft text-brand border-border-subtle",
        accent: "bg-accent-warm-soft text-accent-warm-text border-warning-border",
        success: "bg-success-soft text-success-text border-success-border",
        warning: "bg-warning-soft text-warning-text border-warning-border",
        danger: "bg-danger-soft text-danger-text border-danger-border",
        info: "bg-info-soft text-info-text border-info-border",
      },
      size: {
        sm: "px-2 py-1 text-[11px]",
        md: "px-2.5 py-1 text-xs",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  },
)

export const cardVariants = cva(
  "rounded-[var(--yh-radius-lg)] bg-surface text-ink border border-border-subtle transition-shadow duration-200",
  {
    variants: {
      elevation: {
        flat: "shadow-none",
        sm: "shadow-[var(--yh-shadow-xs)]",
        md: "shadow-[var(--yh-shadow-sm)]",
        lg: "shadow-[var(--yh-shadow-md)]",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        md: "p-5",
        lg: "p-6",
      },
      interactive: {
        true: "hover:shadow-[var(--yh-shadow-md)] hover:border-border-strong cursor-pointer",
        false: "",
      },
    },
    defaultVariants: {
      elevation: "sm",
      padding: "md",
      interactive: false,
    },
  },
)

/**
 * Canonical booking, payment, and boarding statuses with semantic badge tone and icon identifier.
 * Every status always pairs text with a distinct icon (never color alone).
 */
export const STATUS_META = Object.freeze({
  Confirmed: { label: "Confirmed", variant: "info", iconName: "CheckCircle2" },
  Cancelled: { label: "Cancelled", variant: "danger", iconName: "XCircle" },
  Paid: { label: "Paid", variant: "success", iconName: "BadgeCheck" },
  Partial: { label: "Partial", variant: "warning", iconName: "Clock" },
  Pending: { label: "Pending", variant: "accent", iconName: "AlertCircle" },
  Boarded: { label: "Boarded", variant: "primary", iconName: "UserCheck" },
})

/**
 * Resolves a status string (case-insensitive) into its STATUS_META descriptor.
 * @param {string} status
 * @returns {{ label: string, variant: string, iconName: string }}
 */
export function resolveStatusMeta(status) {
  if (!status || typeof status !== "string") {
    return { label: "Unknown", variant: "neutral", iconName: "AlertCircle" }
  }
  const normalized = status.trim().toLowerCase()
  for (const [key, meta] of Object.entries(STATUS_META)) {
    if (key.toLowerCase() === normalized) {
      return meta
    }
  }
  return { label: status.trim(), variant: "neutral", iconName: "AlertCircle" }
}

/**
 * Computes up to 2 uppercase initials from a person's name.
 * @param {string | null | undefined} name
 * @returns {string}
 */
export function getInitials(name) {
  if (!name || typeof name !== "string") return "?"
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_TONES = Object.freeze(["primary", "accent", "success", "info", "neutral"])

/**
 * Picks a deterministic semantic tone for an avatar based on name.
 * @param {string | null | undefined} name
 * @returns {"primary" | "accent" | "success" | "info" | "neutral"}
 */
export function getAvatarTone(name) {
  if (!name || typeof name !== "string") return "neutral"
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  }
  return AVATAR_TONES[hash % AVATAR_TONES.length]
}
