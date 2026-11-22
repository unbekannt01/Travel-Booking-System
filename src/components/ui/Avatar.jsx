import { useState } from "react"
import { cn } from "../../utils/cn"
import { getInitials, getAvatarTone } from "./variants"

const SIZE_CLASSES = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-12 w-12 text-base",
}

const TONE_CLASSES = {
  primary: "bg-brand-soft text-brand border-border-subtle",
  accent: "bg-accent-warm-soft text-accent-warm-text border-warning-border",
  success: "bg-success-soft text-success-text border-success-border",
  info: "bg-info-soft text-info-text border-info-border",
  neutral: "bg-surface-muted text-ink-secondary border-border-subtle",
}

/**
 * User/passenger avatar showing an image with graceful fallback to 2-letter initials.
 * @param {{
 *   name?: string,
 *   src?: string,
 *   alt?: string,
 *   size?: "sm" | "md" | "lg",
 *   tone?: "primary" | "accent" | "success" | "info" | "neutral",
 *   className?: string,
 *   "aria-hidden"?: boolean | "true" | "false",
 * }} props
 */
export function Avatar({
  name = "",
  src,
  alt,
  size = "md",
  tone,
  className,
  "aria-hidden": ariaHidden,
  ...rest
}) {
  const [imgFailed, setImgFailed] = useState(false)
  const resolvedTone = tone || getAvatarTone(name)
  const initials = getInitials(name)
  const accessibleLabel = alt || name || "Avatar"

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt={ariaHidden ? "" : accessibleLabel}
        aria-hidden={ariaHidden}
        onError={() => setImgFailed(true)}
        className={cn(
          "inline-block shrink-0 rounded-full object-cover border border-border-subtle",
          SIZE_CLASSES[size] || SIZE_CLASSES.md,
          className,
        )}
        {...rest}
      />
    )
  }

  return (
    <span
      role={ariaHidden ? undefined : "img"}
      aria-label={ariaHidden ? undefined : accessibleLabel}
      aria-hidden={ariaHidden}
      data-initials={initials}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border font-bold select-none",
        SIZE_CLASSES[size] || SIZE_CLASSES.md,
        TONE_CLASSES[resolvedTone] || TONE_CLASSES.neutral,
        ariaHidden && "before:content-[attr(data-initials)]",
        className,
      )}
      {...rest}
    >
      {ariaHidden ? null : initials}
    </span>
  )
}
