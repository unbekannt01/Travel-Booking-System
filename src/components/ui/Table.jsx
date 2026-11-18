import { cn } from "../../utils/cn"

/**
 * Horizontally scrollable responsive table wrapper with optional sticky header support.
 * @param {import("react").TableHTMLAttributes<HTMLTableElement> & {
 *   containerClassName?: string,
 *   ariaLabel?: string,
 *   stickyHeader?: boolean,
 * }} props
 */
export function Table({ containerClassName, ariaLabel, stickyHeader = true, className, children, ...rest }) {
  return (
    <div
      role="region"
      aria-label={ariaLabel || "Data table"}
      tabIndex={0}
      className={cn(
        "w-full overflow-x-auto rounded-[var(--yh-radius-lg)] border border-border-subtle bg-surface",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        containerClassName,
      )}
    >
      <table
        className={cn(
          "w-full border-collapse text-left text-sm text-ink",
          stickyHeader && "[&_thead_th]:sticky [&_thead_th]:top-0 [&_thead_th]:z-[var(--yh-z-sticky)]",
          className,
        )}
        {...rest}
      >
        {children}
      </table>
    </div>
  )
}

/**
 * Table header section.
 * @param {import("react").HTMLAttributes<HTMLTableSectionElement>} props
 */
export function TableHeader({ className, children, ...rest }) {
  return (
    <thead className={cn("bg-surface-muted border-b border-border-subtle", className)} {...rest}>
      {children}
    </thead>
  )
}

/**
 * Table body section.
 * @param {import("react").HTMLAttributes<HTMLTableSectionElement>} props
 */
export function TableBody({ className, children, ...rest }) {
  return (
    <tbody className={cn("divide-y divide-border-subtle", className)} {...rest}>
      {children}
    </tbody>
  )
}

/**
 * Table row with subtle hover surface tint.
 * @param {import("react").HTMLAttributes<HTMLTableRowElement>} props
 */
export function TableRow({ className, children, ...rest }) {
  return (
    <tr className={cn("transition-colors duration-150 hover:bg-surface-hover/50", className)} {...rest}>
      {children}
    </tr>
  )
}

/**
 * Table header cell.
 * @param {import("react").ThHTMLAttributes<HTMLTableCellElement> & { align?: "left" | "center" | "right" }} props
 */
export function TableHead({ align = "left", className, children, ...rest }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wider text-ink-muted bg-surface-muted whitespace-nowrap",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

/**
 * Table body cell with optional tabular-nums alignment for currency/seat data.
 * @param {import("react").TdHTMLAttributes<HTMLTableCellElement> & {
 *   align?: "left" | "center" | "right",
 *   tabular?: boolean,
 * }} props
 */
export function TableCell({ align = "left", tabular = false, className, children, ...rest }) {
  return (
    <td
      className={cn(
        "px-4 py-3 text-sm text-ink align-middle",
        align === "right" && "text-right",
        align === "center" && "text-center",
        tabular && "tabular-nums",
        className,
      )}
      {...rest}
    >
      {children}
    </td>
  )
}

/**
 * Accessible table caption.
 * @param {import("react").HTMLAttributes<HTMLTableCaptionElement>} props
 */
export function TableCaption({ className, children, ...rest }) {
  return (
    <caption className={cn("px-4 py-2 text-xs text-ink-muted text-left", className)} {...rest}>
      {children}
    </caption>
  )
}
