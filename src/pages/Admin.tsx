import { useEffect, useMemo, useState } from "react";
import { Building2, Megaphone, ShieldAlert, Upload } from "lucide-react";
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

type AdminSection = "docs" | "companies" | "release-updates";

interface DocumentationPage {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
  created_at: string;
}

interface CompanyAccount {
  id: string;
  company_name: string | null;
  company_email: string | null;
  company_phone: string | null;
  created_at: string | null;
  pricing_plan: string | null;
  pricing_tier: string | null;
  is_active: boolean | null;
}

interface ReleaseUpdateRecord {
  id: string;
  account_id: string;
  title: string;
  description: string;
  highlights: string[];
  version: string;
  released_at: string;
  cta_label: string | null;
  cta_href: string | null;
  is_published: boolean;
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
  const { user, currentAccount, isOwnerOrAdmin } = useAuth();

  const [activeSection, setActiveSection] = useState<AdminSection>("companies");

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

  const [isLoadingCompanies, setIsLoadingCompanies] = useState(false);
  const [companies, setCompanies] = useState<CompanyAccount[]>([]);
  const [companySearch, setCompanySearch] = useState("");
  const [upgradingCompanyId, setUpgradingCompanyId] = useState<string | null>(null);

  const [releaseTitle, setReleaseTitle] = useState("");
  const [releaseDescription, setReleaseDescription] = useState("");
  const [releaseHighlights, setReleaseHighlights] = useState("");
  const [releaseVersion, setReleaseVersion] = useState("");
  const [releaseDate, setReleaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [releaseCtaLabel, setReleaseCtaLabel] = useState("");
  const [releaseCtaHref, setReleaseCtaHref] = useState("");
  const [releasePublished, setReleasePublished] = useState(true);
  const [releaseUpdates, setReleaseUpdates] = useState<ReleaseUpdateRecord[]>([]);
  const [isLoadingReleaseUpdates, setIsLoadingReleaseUpdates] = useState(false);
  const [isSavingReleaseUpdate, setIsSavingReleaseUpdate] = useState(false);
  const [editingReleaseUpdateId, setEditingReleaseUpdateId] = useState<string | null>(null);
  const [deletingReleaseUpdateId, setDeletingReleaseUpdateId] = useState<string | null>(null);

  const normalizedEmail = (user?.email ?? "").trim().toLowerCase();
  const isAllowedAdmin = normalizedEmail === ADMIN_EMAIL;
  const canManageReleaseUpdates = isAllowedAdmin || isOwnerOrAdmin();

  useEffect(() => {
    if (!isAllowedAdmin && canManageReleaseUpdates && activeSection !== "release-updates") {
      setActiveSection("release-updates");
    }
  }, [activeSection, canManageReleaseUpdates, isAllowedAdmin]);

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

  const fetchCompanies = async () => {
    if (!isAllowedAdmin) return;

    setIsLoadingCompanies(true);

    const { data: fnData, error } = await supabase.functions.invoke("secure-admin-list-accounts", { body: {} });

    if (error) {
      console.error("Failed to load companies", error);
      toast.error("Failed to load company accounts.");
      setIsLoadingCompanies(false);
      return;
    }

    setCompanies((((fnData as { data?: CompanyAccount[] } | null)?.data) ?? []) as CompanyAccount[]);
    setIsLoadingCompanies(false);
  };

  useEffect(() => {
    fetchDocs();
  }, [currentAccount?.id, isAllowedAdmin]);

  useEffect(() => {
    fetchCompanies();
  }, [isAllowedAdmin]);

  const handleManualUpgrade = async (company: CompanyAccount) => {
    if (!isAllowedAdmin) {
      toast.error("Only the admin account can upgrade companies.");
      return;
    }

    const confirmed = window.confirm(
      `Mark ${company.company_name || "this company"} as upgraded? This sets plan to Basic (Solo).`,
    );
    if (!confirmed) return;

    setUpgradingCompanyId(company.id);
    const { error } = await supabase.functions.invoke("secure-admin-mark-account-upgraded", {
      body: {
        target_account_id: company.id,
        target_plan: "basic",
        target_tier: "solo",
      },
    });

    if (error) {
      console.error("Failed to mark company as upgraded", error);
      toast.error(error.message || "Failed to mark company as upgraded.");
      setUpgradingCompanyId(null);
      return;
    }

    toast.success(`${company.company_name || "Company"} marked as upgraded.`);
    await fetchCompanies();
    setUpgradingCompanyId(null);
  };

  const fetchReleaseUpdates = async () => {
    if (!currentAccount || !canManageReleaseUpdates) return;

    setIsLoadingReleaseUpdates(true);
    const { data, error } = await supabase
      .from("release_updates")
      .select("id, account_id, title, description, highlights, version, released_at, cta_label, cta_href, is_published, created_at")
      .eq("account_id", currentAccount.id)
      .order("released_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Failed to load release updates", error);
      toast.error("Failed to load release updates.");
      setIsLoadingReleaseUpdates(false);
      return;
    }

    setReleaseUpdates((data ?? []) as ReleaseUpdateRecord[]);
    setIsLoadingReleaseUpdates(false);
  };

  useEffect(() => {
    fetchReleaseUpdates();
  }, [currentAccount?.id, canManageReleaseUpdates]);

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

  const resetReleaseUpdateForm = () => {
    setReleaseTitle("");
    setReleaseDescription("");
    setReleaseHighlights("");
    setReleaseVersion("");
    setReleaseDate(new Date().toISOString().slice(0, 10));
    setReleaseCtaLabel("");
    setReleaseCtaHref("");
    setReleasePublished(true);
    setEditingReleaseUpdateId(null);
  };

  const handleEditReleaseUpdate = (update: ReleaseUpdateRecord) => {
    setEditingReleaseUpdateId(update.id);
    setReleaseTitle(update.title);
    setReleaseDescription(update.description);
    setReleaseHighlights(update.highlights.join("\n"));
    setReleaseVersion(update.version);
    setReleaseDate(update.released_at);
    setReleaseCtaLabel(update.cta_label ?? "");
    setReleaseCtaHref(update.cta_href ?? "");
    setReleasePublished(update.is_published);
  };

  const handleSaveReleaseUpdate = async () => {
    if (!user || !currentAccount) return;
    if (!canManageReleaseUpdates) {
      toast.error("Only account owners and admins can manage release updates.");
      return;
    }

    const cleanedTitle = releaseTitle.trim();
    const cleanedDescription = releaseDescription.trim();
    const cleanedHighlights = releaseHighlights
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const cleanedVersion = releaseVersion.trim();
    const cleanedDate = releaseDate.trim();
    const cleanedCtaLabel = releaseCtaLabel.trim();
    const cleanedCtaHref = releaseCtaHref.trim();

    if (!cleanedTitle || !cleanedDescription || !cleanedVersion || !cleanedDate || cleanedHighlights.length === 0) {
      toast.error("Title, description, at least one highlight, version, and release date are required.");
      return;
    }

    setIsSavingReleaseUpdate(true);

    const insertPayload = {
      account_id: currentAccount.id,
      title: cleanedTitle,
      description: cleanedDescription,
      highlights: cleanedHighlights,
      version: cleanedVersion,
      released_at: cleanedDate,
      cta_label: cleanedCtaLabel || null,
      cta_href: cleanedCtaHref || null,
      is_published: releasePublished,
      created_by: user.id,
    };

    const updatePayload = {
      account_id: currentAccount.id,
      title: cleanedTitle,
      description: cleanedDescription,
      highlights: cleanedHighlights,
      version: cleanedVersion,
      released_at: cleanedDate,
      cta_label: cleanedCtaLabel || null,
      cta_href: cleanedCtaHref || null,
      is_published: releasePublished,
    };

    const { error } = editingReleaseUpdateId
      ? await supabase
          .from("release_updates")
          .update(updatePayload)
          .eq("id", editingReleaseUpdateId)
          .eq("account_id", currentAccount.id)
      : await supabase.from("release_updates").insert(insertPayload);

    if (error) {
      console.error("Failed to save release update", error);
      toast.error(error.message || "Failed to save release update.");
      setIsSavingReleaseUpdate(false);
      return;
    }

    toast.success(editingReleaseUpdateId ? "Release update updated." : "Release update created.");
    resetReleaseUpdateForm();
    await fetchReleaseUpdates();
    setIsSavingReleaseUpdate(false);
  };

  const handleDeleteReleaseUpdate = async (update: ReleaseUpdateRecord) => {
    if (!currentAccount) return;
    if (!canManageReleaseUpdates) {
      toast.error("Only account owners and admins can manage release updates.");
      return;
    }
    const confirmed = window.confirm(`Delete "${update.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingReleaseUpdateId(update.id);
    const { error } = await supabase
      .from("release_updates")
      .delete()
      .eq("id", update.id)
      .eq("account_id", currentAccount.id);

    if (error) {
      console.error("Failed to delete release update", error);
      toast.error(error.message || "Failed to delete release update.");
      setDeletingReleaseUpdateId(null);
      return;
    }

    if (editingReleaseUpdateId === update.id) {
      resetReleaseUpdateForm();
    }

    toast.success("Release update deleted.");
    await fetchReleaseUpdates();
    setDeletingReleaseUpdateId(null);
  };

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase();
    if (!query) return companies;

    return companies.filter((company) => {
      const haystack = [
        company.company_name,
        company.company_email,
        company.company_phone,
        company.pricing_plan,
        company.pricing_tier,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [companies, companySearch]);

  const activeCompanyCount = useMemo(() => companies.filter((company) => company.is_active !== false).length, [companies]);

  if (!isAllowedAdmin && !canManageReleaseUpdates) {
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
              This page is limited to system admin and account admins.
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
      <PageHeader title="Admin" subtitle="Company accounts and documentation" showBack />

      <main className="space-y-4 px-4 py-4">
        <div className="card-elevated rounded-lg p-2">
          <div className={`grid grid-cols-1 gap-2 ${isAllowedAdmin ? "sm:grid-cols-3" : "sm:grid-cols-1"}`}>
            {isAllowedAdmin ? (
              <>
                <Button
                  variant={activeSection === "companies" ? "default" : "outline"}
                  onClick={() => setActiveSection("companies")}
                  className="justify-start"
                >
                  <Building2 className="mr-2 h-4 w-4" />
                  Companies
                </Button>
                <Button
                  variant={activeSection === "docs" ? "default" : "outline"}
                  onClick={() => setActiveSection("docs")}
                  className="justify-start"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Documentation
                </Button>
              </>
            ) : null}
            <Button
              variant={activeSection === "release-updates" ? "default" : "outline"}
              onClick={() => setActiveSection("release-updates")}
              className="justify-start"
            >
              <Megaphone className="mr-2 h-4 w-4" />
              Release Updates
            </Button>
          </div>
        </div>

        {activeSection === "companies" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="card-elevated rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Total companies</p>
                <p className="mt-1 text-2xl font-semibold">{companies.length}</p>
              </div>
              <div className="card-elevated rounded-lg p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Active companies</p>
                <p className="mt-1 text-2xl font-semibold">{activeCompanyCount}</p>
              </div>
            </div>

            <div className="card-elevated rounded-lg p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-medium">Signed up companies</h2>
                <Button variant="outline" size="sm" onClick={fetchCompanies} disabled={isLoadingCompanies}>
                  {isLoadingCompanies ? "Refreshing..." : "Refresh"}
                </Button>
              </div>

              <Input
                placeholder="Search by company, email, phone, or plan"
                value={companySearch}
                onChange={(event) => setCompanySearch(event.target.value)}
                className="mb-3"
              />

              <div className="space-y-2">
                {isLoadingCompanies ? (
                  <p className="text-sm text-muted-foreground">Loading companies...</p>
                ) : filteredCompanies.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No companies match your search.</p>
                ) : (
                  filteredCompanies.map((company) => (
                    <div key={company.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{company.company_name || "Unnamed company"}</p>
                          <p className="text-sm text-muted-foreground">{company.company_email || "No email"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-border px-2 py-1 text-xs text-muted-foreground">
                            {company.pricing_plan || company.pricing_tier || "No plan"}
                          </span>
                          {company.pricing_plan === "free" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={upgradingCompanyId === company.id}
                              onClick={() => handleManualUpgrade(company)}
                            >
                              {upgradingCompanyId === company.id ? "Upgrading..." : "Mark upgraded"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>Phone: {company.company_phone || "Not set"}</p>
                        <p>
                          Created: {company.created_at ? new Date(company.created_at).toLocaleDateString() : "Unknown"}
                        </p>
                        <p>Account ID: {company.id}</p>
                        <p>Status: {company.is_active === false ? "Inactive" : "Active"}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}

        {activeSection === "docs" ? (
          <>
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
                    {isSaving ? (editingDocId ? "Saving..." : "Uploading...") : editingDocId ? "Save changes" : "Upload"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="card-elevated rounded-lg p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-medium">Existing documentation pages</h2>
                <Button variant="outline" size="sm" onClick={fetchDocs} disabled={isLoadingDocs}>
                  {isLoadingDocs ? "Refreshing..." : "Refresh"}
                </Button>
              </div>

              <div className="space-y-3">
                {isLoadingDocs ? (
                  <p className="text-sm text-muted-foreground">Loading pages...</p>
                ) : docs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No documentation pages uploaded yet.</p>
                ) : (
                  docs.map((doc) => (
                    <div key={doc.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">/{doc.slug}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditDoc(doc)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteDoc(doc)}
                            disabled={isDeletingId === doc.id}
                          >
                            {isDeletingId === doc.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                      {doc.summary ? <p className="mt-2 text-sm text-muted-foreground">{doc.summary}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}

        {activeSection === "release-updates" ? (
          <>
            <div className="card-elevated rounded-lg p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-medium">{editingReleaseUpdateId ? "Edit release update" : "New release update"}</h2>
                {editingReleaseUpdateId ? (
                  <Button variant="outline" size="sm" onClick={resetReleaseUpdateForm}>
                    Cancel edit
                  </Button>
                ) : null}
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="release-title">Title</Label>
                  <Input
                    id="release-title"
                    placeholder="New dashboard improvements"
                    value={releaseTitle}
                    onChange={(event) => setReleaseTitle(event.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="release-description">Description</Label>
                  <Textarea
                    id="release-description"
                    placeholder="Summarize the update in one clear paragraph."
                    value={releaseDescription}
                    onChange={(event) => setReleaseDescription(event.target.value)}
                    className="min-h-20"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="release-highlights">Highlights (one per line)</Label>
                  <Textarea
                    id="release-highlights"
                    placeholder="Added release popups&#10;Admin can define updates&#10;Read state is now tracked per user"
                    value={releaseHighlights}
                    onChange={(event) => setReleaseHighlights(event.target.value)}
                    className="min-h-24"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="release-version">Version</Label>
                    <Input
                      id="release-version"
                      placeholder="2026.04.29"
                      value={releaseVersion}
                      onChange={(event) => setReleaseVersion(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="release-date">Release Date</Label>
                    <Input
                      id="release-date"
                      type="date"
                      value={releaseDate}
                      onChange={(event) => setReleaseDate(event.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="release-cta-label">Action Label (optional)</Label>
                    <Input
                      id="release-cta-label"
                      placeholder="Leave blank to use Mark as Read"
                      value={releaseCtaLabel}
                      onChange={(event) => setReleaseCtaLabel(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="release-cta-href">Action Link (optional)</Label>
                    <Input
                      id="release-cta-href"
                      placeholder="/tutorial"
                      value={releaseCtaHref}
                      onChange={(event) => setReleaseCtaHref(event.target.value)}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={releasePublished}
                    onChange={(event) => setReleasePublished(event.target.checked)}
                  />
                  Published (eligible to show in-app)
                </label>

                <div className="pt-1">
                  <Button onClick={handleSaveReleaseUpdate} disabled={isSavingReleaseUpdate}>
                    <Megaphone className="mr-1 h-4 w-4" />
                    {isSavingReleaseUpdate ? "Saving..." : editingReleaseUpdateId ? "Save changes" : "Create update"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="card-elevated rounded-lg p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="font-medium">Existing release updates</h2>
                <Button variant="outline" size="sm" onClick={fetchReleaseUpdates} disabled={isLoadingReleaseUpdates}>
                  {isLoadingReleaseUpdates ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
              <div className="space-y-3">
                {isLoadingReleaseUpdates ? (
                  <p className="text-sm text-muted-foreground">Loading release updates...</p>
                ) : releaseUpdates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No release updates yet.</p>
                ) : (
                  releaseUpdates.map((update) => (
                    <div key={update.id} className="rounded-lg border border-border bg-background p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{update.title}</p>
                          <p className="text-xs text-muted-foreground">
                            Version {update.version} • {update.released_at} • {update.is_published ? "Published" : "Draft"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEditReleaseUpdate(update)}>
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteReleaseUpdate(update)}
                            disabled={deletingReleaseUpdateId === update.id}
                          >
                            {deletingReleaseUpdateId === update.id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        ) : null}
      </main>

      <MobileNav />
    </div>
  );
}
