import { ShieldAlert, AlertTriangle } from "lucide-react"
import { Modal, Button, Input, Field } from "../ui/index"

export default function Disable2FAModal({
  isOpen,
  onClose,
  disable2FACode,
  setDisable2FACode,
  handleDisable2FA,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Disable Two-Factor Authentication"
      description="Enter your current 6-digit authenticator code to confirm."
      size="sm"
    >
      <div className="space-y-4">
        <div className="p-3.5 rounded-xl bg-(--yh-danger)/10 border border-(--yh-danger)/20 flex items-start gap-2.5 text-xs text-(--yh-danger)">
          <AlertTriangle size={16} className="shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Disabling 2FA lowers account security. Anyone with your password will be able to access passenger records and invoices.
          </p>
        </div>

        <Field label="6-Digit Authenticator Code" required>
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            placeholder="000000"
            className="text-center text-2xl font-mono font-bold tracking-[0.4em] py-3.5"
            value={disable2FACode}
            onChange={(e) => setDisable2FACode(e.target.value.replace(/\D/g, ""))}
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="button"
            disabled={disable2FACode.length !== 6}
            onClick={handleDisable2FA}
            className="bg-(--yh-danger) hover:opacity-90 text-white"
            icon={<ShieldAlert size={16} />}
          >
            Disable 2FA
          </Button>
        </div>
      </div>
    </Modal>
  )
}
