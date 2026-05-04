import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ClientPortalJobReleaseProps {
  token: string;
  jobId?: string | null;
  apiUrl: string;
  apiHeaders: Record<string, string>;
  isFullyPaid: boolean;
  jobRelease: {
    id: string;
    status: string;
    release_text: string;
    signed_at?: string | null;
    signature_image_url?: string | null;
  } | null;
  onSigned: () => void;
}

export function ClientPortalJobRelease({
  token,
  jobId,
  apiUrl,
  apiHeaders,
  isFullyPaid,
  jobRelease,
  onSigned,
}: ClientPortalJobReleaseProps) {
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  const canSign = useMemo(
    () => isFullyPaid && jobRelease && jobRelease.status !== "signed",
    [isFullyPaid, jobRelease],
  );

  const pointerToCanvas = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !canSign) return;
    const context = canvas.getContext("2d");
    const point = pointerToCanvas(event);
    if (!context || !point) return;

    drawingRef.current = true;
    lastPointRef.current = point;
    context.beginPath();
    context.arc(point.x, point.y, 1.4, 0, Math.PI * 2);
    context.fillStyle = "#0f172a";
    context.fill();
    setHasSignature(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !canSign) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    const point = pointerToCanvas(event);
    if (!context || !point) return;

    const previous = lastPointRef.current;
    if (!previous) {
      lastPointRef.current = point;
      return;
    }

    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.strokeStyle = "#0f172a";
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
    lastPointRef.current = point;
    setHasSignature(true);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setError(null);
  };

  const handleSign = async () => {
    if (!jobRelease) return;
    if (!canvasRef.current || !hasSignature) {
      setError("Please provide a signature before submitting.");
      return;
    }

    setSigning(true);
    setError(null);
    try {
      const signatureDataUrl = canvasRef.current.toDataURL("image/png");
      const query = new URLSearchParams({ token });
      if (jobId) query.set("jobId", jobId);
      const response = await fetch(`${apiUrl}?${query.toString()}`, {
        method: "POST",
        headers: apiHeaders,
        body: JSON.stringify({
          action: "sign_job_release",
          signature_data_url: signatureDataUrl,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload?.error || "Unable to sign job release.");
        return;
      }

      onSigned();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  if (!isFullyPaid) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
      <div className="px-6 sm:px-8 py-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Job Release</h2>
          {jobRelease?.status === "signed" && (
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              Signed
            </span>
          )}
        </div>
      </div>

      <div className="px-6 sm:px-8 py-6 space-y-4">
        {jobRelease?.release_text ? (
          <pre className="whitespace-pre-wrap text-sm text-slate-700 bg-slate-50 rounded-xl border border-slate-200 p-4 max-h-96 overflow-auto">
            {jobRelease.release_text}
          </pre>
        ) : (
          <p className="text-sm text-slate-600">Your job release will appear once it is ready.</p>
        )}

        {jobRelease?.status === "signed" ? (
          <p className="text-sm text-emerald-700">This Job Release has been signed and recorded.</p>
        ) : (
          <>
            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">Client signature</p>
              <canvas
                ref={canvasRef}
                width={600}
                height={180}
                className="w-full max-w-[600px] h-40 rounded-xl border border-slate-300 bg-white touch-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDrawing}
                onPointerLeave={stopDrawing}
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={clearSignature} disabled={signing}>
                Clear
              </Button>
              <Button type="button" onClick={handleSign} disabled={signing || !hasSignature || !canSign}>
                {signing ? "Signing..." : "Sign Job Release"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
