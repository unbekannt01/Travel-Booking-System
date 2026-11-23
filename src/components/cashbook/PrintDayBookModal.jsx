import { useState, useRef, useMemo } from "react"
import { Modal, Button, Select } from "../ui"
import { renderDayBookHtml } from "../../../shared/cashbook"
import { Printer, Globe } from "lucide-react"

export default function PrintDayBookModal({
  isOpen,
  onClose,
  dayBook = null,
  company = null,
}) {
  const [language, setLanguage] = useState("en")
  const iframeRef = useRef(null)

  const htmlContent = useMemo(() => {
    if (!dayBook) return ""
    return renderDayBookHtml({
      dayBook,
      company: company || {},
      language,
    })
  }, [dayBook, company, language])

  const handlePrint = () => {
    if (!iframeRef.current) return
    try {
      iframeRef.current.contentWindow.focus()
      iframeRef.current.contentWindow.print()
    } catch (err) {
      console.error("Print error:", err)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Print Daily Cash & Bank Book"
      description="Preview and print the official Day Book for your accounting files or physical binder."
      size="xl"
    >
      <div className="space-y-4">
        {/* Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-surface-subtle border border-border-subtle">
          <div className="flex items-center gap-2 text-xs font-semibold text-ink">
            <Globe className="w-4 h-4 text-brand" />
            <span>Document Language:</span>
            <Select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-32 py-1 text-xs"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="gu">ગુજરાતી</option>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="w-4 h-4" />
              <span>Print Day Book</span>
            </Button>
          </div>
        </div>

        {/* Sandboxed Print Preview Frame */}
        <div className="border border-border rounded-xl overflow-hidden bg-white shadow-inner h-[500px]">
          <iframe
            ref={iframeRef}
            srcDoc={htmlContent}
            title="Day Book Print Document"
            sandbox="allow-same-origin allow-modals"
            className="w-full h-full border-0"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  )
}
