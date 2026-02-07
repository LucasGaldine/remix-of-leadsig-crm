import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface AddPhotosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (files: File[]) => Promise<void>;
  maxFiles: number;
  title: string;
}

export function AddPhotosModal({
  open,
  onOpenChange,
  onSave,
  maxFiles,
  title,
}: AddPhotosModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const allowed = files.slice(0, maxFiles - selectedFiles.length);
    const newFiles = [...selectedFiles, ...allowed];
    setSelectedFiles(newFiles);

    const newPreviews = allowed.map((file) => URL.createObjectURL(file));
    setPreviews((prev) => [...prev, ...newPreviews]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (selectedFiles.length === 0) return;
    setSaving(true);
    try {
      await onSave(selectedFiles);
      cleanup();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const cleanup = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFiles([]);
    setPreviews([]);
  };

  const handleClose = (value: boolean) => {
    if (!value) cleanup();
    onOpenChange(value);
  };

  const canAddMore = selectedFiles.length < maxFiles;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Select up to {maxFiles} photos. Supported formats: JPEG, PNG, WebP, HEIC.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {selectedFiles.length === 0 ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "w-full rounded-lg border-2 border-dashed border-border py-12",
                "flex flex-col items-center justify-center gap-2",
                "text-muted-foreground hover:border-primary hover:text-primary",
                "transition-colors cursor-pointer"
              )}
            >
              <Camera className="h-10 w-10" />
              <span className="text-sm font-medium">Browse photos to upload</span>
              <span className="text-xs">JPEG, PNG, WebP, or HEIC up to 10MB</span>
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {previews.map((url, index) => (
                  <div
                    key={index}
                    className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted border border-border group"
                  >
                    <img
                      src={url}
                      alt={`Selected photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => removeFile(index)}
                      className="absolute top-2 right-2 p-1 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}

                {canAddMore && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "aspect-[4/3] rounded-lg border-2 border-dashed border-border",
                      "flex flex-col items-center justify-center gap-1.5",
                      "text-muted-foreground hover:border-primary hover:text-primary",
                      "transition-colors cursor-pointer"
                    )}
                  >
                    <Camera className="h-6 w-6" />
                    <span className="text-xs font-medium">Add More</span>
                  </button>
                )}
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {selectedFiles.length} of {maxFiles} photos selected
              </p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={selectedFiles.length === 0 || saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              `Save ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
