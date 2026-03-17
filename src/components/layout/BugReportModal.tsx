import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Paperclip, X, Loader as Loader2 } from 'lucide-react';

interface BugReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BugReportModal({ open, onOpenChange }: BugReportModalProps) {
  const [page, setPage] = useState('');
  const [expected, setExpected] = useState('');
  const [actual, setActual] = useState('');
  const [additionalDetail, setAdditionalDetail] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetForm = () => {
    setPage('');
    setExpected('');
    setActual('');
    setAdditionalDetail('');
    setImageFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page.trim() || !expected.trim() || !actual.trim()) return;

    setSubmitting(true);
    try {
      let imageBase64: string | null = null;
      let imageFileName: string | null = null;

      if (imageFile) {
        const reader = new FileReader();
        imageBase64 = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(imageFile);
        });
        imageFileName = imageFile.name;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/report-bug`;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page: page.trim(),
          expected: expected.trim(),
          actual: actual.trim(),
          additionalDetail: additionalDetail.trim() || null,
          imageBase64,
          imageFileName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit bug report');
      }

      toast.success('Bug report submitted successfully');
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error('Failed to submit bug report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="bug-page">
              What page were you on? <span className="text-destructive">*</span>
            </Label>
            <Input
              id="bug-page"
              placeholder="e.g. Job Detail, Schedule, Payments..."
              value={page}
              onChange={(e) => setPage(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-expected">
              What did you expect to happen? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="bug-expected"
              placeholder="Describe what should have happened..."
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-actual">
              What actually happened? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="bug-actual"
              placeholder="Describe what actually happened instead..."
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bug-detail">Additional details (optional)</Label>
            <Textarea
              id="bug-detail"
              placeholder="Any other context that might help us fix this..."
              value={additionalDetail}
              onChange={(e) => setAdditionalDetail(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Screenshot (optional)</Label>
            {imageFile ? (
              <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/50">
                <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm truncate flex-1">{imageFile.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={removeImage}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Paperclip className="h-4 w-4" />
                Attach screenshot
              </Button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !page.trim() || !expected.trim() || !actual.trim()}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
