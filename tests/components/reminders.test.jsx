import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen, fireEvent, waitFor } from "@testing-library/react"
import ReminderModal from "../../src/components/reminders/ReminderModal"
import ReminderTemplateEditor from "../../src/components/dashboard/ReminderTemplateEditor"
import { renderWithProviders } from "../testUtils"
import * as remindersData from "../../src/data/reminders"
import { DEFAULT_REMINDER_TEMPLATES } from "../../shared/reminders"

const mockCustomer = {
  id: "cust-001",
  _id: "cust-001",
  name: "Rameshbhai Patel",
  customerName: "Rameshbhai Patel",
  phone: "9876543210",
  customerPhone: "9876543210",
  customerCity: "Surat",
  language: "gu",
  whatsappOptOut: false,
  totalOutstanding: 6000,
  oldestOverdueDays: 12,
  reminderCount30d: 1,
  lastReminderAt: null,
  bookings: [
    {
      bookingId: "b-001",
      id: "b-001",
      invoiceNo: "INV-2026-001",
      tourName: "Somnath Dwarka Express",
      journeyDate: "2026-11-28",
      outstanding: 6000,
      totalAmount: 10000,
      advanceReceived: 4000,
      daysOverdue: 12,
    },
  ],
}

const mockCompany = {
  companyName: "Shree Somnath Travels",
  companyPhone: "9825012345",
  bankDetails: {
    upiId: "somnath@upi",
  },
}

describe("Payment Reminders UI Components", () => {
  let consoleErrorSpy

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation((msg) => {
      if (typeof msg === "string" && msg.includes("not wrapped in act")) return
    })
    vi.spyOn(remindersData, "listReminderTemplates").mockResolvedValue(DEFAULT_REMINDER_TEMPLATES)
    vi.spyOn(remindersData, "createReminderLog").mockResolvedValue({
      id: "log-123",
      status: "opened",
      amount: 6000,
      openedAt: new Date().toISOString(),
    })
    vi.spyOn(remindersData, "markReminderSent").mockResolvedValue({
      success: true,
      reminder: { id: "log-123", status: "sent", markedSentAt: new Date().toISOString() },
    })
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
    vi.restoreAllMocks()
  })

  it("ReminderModal: renders customer info, balance, and generated WhatsApp link", async () => {
    renderWithProviders(
      <ReminderModal
        isOpen={true}
        onClose={vi.fn()}
        customer={mockCustomer}
        company={mockCompany}
      />
    )

    // Customer name and balance
    await waitFor(() => {
      expect(screen.getByText("Rameshbhai Patel")).toBeDefined()
      expect(screen.getByText("₹6,000")).toBeDefined()
    })

    // WhatsApp link check
    const waLink = await screen.findByRole("link", { name: /Open WhatsApp/i })
    expect(waLink).toBeDefined()
    expect(waLink.getAttribute("target")).toBe("_blank")
    expect(waLink.getAttribute("rel")).toBe("noopener noreferrer")
    expect(waLink.getAttribute("href")).toContain("https://wa.me/919876543210?text=")

    // Copy message button
    const copyBtn = screen.getByRole("button", { name: /Copy Message/i })
    expect(copyBtn).toBeDefined()
  })

  it("ReminderModal: displays 24-hour warning when reminder sent recently", async () => {
    const recentCustomer = {
      ...mockCustomer,
      lastReminderAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    }

    renderWithProviders(
      <ReminderModal
        isOpen={true}
        onClose={vi.fn()}
        customer={recentCustomer}
        company={mockCompany}
      />
    )

    const warning = await screen.findByText(/Recent Reminder Sent/i)
    expect(warning).toBeDefined()
  })

  it("ReminderModal: shows opt-out alert and disables WhatsApp link and Copy button", async () => {
    const optedOutCustomer = {
      ...mockCustomer,
      whatsappOptOut: true,
    }

    renderWithProviders(
      <ReminderModal
        isOpen={true}
        onClose={vi.fn()}
        customer={optedOutCustomer}
        company={mockCompany}
      />
    )

    const optOutBanner = await screen.findByText(/Customer Opted Out/i)
    expect(optOutBanner).toBeDefined()
    expect(screen.queryByRole("link", { name: /Open WhatsApp/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /Copy Message/i })).toBeNull()
  })

  it("ReminderModal: shows invalid phone alert when number is invalid", async () => {
    const invalidPhoneCustomer = {
      ...mockCustomer,
      phone: "12345",
      customerPhone: "12345",
    }

    renderWithProviders(
      <ReminderModal
        isOpen={true}
        onClose={vi.fn()}
        customer={invalidPhoneCustomer}
        company={mockCompany}
      />
    )

    const invalidBanner = await screen.findByText(/Invalid Phone Number/i)
    expect(invalidBanner).toBeDefined()
    expect(screen.queryByRole("link", { name: /Open WhatsApp/i })).toBeNull()
  })

  it("ReminderModal: supports queue mode with Skip and Next stepping", async () => {
    const queueList = [
      mockCustomer,
      {
        ...mockCustomer,
        id: "cust-002",
        name: "Jigneshbhai Mehta",
        customerName: "Jigneshbhai Mehta",
        phone: "9825098765",
        totalOutstanding: 4500,
      },
    ]

    const onQueueNext = vi.fn()

    renderWithProviders(
      <ReminderModal
        isOpen={true}
        onClose={vi.fn()}
        customer={queueList[0]}
        queue={queueList}
        queueIndex={0}
        onQueueNext={onQueueNext}
        company={mockCompany}
      />
    )

    const queueBadge = await screen.findByText(/Queue: 1 of 2/i)
    expect(queueBadge).toBeDefined()
    expect(screen.getByText("Rameshbhai Patel")).toBeDefined()

    // Click Next
    const nextBtn = screen.getByRole("button", { name: /Next/i })
    fireEvent.click(nextBtn)

    expect(onQueueNext).toHaveBeenCalledWith(1)
  })

  it("ReminderTemplateEditor: allows switching tone, inserting placeholder chips, and previewing", async () => {
    renderWithProviders(<ReminderTemplateEditor user={mockCompany} />)

    // Wait for templates to load
    const title = await screen.findByText(/WhatsApp Reminder Templates/i)
    expect(title).toBeDefined()

    // Tone button
    const overdueRadio = screen.getByRole("radio", { name: /Overdue/i })
    fireEvent.click(overdueRadio)
    expect(overdueRadio.getAttribute("aria-checked")).toBe("true")

    // Placeholder chip
    const chip = screen.getByRole("button", { name: "{customerName}" })
    expect(chip).toBeDefined()

    // Communication advisory check
    expect(screen.getByText(/Communication Advisory/i)).toBeDefined()
    expect(screen.getByText(/Send reminders only to customers who agreed to receive messages/i)).toBeDefined()
    expect(screen.getByText(/Live Preview/i)).toBeDefined()
  })
})
