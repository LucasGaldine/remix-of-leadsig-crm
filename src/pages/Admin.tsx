import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MobileNav } from "@/components/layout/MobileNav";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const ADMIN_EMAIL = "lucas.galdine@gmail.com";

interface DocumentationPage {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  created_at: string;
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export default function Admin() {
  const navigate = useNavigate();
  const { user, currentAccount } = useAuth();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocumentationPage[]>([]);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);

  const normalizedEmail = (user?.email ?? "").trim().toLowerCase();
  const isAllowedAdmin = normalizedEmail === ADMIN_EMAIL;

  const generatedSlug = useMemo(() => slugify(title), [title]);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(generatedSlug);
    }
  }, [generatedSlug, slugTouched]);

  const fetchDocs = async () => {
    if (!currentAccount || !isAllowedAdmin) return;

    setIsLoadingDocs(true);

    const { data, error } = await supabase
      .from("documentation_pages")
      .select("id, title, slug, summary, content, created_at")
      .eq("account_id", currentAccount.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Failed to load documentation pages", error);
      toast.error("Failed to load existing documentation pages.");
      setIsLoadingDocs(false);
      return;
    }

    setDocs((data ?? []) as DocumentationPage[]);
    setIsLoadingDocs(false);
  };

  useEffect(() => {
    fetchDocs();
  }, [currentAccount?.id, isAllowedAdmin]);

  const resetForm = () => {
    setTitle("");
    setSlug("");
    setSummary("");
    setContent("");
    setSlugTouched(false);
    setEditingDocId(null);
  };

  const handleEditDoc = (doc: DocumentationPage) => {
    setEditingDocId(doc.id);
    setTitle(doc.title);
    setSlug(doc.slug);
    setSummary(doc.summary ?? "");
    setContent(doc.content);
    setSlugTouched(true);
  };

  const handleSave = async () => {
    if (!user || !currentAccount) return;

    if (!isAllowedAdmin) {
      toast.error("Only the admin account can upload docs.");
      return;
    }

    const cleanedTitle = title.trim();
    const cleanedSlug = slugify(slug);
    const cleanedContent = content.trim();
    const cleanedSummary = summary.trim();

    if (!cleanedTitle || !cleanedSlug || !cleanedContent) {
      toast.error("Title, slug, and content are required.");
      return;
    }

    setIsSaving(true);

    const { error } = editingDocId
      ? await supabase
          .from("documentation_pages")
          .update({
            title: cleanedTitle,
            slug: cleanedSlug,
            summary: cleanedSummary || null,
            content: cleanedContent,
          })
          .eq("id", editingDocId)
          .eq("account_id", currentAccount.id)
      : await supabase.from("documentation_pages").insert({
          account_id: currentAccount.id,
          created_by: user.id,
          title: cleanedTitle,
          slug: cleanedSlug,
          summary: cleanedSummary || null,
          content: cleanedContent,
        });

    if (error) {
      console.error("Failed to save documentation page", error);
      toast.error(error.message || "Failed to upload documentation page.");
      setIsSaving(false);
      return;
    }

    toast.success(editingDocId ? "Documentation page updated." : "Documentation page uploaded to Supabase.");
    resetForm();
    await fetchDocs();
    setIsSaving(false);
  };

  const handleDeleteDoc = async (doc: DocumentationPage) => {
    if (!currentAccount) return;
    const confirmed = window.confirm(`Delete "${doc.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setIsDeletingId(doc.id);
    const { error } = await supabase
      .from("documentation_pages")
      .delete()
      .eq("id", doc.id)
      .eq("account_id", currentAccount.id);

    if (error) {
      console.error("Failed to delete documentation page", error);
      toast.error(error.message || "Failed to delete documentation page.");
      setIsDeletingId(null);
      return;
    }

    if (editingDocId === doc.id) {
      resetForm();
    }

    toast.success("Documentation page deleted.");
    await fetchDocs();
    setIsDeletingId(null);
  };

  if (!isAllowedAdmin) {
    return (
      <div className="min-h-screen bg-surface-sunken pb-24">
        <PageHeader title="Admin" subtitle="Restricted area" showBack />
        <main className="px-4 py-4">
          <div className="card-elevated rounded-lg p-4">
            <div className="mb-2 flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
              <h2 className="text-sm font-semibold">Access denied</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              This page is limited to the {ADMIN_EMAIL} account.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/")}>
              Back to dashboard
            </Button>
          </div>
        </main>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Admin"
        subtitle="Create documentation pages"
        showBack
      />

      <main className="space-y-4 px-4 py-4">
        <div className="card-elevated rounded-lg p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-medium">{editingDocId ? "Edit documentation page" : "New documentation page"}</h2>
            {editingDocId ? (
              <Button variant="outline" size="sm" onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                placeholder="How to create your first lead"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="doc-slug">Slug</Label>
              <Input
                id="doc-slug"
                placeholder="how-to-create-your-first-lead"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value);
                }}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="doc-summary">Summary (optional)</Label>
              <Input
                id="doc-summary"
                placeholder="Quick setup for new users"
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="doc-content">Content</Label>
              <Textarea
                id="doc-content"
                placeholder="Write your documentation content here..."
                value={content}
                onChange={(event) => setContent(event.target.value)}
                className="min-h-64"
              />
            </div>

            <div className="pt-1">
              <Button onClick={handleSave} disabled={isSaving}>
                <Upload className="mr-1 h-4 w-4" />
                {isSaving ? (editingDocId ? "Saving..." : "Uploading...") : (editingDocId ? "Save changes" : "Upload")}
              </Button>
            </div>
          </div>
        </div>

        <div className="card-elevated rounded-lg p-4">
          <h2 className="mb-3 font-medium">Recently uploaded</h2>
          {isLoadingDocs ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documentation pages uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => (
                <div key={doc.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{doc.title}</p>
                      <p className="text-xs text-muted-foreground">/{doc.slug}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEditDoc(doc)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDeleteDoc(doc)}
                        disabled={isDeletingId === doc.id}
                      >
                        {isDeletingId === doc.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
