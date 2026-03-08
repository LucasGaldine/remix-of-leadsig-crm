import { useState } from "react";
import { Camera, Expand, X } from "lucide-react";

interface PhotoItem {
  id: string;
  url: string;
  created_at: string;
}

interface ClientPortalPhotosProps {
  photos: {
    before: PhotoItem[];
    after: PhotoItem[];
  };
}

export function ClientPortalPhotos({ photos }: ClientPortalPhotosProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  return (
    <>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Photos</h2>
          </div>
        </div>

        <div className="px-6 sm:px-8 py-5 space-y-6">
          {photos.before.length > 0 && (
            <PhotoGrid
              title="Before"
              photos={photos.before}
              onPreview={setPreviewUrl}
            />
          )}
          {photos.after.length > 0 && (
            <PhotoGrid
              title="After"
              photos={photos.after}
              onPreview={setPreviewUrl}
            />
          )}
        </div>
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
            alt="Photo preview"
            className="max-w-full max-h-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}

function PhotoGrid({
  title,
  photos,
  onPreview,
}: {
  title: string;
  photos: PhotoItem[];
  onPreview: (url: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {photos.map((photo) => (
          <button
            key={photo.id}
            onClick={() => onPreview(photo.url)}
            className="relative group aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            <img
              src={photo.url}
              alt={`${title} photo`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="p-2 bg-white/90 rounded-full">
                <Expand className="h-4 w-4 text-slate-700" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
