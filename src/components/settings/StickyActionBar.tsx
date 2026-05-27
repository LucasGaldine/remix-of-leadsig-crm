import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StickyActionBarProps {
  onSave: () => void;
  isSaving?: boolean;
  disabled?: boolean;
  label?: string;
  savingLabel?: string;
  contentClassName?: string;
}

export function StickyActionBar({
  onSave,
  isSaving = false,
  disabled = false,
  label = "Save Changes",
  savingLabel = "Saving...",
  contentClassName: _contentClassName,
}: StickyActionBarProps) {
  return (
    <div className="fixed !right-[calc(0.75rem+env(safe-area-inset-right))] !bottom-[calc(7.25rem+env(safe-area-inset-bottom))] z-40 sm:!bottom-6 sm:!right-6">
      <Button
        onClick={onSave}
        size="icon"
        className="h-16 w-16 rounded-full shadow-lg sm:h-14 sm:w-14"
        disabled={isSaving || disabled}
        aria-label={isSaving ? savingLabel : label}
      >
        {isSaving ? <Loader2 className="!h-6 !w-6 animate-spin !stroke-[2.5]" /> : <Save className="!h-6 !w-6 !stroke-[2.5]" />}
      </Button>
    </div>
  );
}
