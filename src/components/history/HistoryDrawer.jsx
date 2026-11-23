import { useState, useEffect, useCallback } from "react"
import { Drawer, Badge, Spinner } from "../ui"
import { RateLimitNotice } from "../common/RateLimitNotice"
import { getRecordHistory } from "../../data/history"
import { summarizeChanges, HISTORY_LABELS } from "../../../shared/history.js"
import { History, Calendar, User, Clock, ArrowRight } from "lucide-react"

const ACTION_BADGES = {
  created: { variant: "success", labelKey: "created" },
  updated: { variant: "warning", labelKey: "updated" },
  deleted: { variant: "danger", labelKey: "deleted" },
  restored: { variant: "info", labelKey: "restored" },
  cancelled: { variant: "danger", labelKey: "cancelled" },
}

/**
 * Accessible history timeline slide-over drawer.
 * Displays audit log and change diffs without personal data.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   entityType: "booking"|"expense"|"customer"|"cashEntry",
 *   entityId: string|null,
 *   title?: string,
 * }} props
 */
export default function HistoryDrawer({
  isOpen,
  onClose,
  entityType,
  entityId,
  title = "Edit & Change History",
}) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [rateLimitRetry, setRateLimitRetry] = useState(null)
  const [language, setLanguage] = useState("en")

  const loadHistory = useCallback(async () => {
    if (!entityType || !entityId) return
    setLoading(true)
    setRateLimitRetry(null)
    try {
      const res = await getRecordHistory({ entityType, entityId })
      setHistory(Array.isArray(res?.history) ? res.history : [])
    } catch (err) {
      if (err.status === 429) {
        setRateLimitRetry(60)
      } else {
        console.error("Failed to fetch history:", err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [entityType, entityId])

  useEffect(() => {
    if (isOpen && entityId) {
      loadHistory()
    } else {
      setHistory([])
      setRateLimitRetry(null)
    }
  }, [isOpen, entityId, loadHistory])

  const dict = HISTORY_LABELS[language] || HISTORY_LABELS.en

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-[var(--yh-color-primary)]" aria-hidden="true" />
          <span>{title}</span>
        </div>
      }
      description="Audit timeline of operations and field changes."
      side="right"
      className="max-w-md w-full"
    >
      <div className="space-y-4">
        {/* Language selector toggle */}
        <div className="flex items-center justify-between border-b border-[var(--yh-border-default)] pb-3">
          <span className="text-xs font-medium text-[var(--yh-text-secondary)]">Language / भाषा / ભાષા:</span>
          <div className="flex gap-1" role="group" aria-label="Summary language selection">
            {["en", "hi", "gu"].map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setLanguage(lang)}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  language === lang
                    ? "bg-[var(--yh-color-primary)] text-white font-medium"
                    : "bg-[var(--yh-bg-muted)] text-[var(--yh-text-secondary)] hover:text-[var(--yh-text-primary)]"
                }`}
              >
                {lang === "en" ? "EN" : lang === "hi" ? "हिन्दी" : "ગુજરાતી"}
              </button>
            ))}
          </div>
        </div>

        {rateLimitRetry && (
          <RateLimitNotice retryAfterSeconds={rateLimitRetry} onRetry={loadHistory} />
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Spinner size="md" />
            <p className="text-xs text-[var(--yh-text-secondary)]">Loading change timeline...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-12 text-[var(--yh-text-secondary)] text-sm">
            <History className="h-8 w-8 mx-auto mb-2 opacity-40" aria-hidden="true" />
            <p>No change events recorded for this item yet.</p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--yh-border-default)]">
            {history.map((item, idx) => {
              const badgeCfg = ACTION_BADGES[item.action] || { variant: "default", labelKey: item.action }
              const actionLabel = dict.actions[badgeCfg.labelKey] || item.action
              const changeSummaries = summarizeChanges(item.changes || [], language)
              const eventDate = new Date(item.at)

              return (
                <div key={item._id || idx} className="relative group">
                  {/* Timeline dot */}
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-[var(--yh-bg-surface)] bg-[var(--yh-color-primary)] shadow-sm" />

                  <div className="bg-[var(--yh-bg-subtle)] border border-[var(--yh-border-default)] rounded-[var(--yh-radius-md)] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={badgeCfg.variant} size="sm">
                        {actionLabel}
                      </Badge>
                      <span className="text-xs text-[var(--yh-text-secondary)] flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden="true" />
                        {eventDate.toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}{" "}
                        {eventDate.toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="text-xs text-[var(--yh-text-secondary)] flex items-center gap-1.5">
                      <User className="h-3 w-3 opacity-60" aria-hidden="true" />
                      <span>{item.by?.name || "Operator"}</span>
                    </div>

                    {/* Change list */}
                    {changeSummaries.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-[var(--yh-border-subtle)] space-y-1">
                        <div className="text-[11px] font-semibold text-[var(--yh-text-muted)] uppercase tracking-wider">
                          Modifications
                        </div>
                        <ul className="space-y-1 text-xs text-[var(--yh-text-primary)]">
                          {changeSummaries.map((summary, sIdx) => (
                            <li key={sIdx} className="flex items-start gap-1.5">
                              <ArrowRight className="h-3 w-3 mt-0.5 text-[var(--yh-color-primary)] shrink-0" aria-hidden="true" />
                              <span>{summary}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Drawer>
  )
}
