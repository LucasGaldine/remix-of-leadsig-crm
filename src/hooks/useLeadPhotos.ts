import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const MAX_PHOTOS = 4;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];

export interface LeadPhoto {
  id: string;
  lead_id: string;
  account_id: string;
  file_path: string;
  photo_type: "before" | "after";
  uploaded_by: string;
  created_at: string;
  publicUrl: string;
}

export function useLeadPhotos(leadId: string | undefined, photoType: "before" | "after" = "before") {
  const { user, currentAccount } = useAuth();
  const [photos, setPhotos] = useState<LeadPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const fetchPhotos = useCallback(async () => {
    if (!leadId) return;

    const { data, error } = await supabase
      .from("lead_photos")
      .select("*")
      .eq("lead_id", leadId)
      .eq("photo_type", photoType)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch lead photos:", error);
      setPhotos([]);
    } else {
      const withUrls = (data || []).map((photo: any) => ({
        ...photo,
        publicUrl: supabase.storage
          .from("lead-photos")
          .getPublicUrl(photo.file_path).data.publicUrl,
      }));
      setPhotos(withUrls);
    }

    setIsLoading(false);
  }, [leadId, photoType]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const uploadPhotos = async (files: File[]) => {
    if (!leadId || !user || !currentAccount) {
      toast.error("Unable to upload photos");
      return;
    }

    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
      toast.error(`Maximum of ${MAX_PHOTOS} photos allowed`);
      return;
    }

    const filesToUpload = files.slice(0, remaining);
    if (filesToUpload.length < files.length) {
      toast.info(`Only uploading ${filesToUpload.length} of ${files.length} files (limit: ${MAX_PHOTOS})`);
    }

    for (const file of filesToUpload) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Only JPEG, PNG, WebP, and HEIC images are allowed`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File must be under 10MB`);
        return;
      }
    }

    setIsUploading(true);

    try {
      for (const file of filesToUpload) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const filePath = `${currentAccount.id}/${leadId}/${photoType}/${crypto.randomUUID()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("lead-photos")
          .upload(filePath, file, { contentType: file.type });

        if (uploadError) {
          console.error("Storage upload error:", uploadError);
          toast.error(`Failed to upload ${file.name}`);
          continue;
        }

        const { error: dbError } = await supabase.from("lead_photos").insert({
          lead_id: leadId,
          account_id: currentAccount.id,
          file_path: filePath,
          uploaded_by: user.id,
          photo_type: photoType,
        });

        if (dbError) {
          console.error("DB insert error:", dbError);
          toast.error(`Failed to save ${file.name}`);
          await supabase.storage.from("lead-photos").remove([filePath]);
        }
      }

      await fetchPhotos();
      toast.success("Photos uploaded");
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("An error occurred while uploading");
    } finally {
      setIsUploading(false);
    }
  };

  const deletePhoto = async (photoId: string) => {
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;

    const { error: dbError } = await supabase
      .from("lead_photos")
      .delete()
      .eq("id", photoId);

    if (dbError) {
      toast.error("Failed to delete photo");
      return;
    }

    await supabase.storage.from("lead-photos").remove([photo.file_path]);
    await fetchPhotos();
    toast.success("Photo deleted");
  };

  return {
    photos,
    isLoading,
    isUploading,
    uploadPhotos,
    deletePhoto,
    canUploadMore: photos.length < MAX_PHOTOS,
    remaining: MAX_PHOTOS - photos.length,
  };
}
