import {
  Badge,
  IconButton,
  Tooltip,
} from "../ui"
import { formatINR } from "../../../shared/cashbook"
import {
  Lock,
  Edit2,
  Trash2,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  UserCheck,
  SlidersHorizontal,
} from "lucide-react"

const TYPE_BADGE_CONFIG = {
  receipt: { label: "Receipt", variant: "success", icon: ArrowDownLeft },
  refund: { label: "Refund", variant: "danger", icon: ArrowUpRight },
  expense: { label: "Expense", variant: "warning", icon: ArrowUpRight },
  "transfer-to-bank": { label: "Transfer", variant: "primary", icon: RefreshCw },
  "transfer-to-cash": { label: "Transfer", variant: "primary", icon: RefreshCw },
  "owner-in": { label: "Capital In", variant: "neutral", icon: UserCheck },
  "owner-out": { label: "Drawings", variant: "danger", icon: UserCheck },
  adjustment: { label: "Adjustment", variant: "neutral", icon: SlidersHorizontal },
}

export default function DayBookTable({
  entries = [],
  opening = { cash: 0, bank: 0, total: 0 },
  totals = null,
  closing = { cash: 0, bank: 0, total: 0 },
  accountFilter = "all",
  lockDate = null,
  onEditEntry = null,
  onDeleteEntry = null,
  onViewHistory = null,
}) {
  const showCash = accountFilter === "all" || accountFilter === "cash"
  const showBank = accountFilter === "all" || accountFilter === "bank"

  return (
    <div
      role="region"
      aria-label="Day book table, scrollable"
      /* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- WCAG 2.1 SC 2.1.1: scrollable data region must be keyboard focusable */
      tabIndex={0}
      className="overflow-x-auto rounded-xl border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <table className="w-full border-collapse text-left text-xs" role="table">
        <thead className="bg-surface-subtle border-b border-border text-ink-muted">
          <tr>
            <th scope="col" className="p-3 font-semibold text-center w-12">#</th>
            <th scope="col" className="p-3 font-semibold w-24">Date</th>
            <th scope="col" className="p-3 font-semibold w-28">Voucher / Ref</th>
            <th scope="col" className="p-3 font-semibold">Particulars & Description</th>
            <th scope="col" className="p-3 font-semibold w-36">Party</th>
            <th scope="col" className="p-3 font-semibold text-center w-20">Account</th>
            <th scope="col" className="p-3 font-semibold text-right w-24 text-success">In (+)</th>
            <th scope="col" className="p-3 font-semibold text-right w-24 text-danger-text">Out (-)</th>
            {showCash && (
              <th scope="col" className="p-3 font-semibold text-right w-28 bg-slate-50 dark:bg-slate-900/40">
                Cash Bal
              </th>
            )}
            {showBank && (
              <th scope="col" className="p-3 font-semibold text-right w-28 bg-slate-50 dark:bg-slate-900/40">
                Bank Bal
              </th>
            )}
            {accountFilter === "all" && (
              <th scope="col" className="p-3 font-semibold text-right w-28 font-bold">
                Total Bal
              </th>
            )}
            <th scope="col" className="p-3 font-semibold text-center w-16">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {/* Opening Balance Row */}
          <tr className="bg-slate-50/80 dark:bg-slate-900/30 font-semibold text-ink">
            <td className="p-3 text-center text-ink-muted">—</td>
            <td className="p-3 text-ink-muted">Start</td>
            <td className="p-3 text-ink-muted">—</td>
            <td className="p-3" colSpan={2}>
              <span className="flex items-center gap-1.5 font-bold text-ink">
                <span>OPENING BALANCE</span>
              </span>
            </td>
            <td className="p-3 text-center text-ink-muted">All</td>
            <td className="p-3 text-right text-ink-muted">—</td>
            <td className="p-3 text-right text-ink-muted">—</td>
            {showCash && (
              <td className="p-3 text-right font-mono bg-slate-50 dark:bg-slate-900/40">
                {formatINR(opening.cash)}
              </td>
            )}
            {showBank && (
              <td className="p-3 text-right font-mono bg-slate-50 dark:bg-slate-900/40">
                {formatINR(opening.bank)}
              </td>
            )}
            {accountFilter === "all" && (
              <td className="p-3 text-right font-mono font-bold text-brand">
                {formatINR(opening.total)}
              </td>
            )}
            <td className="p-3 text-center text-ink-muted">—</td>
          </tr>

          {/* Transactions */}
          {entries.length === 0 ? (
            <tr>
              <td
                colSpan={accountFilter === "all" ? 12 : 11}
                className="p-8 text-center text-ink-muted"
              >
                No cash or bank transactions recorded for this period.
              </td>
            </tr>
          ) : (
            entries.map((entry, idx) => {
              const badgeCfg = TYPE_BADGE_CONFIG[entry.type] || {
                label: entry.type,
                variant: "neutral",
                icon: SlidersHorizontal,
              }
              const BadgeIcon = badgeCfg.icon
              const isManual = entry.sourceType === "CashEntry"
              const isLocked = Boolean(entry.isLocked)

              const cashDelta = entry.cashDelta || 0
              const bankDelta = entry.bankDelta || 0

              let inAmount = 0
              let outAmount = 0

              if (entry.account === "cash") {
                if (cashDelta > 0) inAmount = cashDelta
                else if (cashDelta < 0) outAmount = Math.abs(cashDelta)
              } else if (entry.account === "bank") {
                if (bankDelta > 0) inAmount = bankDelta
                else if (bankDelta < 0) outAmount = Math.abs(bankDelta)
              } else if (entry.type.startsWith("transfer-")) {
                // Transfers
                inAmount = Math.max(cashDelta, bankDelta)
                outAmount = Math.abs(Math.min(cashDelta, bankDelta))
              }

              return (
                <tr
                  key={entry.id || idx}
                  className={`hover:bg-surface-subtle transition-colors ${
                    isLocked ? "opacity-95" : ""
                  }`}
                >
                  <td className="p-3 text-center text-ink-muted">{idx + 1}</td>
                  <td className="p-3 whitespace-nowrap font-mono text-[11px] text-ink-muted">
                    {entry.date}
                  </td>
                  <td className="p-3 font-mono text-[11px] text-ink font-medium">
                    {entry.voucherNo || entry.invoiceNo || (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={badgeCfg.variant} size="sm" className="gap-1 shrink-0">
                        <BadgeIcon className="w-3 h-3" />
                        <span>{badgeCfg.label}</span>
                      </Badge>
                      <span className="text-ink font-medium line-clamp-1">
                        {entry.description}
                      </span>
                      {isLocked && (
                        <Tooltip content={`Locked: Books closed up to ${lockDate}`}>
                          <Lock className="w-3.5 h-3.5 text-ink-muted shrink-0" />
                        </Tooltip>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-ink-muted truncate max-w-[140px]">
                    {entry.partyName || "—"}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        entry.account === "cash"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                      }`}
                    >
                      {entry.account}
                    </span>
                  </td>
                  <td className="p-3 text-right font-mono text-success font-semibold">
                    {inAmount > 0 ? formatINR(inAmount) : "—"}
                  </td>
                  <td className="p-3 text-right font-mono text-danger-text font-semibold">
                    {outAmount > 0 ? formatINR(outAmount) : "—"}
                  </td>
                  {showCash && (
                    <td className="p-3 text-right font-mono font-medium bg-slate-50/50 dark:bg-slate-900/20 text-ink">
                      {formatINR(entry.cashBalance)}
                    </td>
                  )}
                  {showBank && (
                    <td className="p-3 text-right font-mono font-medium bg-slate-50/50 dark:bg-slate-900/20 text-ink">
                      {formatINR(entry.bankBalance)}
                    </td>
                  )}
                  {accountFilter === "all" && (
                    <td className="p-3 text-right font-mono font-bold text-ink">
                      {formatINR(entry.totalBalance)}
                    </td>
                  )}
                  <td className="p-3 text-center">
                    {isManual && !entry.isAutoAdjustment ? (
                      <div className="flex items-center justify-center gap-1">
                        {!isLocked && (
                          <Tooltip content="Edit entry">
                            <IconButton
                              size="sm"
                              variant="ghost"
                              onClick={() => onEditEntry && onEditEntry(entry)}
                              aria-label="Edit entry"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-ink-muted" />
                            </IconButton>
                          </Tooltip>
                        )}
                        <Tooltip content="View history">
                          <IconButton
                            size="sm"
                            variant="ghost"
                            onClick={() => onViewHistory && onViewHistory(entry)}
                            aria-label="View history"
                          >
                            <History className="w-3.5 h-3.5 text-ink-muted" />
                          </IconButton>
                        </Tooltip>
                        {!isLocked && (
                          <Tooltip content="Delete entry">
                            <IconButton
                              size="sm"
                              variant="ghost"
                              onClick={() => onDeleteEntry && onDeleteEntry(entry)}
                              aria-label="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-danger" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {isLocked && (
                          <span className="text-ink-muted text-[10px] ml-1">Locked</span>
                        )}
                      </div>
                    ) : isLocked ? (
                      <span className="text-ink-muted text-[10px]">Locked</span>
                    ) : (
                      <span className="text-ink-muted text-[10px]">Auto</span>
                    )}
                  </td>
                </tr>
              )
            })
          )}

          {/* Closing Balance Row */}
          <tr className="bg-slate-100 dark:bg-slate-900/60 font-bold text-ink border-t-2 border-border">
            <td className="p-3 text-center text-ink-muted">—</td>
            <td className="p-3 text-ink-muted">Close</td>
            <td className="p-3 text-ink-muted">—</td>
            <td className="p-3" colSpan={2}>
              <span>CLOSING BALANCE</span>
            </td>
            <td className="p-3 text-center text-ink-muted">All</td>
            <td className="p-3 text-right font-mono text-success">
              {totals ? formatINR(totals.receipts.total) : "—"}
            </td>
            <td className="p-3 text-right font-mono text-danger-text">
              {totals
                ? formatINR(totals.expenses.total + totals.refunds.total)
                : "—"}
            </td>
            {showCash && (
              <td className="p-3 text-right font-mono bg-slate-100 dark:bg-slate-900/60">
                {formatINR(closing.cash)}
              </td>
            )}
            {showBank && (
              <td className="p-3 text-right font-mono bg-slate-100 dark:bg-slate-900/60">
                {formatINR(closing.bank)}
              </td>
            )}
            {accountFilter === "all" && (
              <td className="p-3 text-right font-mono font-bold text-brand">
                {formatINR(closing.total)}
              </td>
            )}
            <td className="p-3 text-center text-ink-muted">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
