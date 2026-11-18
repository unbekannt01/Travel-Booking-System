import { useState } from "react"
import {
  Sun,
  Moon,
  Monitor,
  Plus,
  Download,
  Trash2,
  Edit3,
  Printer,
  Bus,
  IndianRupee,
  Users,
  CheckCircle2,
  Inbox,
  ArrowLeft,
  Info,
} from "lucide-react"
import { useTheme } from "../theme"
import { useToast } from "../components/common/ToastContext"
import { useConfirm } from "../components/common/ConfirmModalContext"
import { formatINR } from "../utils/formatters"
import {
  Button,
  IconButton,
  Input,
  Select,
  Textarea,
  Checkbox,
  Switch,
  Field,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Badge,
  StatusPill,
  Modal,
  Drawer,
  Tabs,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Tooltip,
  Skeleton,
  EmptyState,
  Spinner,
  StatCard,
  PageHeader,
  SearchInput,
  Avatar,
  Toast,
} from "../components/ui"

const UI_KIT_SENTINEL = "YATRAHUB_DEV_UI_KIT_SENTINEL_3_1"

const SAMPLE_ROWS = [
  {
    invoice: "YHB-KED-NOV-001",
    customer: "Rameshbhai Patel",
    seat: "L1, L2",
    amount: 14500,
    paid: 14500,
    bookingStatus: "Confirmed",
    paymentStatus: "Paid",
  },
  {
    invoice: "YHB-KED-NOV-002",
    customer: "Sunita Deshmukh",
    seat: "U4",
    amount: 7250,
    paid: 3000,
    bookingStatus: "Boarded",
    paymentStatus: "Partial",
  },
  {
    invoice: "YHB-SOM-NOV-003",
    customer: "Harish Kumar Sharma",
    seat: "L5, L6",
    amount: 12000,
    paid: 0,
    bookingStatus: "Confirmed",
    paymentStatus: "Pending",
  },
  {
    invoice: "YHB-SOM-NOV-004",
    customer: "Meena Ben Shah",
    seat: "U2",
    amount: 6000,
    paid: 1000,
    bookingStatus: "Cancelled",
    paymentStatus: "Partial",
  },
]

const SWATCHES = [
  { name: "Brand (Deep Indigo)", cls: "bg-brand text-brand-fg" },
  { name: "Accent (Saffron)", cls: "bg-accent-warm text-accent-warm-fg" },
  { name: "Canvas", cls: "bg-canvas text-ink border border-border-subtle" },
  { name: "Surface", cls: "bg-surface text-ink border border-border-subtle" },
  { name: "Surface Muted", cls: "bg-surface-muted text-ink border border-border-subtle" },
  { name: "Success Soft", cls: "bg-success-soft text-success-text border border-success-border" },
  { name: "Warning Soft", cls: "bg-warning-soft text-warning-text border border-warning-border" },
  { name: "Danger Soft", cls: "bg-danger-soft text-danger-text border border-danger-border" },
  { name: "Info Soft", cls: "bg-info-soft text-info-text border border-info-border" },
]

/**
 * Dev-only UI Kit showcase (`#/ui-kit`) displaying every Design System v2 primitive in Light & Dark themes.
 * Never included in production bundles (`import.meta.env.DEV` guard).
 */
export default function UiKitPage() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const { toast } = useToast()
  const confirm = useConfirm()

  const [search, setSearch] = useState("")
  const [checkedA, setCheckedA] = useState(true)
  const [checkedB, setCheckedB] = useState(false)
  const [gstInclusive, setGstInclusive] = useState(true)
  const [smsAlerts, setSmsAlerts] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerSide, setDrawerSide] = useState("right")

  const filteredRows = SAMPLE_ROWS.filter(
    (r) =>
      !search.trim() ||
      r.customer.toLowerCase().includes(search.toLowerCase()) ||
      r.invoice.toLowerCase().includes(search.toLowerCase()),
  )

  const handleOpenConfirm = async (isDestructive) => {
    const ok = await confirm({
      title: isDestructive ? "Cancel Booking YHB-KED-NOV-001?" : "Mark All Passengers Boarded?",
      message: isDestructive
        ? "This will release seats L1 and L2 back into available inventory."
        : "All 32 confirmed passengers on Kedarnath Express will be marked as boarded.",
      confirmText: isDestructive ? "Cancel Booking" : "Board All",
      cancelText: "Keep As Is",
      isDestructive,
    })
    toast.info(ok ? "Action confirmed via ConfirmDialog" : "Action cancelled")
  }

  return (
    <div
      data-ui-kit={UI_KIT_SENTINEL}
      className="min-h-screen bg-canvas text-ink transition-colors duration-200"
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-[var(--yh-z-sticky)] bg-surface/95 backdrop-blur border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<ArrowLeft size={16} />}
              onClick={() => {
                window.location.hash = ""
              }}
            >
              Back to App
            </Button>
            <div className="h-5 w-px bg-border-subtle" aria-hidden="true" />
            <div>
              <span className="text-sm font-bold text-ink">YatraHub UI Kit</span>
              <Badge variant="accent" size="sm" className="ml-2">
                DEV ONLY • {resolvedTheme.toUpperCase()}
              </Badge>
            </div>
          </div>

          <div
            role="group"
            aria-label="Theme mode switcher"
            className="inline-flex items-center gap-1 p-1 rounded-[var(--yh-radius-md)] bg-surface-muted border border-border-subtle"
          >
            <Button
              variant={theme === "light" ? "primary" : "ghost"}
              size="sm"
              leftIcon={<Sun size={14} />}
              onClick={() => setTheme("light")}
            >
              Light
            </Button>
            <Button
              variant={theme === "dark" ? "primary" : "ghost"}
              size="sm"
              leftIcon={<Moon size={14} />}
              onClick={() => setTheme("dark")}
            >
              Dark
            </Button>
            <Button
              variant={theme === "system" ? "primary" : "ghost"}
              size="sm"
              leftIcon={<Monitor size={14} />}
              onClick={() => setTheme("system")}
            >
              System
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* PageHeader */}
        <PageHeader
          eyebrow="Design System v2 — Part 3.1"
          title="YatraHub Tokens & Accessible UI Primitives"
          subtitle="Warm Indian travel identity (Deep Indigo + Saffron Accent), offline self-hosted Inter + Noto Sans Devanagari/Gujarati, WCAG AA in Light & Dark."
          actions={
            <>
              <Button variant="secondary" leftIcon={<Download size={16} />} onClick={() => toast.info("Sample export triggered")}>
                Export Manifest
              </Button>
              <Button variant="accent" leftIcon={<Plus size={16} />} onClick={() => setModalOpen(true)}>
                New Booking
              </Button>
            </>
          }
        />

        {/* 1. Palette & Typography */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ink">1. Color Tokens & Multi-Script Typography</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {SWATCHES.map((s) => (
              <div
                key={s.name}
                className={`rounded-[var(--yh-radius-md)] px-3.5 py-4 text-xs font-semibold shadow-[var(--yh-shadow-xs)] ${s.cls}`}
              >
                {s.name}
              </div>
            ))}
          </div>

          <Card>
            <div className="grid sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">English (Inter Variable)</p>
                <p className="text-lg font-bold text-ink mt-1">Kedarnath Express — AC Sleeper</p>
                <p className="text-sm text-ink-secondary mt-1">Departure 21:30 from Ahmedabad Paldi</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Hindi (Noto Sans Devanagari)</p>
                <p className="text-lg font-bold text-ink mt-1">यात्रा हब — केदारनाथ यात्रा</p>
                <p className="text-sm text-ink-secondary mt-1">बोर्डिंग पास • कुल यात्री • शुभ यात्रा</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Gujarati (Noto Sans Gujarati)</p>
                <p className="text-lg font-bold text-ink mt-1">યાત્રા હબ — સોમનાથ યાત્રા</p>
                <p className="text-sm text-ink-secondary mt-1">બોર્ડિંગ પાસ • કુલ મુસાફર • સુખદ યાત્રા</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-border-subtle flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-ink-muted">Integer INR: </span>
                <strong className="tabular-nums text-ink">{formatINR(485200, 0)}</strong>
              </div>
              <div>
                <span className="text-ink-muted">Decimal INR: </span>
                <strong className="tabular-nums text-ink">{formatINR(123456.5, 2)}</strong>
              </div>
              <div>
                <span className="text-ink-muted">Refund INR: </span>
                <strong className="tabular-nums text-danger-text">{formatINR(-3500, 2)}</strong>
              </div>
            </div>
          </Card>
        </section>

        {/* 2. StatCards */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ink">2. KPI Stat Cards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Collections"
              value={formatINR(485200, 0)}
              hint="+12% vs last departure week"
              icon={<IndianRupee size={20} />}
              tone="brand"
            />
            <StatCard
              label="Pending Dues"
              value={formatINR(42500, 0)}
              hint="7 bookings awaiting balance"
              icon={<Bus size={20} />}
              tone="accent"
            />
            <StatCard
              label="Coach Occupancy"
              value="36 / 40"
              hint="4 berths still open"
              icon={<Users size={20} />}
              tone="info"
            />
            <StatCard
              label="Boarded Today"
              value="92%"
              hint="33 of 36 passengers checked in"
              icon={<CheckCircle2 size={20} />}
              tone="success"
            />
          </div>
        </section>

        {/* 3. Buttons & IconButtons */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ink">3. Buttons, IconButtons & Tooltips</h2>
          <Card className="space-y-5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="primary">Primary</Button>
              <Button variant="accent">Accent CTA</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="success">Success</Button>
              <Button variant="danger">Danger</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button loading loadingText="Saving...">
                Save
              </Button>
              <Button disabled>Disabled</Button>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Tooltip content="Print boarding pass">
                <IconButton aria-label="Print boarding pass" variant="secondary">
                  <Printer size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip content="Edit booking">
                <IconButton aria-label="Edit booking" variant="outline">
                  <Edit3 size={16} />
                </IconButton>
              </Tooltip>
              <Tooltip content="Delete booking">
                <IconButton aria-label="Delete booking" variant="danger">
                  <Trash2 size={16} />
                </IconButton>
              </Tooltip>
              <IconButton aria-label="Loading action" variant="primary" loading>
                <Plus size={16} />
              </IconButton>
              <IconButton aria-label="Disabled icon button" variant="secondary" disabled>
                <Info size={16} />
              </IconButton>
            </div>
          </Card>
        </section>

        {/* 4. Badges, StatusPills & Avatars */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ink">4. Badges, StatusPills & Avatars</h2>
          <Card className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="neutral">Neutral</Badge>
              <Badge variant="primary">Primary</Badge>
              <Badge variant="accent">Saffron Accent</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="info">Info</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status="Confirmed" />
              <StatusPill status="Paid" />
              <StatusPill status="Partial" />
              <StatusPill status="Pending" />
              <StatusPill status="Boarded" />
              <StatusPill status="Cancelled" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Avatar name="Rameshbhai Patel" size="sm" />
              <Avatar name="Sunita Deshmukh" size="md" />
              <Avatar name="Harish Kumar Sharma" size="lg" />
              <Avatar name="YatraHub" size="md" tone="accent" />
            </div>
          </Card>
        </section>

        {/* 5. Form Controls */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ink">5. Form Controls & Field Wrapper</h2>
          <Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Passenger Full Name" required hint="As printed on Aadhaar or Voter ID">
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    placeholder="e.g. Rameshbhai Patel"
                  />
                )}
              </Field>

              <Field label="Mobile Number" required error="Enter a valid 10-digit Indian mobile number">
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    tabular
                    defaultValue="98765"
                  />
                )}
              </Field>

              <Field label="Coach Layout">
                {({ id }) => (
                  <Select id={id} defaultValue="2x1">
                    <option value="2x1">2x1 AC Sleeper (36 Berths)</option>
                    <option value="2x2">2x2 AC Sleeper (40 Berths)</option>
                  </Select>
                )}
              </Field>

              <Field label="Disabled Input">
                {({ id }) => <Input id={id} value="YHB-KED-NOV-001" tabular disabled />}
              </Field>

              <Field label="Boarding Notes" className="md:col-span-2">
                {({ id }) => (
                  <Textarea
                    id={id}
                    placeholder="Pickup point instructions or elder-berth requests..."
                  />
                )}
              </Field>
            </div>

            <div className="mt-5 pt-5 border-t border-border-subtle grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Checkbox
                  label="Include 5% GST invoice breakdown"
                  description="Splits tax into 2.5% CGST and 2.5% SGST"
                  checked={checkedA}
                  onChange={(e) => setCheckedA(e.target.checked)}
                />
                <Checkbox
                  label="Indeterminate batch selection"
                  indeterminate
                  checked={checkedB}
                  onChange={(e) => setCheckedB(e.target.checked)}
                />
                <Checkbox label="Disabled checkbox option" disabled />
              </div>

              <div className="space-y-3">
                <Switch
                  label="Tax-inclusive package fare"
                  description="Total ticket price already includes GST"
                  checked={gstInclusive}
                  onCheckedChange={setGstInclusive}
                />
                <Switch
                  label="Auto-open print preview"
                  checked={smsAlerts}
                  onCheckedChange={setSmsAlerts}
                />
                <Switch label="Disabled switch" checked={false} disabled />
              </div>
            </div>
          </Card>
        </section>

        {/* 6. Tabs, Table, SearchInput, EmptyState, Skeleton & Spinner */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ink">6. Tabs, Data Table, Search, Empty & Loading States</h2>
          <Card>
            <Tabs
              ariaLabel="UI Kit data previews"
              items={[
                {
                  id: "table",
                  label: "Bookings Table",
                  badge: <Badge variant="primary" size="sm">{filteredRows.length}</Badge>,
                  content: (
                    <div className="space-y-3">
                      <SearchInput
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onClear={() => setSearch("")}
                        placeholder="Filter sample bookings by customer or invoice..."
                        wrapperClassName="max-w-sm"
                      />
                      {filteredRows.length > 0 ? (
                        <Table ariaLabel="Sample bookings">
                          <TableCaption>Sample counter bookings using tabular INR figures.</TableCaption>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invoice</TableHead>
                              <TableHead>Customer</TableHead>
                              <TableHead>Seats</TableHead>
                              <TableHead align="right">Total</TableHead>
                              <TableHead align="right">Paid</TableHead>
                              <TableHead>Booking</TableHead>
                              <TableHead>Payment</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredRows.map((row) => (
                              <TableRow key={row.invoice}>
                                <TableCell tabular className="font-semibold">
                                  {row.invoice}
                                </TableCell>
                                <TableCell>{row.customer}</TableCell>
                                <TableCell tabular>{row.seat}</TableCell>
                                <TableCell align="right" tabular className="font-semibold">
                                  {formatINR(row.amount, 0)}
                                </TableCell>
                                <TableCell align="right" tabular>
                                  {formatINR(row.paid, 0)}
                                </TableCell>
                                <TableCell>
                                  <StatusPill status={row.bookingStatus} size="sm" />
                                </TableCell>
                                <TableCell>
                                  <StatusPill status={row.paymentStatus} size="sm" />
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <EmptyState
                          icon={<Inbox size={22} />}
                          title="No matching bookings"
                          description="Try clearing your search filter to see all sample records."
                          action={
                            <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                              Clear Filter
                            </Button>
                          }
                        />
                      )}
                    </div>
                  ),
                },
                {
                  id: "empty",
                  label: "Empty State",
                  content: (
                    <EmptyState
                      icon={<Inbox size={22} />}
                      title="No departures scheduled yet"
                      description="Create your first tour departure to start allocating sleeper berths and generating GST invoices."
                      action={<Button variant="accent" leftIcon={<Plus size={16} />}>Create Tour</Button>}
                    />
                  ),
                },
                {
                  id: "loading",
                  label: "Loading & Skeleton",
                  content: (
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Spinner size="sm" />
                        <Spinner size="md" />
                        <Spinner size="lg" className="text-brand" />
                        <span className="text-sm text-ink-muted">Loading manifest data...</span>
                      </div>
                      <div className="space-y-2.5 max-w-md">
                        <div className="flex items-center gap-3">
                          <Skeleton shape="circle" className="h-10 w-10" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="w-2/3" />
                            <Skeleton className="w-1/2 h-3" />
                          </div>
                        </div>
                        <Skeleton shape="rect" className="h-20 w-full" />
                      </div>
                    </div>
                  ),
                },
                {
                  id: "disabled-tab",
                  label: "Disabled Tab",
                  disabled: true,
                },
              ]}
            />
          </Card>
        </section>

        {/* 7. Overlays & Notifications */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-ink">7. Modal, Drawer, ConfirmDialog & Toasts</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Interactive Overlays</CardTitle>
                  <CardDescription>Focus-trapped, Escape-dismissible, focus-restoring.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2.5">
                <Button variant="primary" onClick={() => setModalOpen(true)}>
                  Open Modal
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDrawerSide("right")
                    setDrawerOpen(true)
                  }}
                >
                  Open Right Drawer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setDrawerSide("bottom")
                    setDrawerOpen(true)
                  }}
                >
                  Open Bottom Sheet
                </Button>
                <Button variant="danger" onClick={() => handleOpenConfirm(true)}>
                  Destructive Confirm
                </Button>
                <Button variant="accent" onClick={() => handleOpenConfirm(false)}>
                  Standard Confirm
                </Button>
              </CardContent>
              <CardFooter>
                <span className="text-xs text-ink-muted mr-auto">Press Tab / Shift+Tab / Esc inside overlays</span>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Toast Notifications</CardTitle>
                  <CardDescription>Trigger live viewport toasts or inspect static tones below.</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="success" onClick={() => toast.success("Payment receipt REC-0042 recorded.")}>
                    Success
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => toast.error("Seat L4 is already booked for this departure.")}>
                    Error
                  </Button>
                  <Button size="sm" variant="accent" onClick={() => toast.warning("2 passengers missing Aadhaar numbers.")}>
                    Warning
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => toast.undo("Booking moved to trash.", () => toast.success("Booking restored!"))}
                  >
                    Undo Toast
                  </Button>
                </div>
                <div className="space-y-2 pt-2">
                  <Toast type="success" message="Static preview: Payment recorded successfully." />
                  <Toast type="error" message="Static preview: Seat conflict detected on berth L4." />
                  <Toast type="warning" message="Static preview: Partial balance pending." />
                  <Toast type="info" message="Static preview: Manifest ready for printing." />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Modal Demo */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Quick Berth Allocation"
        description="Keyboard focus stays trapped inside this modal and returns to the trigger button upon close."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                setModalOpen(false)
                toast.success("Berth allocated!")
              }}
            >
              Confirm Allocation
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Passenger Name" required>
            {({ id }) => <Input id={id} placeholder="Enter passenger name" />}
          </Field>
          <Field label="Advance Received (₹)">
            {({ id }) => <Input id={id} type="number" tabular placeholder="2000" />}
          </Field>
        </div>
      </Modal>

      {/* Drawer Demo */}
      <Drawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        side={drawerSide}
        title="Passenger Details Drawer"
        description="Slide-over panel for quick manifest editing without losing table context."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDrawerOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setDrawerOpen(false)
                toast.info("Drawer changes saved")
              }}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar name="Rameshbhai Patel" size="lg" />
            <div>
              <p className="font-bold text-ink">Rameshbhai Patel</p>
              <p className="text-xs text-ink-muted tabular-nums">+91 98765 43210 • Seats L1, L2</p>
            </div>
          </div>
          <div className="flex gap-2">
            <StatusPill status="Confirmed" />
            <StatusPill status="Paid" />
          </div>
          <Field label="Conductor Remarks">
            {({ id }) => <Textarea id={id} placeholder="Senior citizen — lower berth preferred." />}
          </Field>
        </div>
      </Drawer>
    </div>
  )
}
