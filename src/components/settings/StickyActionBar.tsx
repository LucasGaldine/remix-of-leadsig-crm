import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StickyActionBarProps {
  onSave: () => void;
  isSaving?: boolean;
  label?: string;
  savingLabel?: string;
}

export function StickyActionBar({
  onSave,
  isSaving = false,
  label = "Save Changes",
  savingLabel = "Saving...",
}: StickyActionBarProps) {
  return (
    <div className="sticky bottom-20 bg-surface-sunken/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur px-1 pt-2 pb-4 z-10">
      <Button onClick={onSave} className="w-full gap-2" disabled={isSaving}>
        {isSaving ? (
          savingLabel
        ) : (
          <>
            <Save className="h-4 w-4" />
            {label}
          </>
        )}
      </Button>
    </div>
  );
}
