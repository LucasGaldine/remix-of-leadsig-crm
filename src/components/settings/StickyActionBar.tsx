import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StickyActionBarProps {
  onSave: () => void;
  isSaving?: boolean;
  label?: string;
  savingLabel?: string;
  contentClassName?: string;
}

export function StickyActionBar({
  onSave,
  isSaving = false,
  label = "Save Changes",
  savingLabel = "Saving...",
  contentClassName: _contentClassName,
}: StickyActionBarProps) {
  return (
    <div className="fixed bottom-24 right-4 z-40 sm:bottom-6 sm:right-6">
      <Button
        onClick={onSave}
        size="icon"
        className="h-14 w-14 rounded-full shadow-lg"
        disabled={isSaving}
        aria-label={isSaving ? savingLabel : label}
      >
        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
      </Button>
    </div>
  );
}
