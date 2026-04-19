import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Crown, Expand, Loader as Loader2, Plus, Trash2, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useLeadPhotos } from "@/hooks/useLeadPhotos";
import { useAuth } from "@/hooks/useAuth";
import { hasPlanAccess, planNames, type PricingPlan } from "@/lib/planGating";
import { AddPhotosModal } from "./AddPhotosModal";

interface PhotoSectionProps {
  leadId: string;
  photoType: "before" | "after";
  title: string;
  onPhotosChange?: (count: number) => void;
  onJobConverted?: () => void;
  embedded?: boolean;
}

export function PhotoSection({ leadId, photoType, title, onPhotosChange, onJobConverted, embedded = false }: PhotoSectionProps) {
  const { photos, isLoading, uploadPhotos, deletePhoto, remaining } =
    useLeadPhotos(leadId, photoType);
  const { currentAccount, role } = useAuth();
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);

  const currentPlan: PricingPlan = currentAccount?.pricing_plan ?? "free";
  const canUpload = hasPlanAccess(currentPlan, "basic");
  const emptyStateLabel = title.toLowerCase().includes("photo")
    ? title.toLowerCase()
    : `${title.toLowerCase()} photos`;

  useEffect(() => {
    onPhotosChange?.(photos.length);
  }, [photos.length, onPhotosChange]);

  const confirmDelete = async () => {
    if (deleteTarget) {
      await deletePhoto(deleteTarget);
      setDeleteTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 md:h-4 md:w-4 text-muted-foreground" />
            <p className="text-base md:text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-8 text-base md:text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 md:h-4 md:w-4 animate-spin mr-2" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 md:h-4 md:w-4 text-muted-foreground" />
            <p className="text-base md:text-xs uppercase tracking-wide text-muted-foreground">{title}</p>
          </div>
          {photos.length > 0 && (
            <span className="text-base md:text-xs text-muted-foreground">{photos.length}/4</span>
          )}
        </div>

        {photos.length === 0 ? (
          <div className={embedded ? "text-center py-10" : "text-center py-10 card-elevated rounded-lg"}>
            <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground text-xl md:text-sm mb-4">No {emptyStateLabel} yet</p>
            {canUpload ? (
              <Button
                variant="outline"
                size="lg"
                className="gap-2 text-base md:h-9 md:px-4 md:py-2 md:text-sm"
                onClick={() => setAddModalOpen(true)}
              >
                <Plus className="h-5 w-5 md:h-4 md:w-4" />
                Add Photos
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 text-base md:text-sm text-amber-600">
                  <Crown className="h-5 w-5 md:h-4 md:w-4" />
                  <span>{planNames.basic} plan required</span>
                </div>
                {role === "owner" && (
                  <div>
                    <Button
                      variant="outline"
                      size="lg"
                      className="text-base md:h-8 md:px-3 md:py-1.5 md:text-xs"
                      onClick={() => navigate("/settings/pricing")}
                    >
                      View Plans
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-muted border border-border"
                >
                  <img
                    src={photo.publicUrl}
                    alt={`${photoType} photo`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <div className="flex items-center gap-1 text-white text-base md:text-xs">
                      <User className="h-4 w-4 md:h-3 md:w-3" />
                      <span className="truncate">{photo.uploader_name}</span>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => setPreviewUrl(photo.publicUrl)}
                      className="p-2 md:p-1.5 bg-white/90 rounded-full text-foreground hover:bg-white transition-colors"
                    >
                      <Expand className="h-4 w-4 md:h-3.5 md:w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(photo.id)}
                      className="p-2 md:p-1.5 bg-white/90 rounded-full text-destructive hover:bg-white transition-colors"
                    >
                      <Trash2 className="h-4 w-4 md:h-3.5 md:w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {remaining > 0 && canUpload && (
              <Button
                variant="outline"
                size="lg"
                className="w-full gap-2 text-base md:h-8 md:px-3 md:py-1.5 md:text-xs"
                onClick={() => setAddModalOpen(true)}
              >
                <Plus className="h-5 w-5 md:h-4 md:w-4" />
                Add More Photos
              </Button>
            )}
          </>
        )}
      </div>

      <AddPhotosModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        onSave={async (files) => {
          const result = await uploadPhotos(files);
          if (result?.converted && onJobConverted) {
            onJobConverted();
          }
        }}
        maxFiles={remaining}
        title={`Add ${title}`}
      />

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
            alt="Photo preview"
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
              Are you sure you want to delete this photo? This cannot be undone.
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
