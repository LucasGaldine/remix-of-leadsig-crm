import { useRef, useState } from "react";
import { Camera, Loader2, Plus, Trash2, X, Expand } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLeadPhotos } from "@/hooks/useLeadPhotos";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BeforePhotosProps {
  leadId: string;
  onPhotosChange?: (count: number) => void;
}

export function BeforePhotos({ leadId, onPhotosChange }: BeforePhotosProps) {
  const { photos, isLoading, isUploading, uploadPhotos, deletePhoto, canUploadMore, remaining } =
    useLeadPhotos(leadId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const prevCount = useRef(photos.length);
  if (photos.length !== prevCount.current) {
    prevCount.current = photos.length;
    onPhotosChange?.(photos.length);
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    await uploadPhotos(files);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await deletePhoto(deleteTarget);
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="card-elevated rounded-lg p-4">
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Camera className="h-4 w-4" />
          Before Photos
        </h3>
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card-elevated rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Before Photos
          </h3>
          <span className="text-xs text-muted-foreground">
            {photos.length}/4
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-muted border border-border"
            >
              <img
                src={photo.publicUrl}
                alt="Before photo"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                <button
                  onClick={() => setPreviewUrl(photo.publicUrl)}
                  className="p-1.5 bg-white/90 rounded-full text-foreground hover:bg-white transition-colors"
                >
                  <Expand className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setDeleteTarget(photo.id)}
                  className="p-1.5 bg-white/90 rounded-full text-destructive hover:bg-white transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}

          {canUploadMore && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className={cn(
                "aspect-[4/3] rounded-lg border-2 border-dashed border-border",
                "flex flex-col items-center justify-center gap-1.5",
                "text-muted-foreground hover:border-primary hover:text-primary",
                "transition-colors cursor-pointer",
                isUploading && "opacity-50 cursor-not-allowed"
              )}
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Plus className="h-5 w-5" />
              )}
              <span className="text-xs font-medium">
                {isUploading ? "Uploading..." : `Add photo`}
              </span>
            </button>
          )}
        </div>

        {photos.length === 0 && !canUploadMore && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No before photos yet
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={previewUrl}
            alt="Before photo preview"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this before photo? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
