import {
  CheckCircle2,
  XCircle,
  BadgeCheck,
  Clock,
  AlertCircle,
  UserCheck,
} from "lucide-react"
import { Badge } from "./Badge"
import { resolveStatusMeta } from "./variants"

const ICON_MAP = {
  CheckCircle2,
  XCircle,
  BadgeCheck,
  Clock,
  AlertCircle,
  UserCheck,
}

/**
 * Domain status pill for Confirmed, Cancelled, Paid, Partial, Pending, and Boarded states.
 * Always displays both readable text and a distinct icon (never relies on color alone).
 * @param {{
 *   status: "Confirmed" | "Cancelled" | "Paid" | "Partial" | "Pending" | "Boarded" | string,
 *   size?: "sm" | "md",
 *   label?: string,
 *   className?: string,
 * }} props
 */
export function StatusPill({ status, size = "md", label, className }) {
  const meta = resolveStatusMeta(status)
  const Icon = ICON_MAP[meta.iconName] || AlertCircle
  const iconSize = size === "sm" ? 12 : 14

  return (
    <Badge
      variant={meta.variant}
      size={size}
      icon={<Icon size={iconSize} strokeWidth={2.25} />}
      className={className}
    >
      {label || meta.label}
    </Badge>
  )
}
