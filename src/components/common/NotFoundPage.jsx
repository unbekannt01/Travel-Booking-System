import { MapPinOff, ArrowLeft } from "lucide-react"
import { Button, Card } from "../ui/index"

export default function NotFoundPage({ onGoOverview }) {
  return (
    <div className="flex items-center justify-center p-4 sm:p-8 min-h-[50vh]">
      <Card elevation="sm" className="max-w-md w-full p-8 text-center rounded-3xl border-(--yh-border-subtle) space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-(--yh-brand)/10 text-(--yh-brand) mx-auto flex items-center justify-center">
          <MapPinOff size={28} />
        </div>
        <div className="space-y-1.5">
          <span className="text-xs font-mono font-bold uppercase tracking-widest text-(--yh-brand)">
            404 Error
          </span>
          <h2 className="text-xl font-bold text-(--yh-text-primary)">
            Screen Not Found
          </h2>
          <p className="text-xs text-(--yh-text-muted) leading-relaxed">
            The screen or destination you are looking for does not exist or has been moved.
          </p>
        </div>
        <div className="pt-2">
          <Button
            variant="primary"
            onClick={onGoOverview}
            className="w-full"
            icon={<ArrowLeft size={16} />}
          >
            Return to Overview
          </Button>
        </div>
      </Card>
    </div>
  )
}
