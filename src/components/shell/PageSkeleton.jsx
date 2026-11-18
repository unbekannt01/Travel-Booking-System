import { Skeleton } from "../ui"

/**
 * Page-shaped Suspense fallback built from the Design System v2 Skeleton primitive.
 * Matches header + KPI cards / form / table layout to minimize layout shift while lazy chunks load.
 * @param {{ variant?: "dashboard" | "table" | "form" | "analytics" | "settings" | "modal" }} props
 */
export function PageSkeleton({ variant = "dashboard" }) {
  if (variant === "modal") {
    return (
      <div
        role="status"
        aria-label="Loading dialog"
        className="fixed inset-0 z-[var(--yh-z-modal)] flex items-center justify-center bg-ink/30 backdrop-blur-[1px] p-4"
      >
        <div className="w-full max-w-md rounded-[var(--yh-radius-xl)] bg-surface border border-border-subtle p-6 space-y-4 shadow-[var(--yh-shadow-lg)]">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton shape="rect" className="h-24 w-full" />
          <div className="flex justify-end gap-2">
            <Skeleton shape="rect" className="h-10 w-24" />
            <Skeleton shape="rect" className="h-10 w-28" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div role="status" aria-label="Loading page content" className="space-y-6 animate-in">
      {/* Page heading placeholder */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2 flex-1 min-w-[200px]">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <Skeleton shape="rect" className="h-10 w-36" />
      </div>

      {/* KPI cards placeholder */}
      {(variant === "dashboard" || variant === "analytics") && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-[var(--yh-radius-lg)] bg-surface border border-border-subtle p-5 space-y-3"
            >
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>
      )}

      {/* Main body placeholder */}
      {variant === "form" || variant === "settings" ? (
        <div className="rounded-[var(--yh-radius-lg)] bg-surface border border-border-subtle p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton shape="rect" className="h-10 w-full" />
              </div>
            ))}
          </div>
          <Skeleton shape="rect" className="h-28 w-full" />
        </div>
      ) : (
        <div className="rounded-[var(--yh-radius-lg)] bg-surface border border-border-subtle p-5 space-y-3">
          <Skeleton className="h-5 w-44" />
          <div className="space-y-2.5 pt-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} shape="rect" className="h-12 w-full" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
