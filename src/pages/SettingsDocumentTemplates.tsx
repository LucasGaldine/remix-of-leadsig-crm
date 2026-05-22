import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader as Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  DOCUMENT_TEMPLATE_VARIABLES,
  DOCUMENT_EMAIL_TIMING_LABELS,
  DOCUMENT_EMAIL_TIMINGS,
  type DocumentEmailTiming,
  type DocumentTemplateRecord,
  formatDocumentTemplateToken,
  normalizeDocumentTemplateSlug,
} from "@/lib/documentTemplates";
import { toast } from "sonner";

type TemplateDraft = {
  name: string;
  body: string;
  default_included_in_jobs: boolean;
  default_email_timing: DocumentEmailTiming;
  default_requires_signature: boolean;
};

const EMPTY_DRAFT: TemplateDraft = {
  name: "",
  body: "",
  default_included_in_jobs: true,
  default_email_timing: "manual",
  default_requires_signature: false,
};

export default function SettingsDocumentTemplates() {
  const { currentAccount, user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [templates, setTemplates] = useState<DocumentTemplateRecord[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY_DRAFT);
  const templateBodyRef = useRef<HTMLTextAreaElement | null>(null);

  const editingTemplate = useMemo(
    () => templates.find((template) => template.id === editingTemplateId) || null,
    [editingTemplateId, templates],
  );

  const loadTemplates = async () => {
    if (!currentAccount?.id) {
      setTemplates([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("document_templates")
      .select("id, account_id, name, slug, system_key, body, default_included_in_jobs, default_email_timing, default_requires_signature, created_by, created_at, updated_at")
      .eq("account_id", currentAccount.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to fetch document templates:", error);
      toast.error("Failed to load document templates");
      setTemplates([]);
    } else {
      setTemplates((data || []) as DocumentTemplateRecord[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    void loadTemplates();
  }, [currentAccount?.id]);

  const openCreateDialog = () => {
    setEditingTemplateId(null);
    setDraft(EMPTY_DRAFT);
    setEditorOpen(true);
  };

  const openEditDialog = (template: DocumentTemplateRecord) => {
    setEditingTemplateId(template.id);
    setDraft({
      name: template.name,
      body: template.body || "",
      default_included_in_jobs: template.default_included_in_jobs,
      default_email_timing: template.default_email_timing,
      default_requires_signature: template.default_requires_signature,
    });
    setEditorOpen(true);
  };

  const saveTemplate = async () => {
    if (!currentAccount?.id || !user?.id) {
      toast.error("No account selected");
      return;
    }

    const name = draft.name.trim();
    if (!name) {
      toast.error("Template name is required");
      return;
    }

    const slug = normalizeDocumentTemplateSlug(name);
    setIsSaving(true);

    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from("document_templates")
          .update({
            name,
            slug,
            body: draft.body,
            default_included_in_jobs: draft.default_included_in_jobs,
            default_email_timing: draft.default_email_timing,
            default_requires_signature: draft.default_requires_signature,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("document_templates")
          .insert({
            account_id: currentAccount.id,
            name,
            slug,
            system_key: null,
            body: draft.body,
            default_included_in_jobs: draft.default_included_in_jobs,
            default_email_timing: draft.default_email_timing,
            default_requires_signature: draft.default_requires_signature,
            created_by: user.id,
          });

        if (error) throw error;
      }

      await loadTemplates();
      setEditorOpen(false);
      toast.success(editingTemplate ? "Template updated" : "Template created");
    } catch (error: any) {
      const message = error?.message || "Failed to save template";
      toast.error(message.includes("document_templates_account_slug_key") ? "A template with that name already exists" : message);
    } finally {
      setIsSaving(false);
    }
  };

  const insertTemplateVariable = (key: string) => {
    const token = formatDocumentTemplateToken(key);
    const element = templateBodyRef.current;
    if (!element) {
      setDraft((previous) => ({
        ...previous,
        body: previous.body ? `${previous.body}\n${token}` : token,
      }));
      return;
    }

    const start = element.selectionStart ?? draft.body.length;
    const end = element.selectionEnd ?? start;
    const nextBody = `${draft.body.slice(0, start)}${token}${draft.body.slice(end)}`;

    setDraft((previous) => ({ ...previous, body: nextBody }));

    requestAnimationFrame(() => {
      if (!templateBodyRef.current) return;
      templateBodyRef.current.focus();
      const nextPosition = start + token.length;
      templateBodyRef.current.setSelectionRange(nextPosition, nextPosition);
    });
  };

  const deleteTemplate = async (template: DocumentTemplateRecord) => {
    if (template.system_key) {
      toast.error("Default system templates cannot be deleted");
      return;
    }

    const previousTemplates = templates;
    setTemplates((current) => current.filter((item) => item.id !== template.id));

    const { error } = await supabase
      .from("document_templates")
      .delete()
      .eq("id", template.id);

    if (!error) {
      toast.success("Template deleted");
      return;
    }

    console.error("Failed to delete template:", error);
    toast.error("Failed to delete template");
    setTemplates(previousTemplates);
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Document Templates"
        showBack
        backTo="/settings"
      />

      <main className="max-w-[var(--content-max-width)] m-auto p-6 space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Template Library
              </CardTitle>
            </div>
            <Button type="button" variant="outline" onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              New Document
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates found for this account.</p>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="rounded-lg border border-border bg-background p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{template.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(template)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void deleteTemplate(template)}
                        disabled={Boolean(template.system_key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
            <DialogDescription>
              Configure document content plus default inclusion, email timing, and signature behavior.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="document-template-name">Template Name</Label>
              <Input
                id="document-template-name"
                value={draft.name}
                onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="e.g. Lien Waiver"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-template-body">Template Body</Label>
              <Textarea
                id="document-template-body"
                rows={10}
                ref={templateBodyRef}
                value={draft.body}
                onChange={(event) => setDraft((previous) => ({ ...previous, body: event.target.value }))}
                placeholder="Paste your document template content"
              />
            </div>
            <div className="space-y-2 rounded-md border border-border/70 bg-background px-3 py-3">
              <p className="text-xs font-medium text-muted-foreground">Merge Fields (double brackets)</p>
              <p className="text-xs text-muted-foreground">
                Click to insert dynamic values like <code>[[scope_of_work]]</code>.
              </p>
              <div className="flex flex-wrap gap-2">
                {DOCUMENT_TEMPLATE_VARIABLES.map((variable) => (
                  <Button
                    key={variable.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    title={variable.description}
                    onClick={() => insertTemplateVariable(variable.key)}
                  >
                    {formatDocumentTemplateToken(variable.key)}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Add by default</span>
                <Switch
                  checked={draft.default_included_in_jobs}
                  onCheckedChange={(checked) => {
                    setDraft((previous) => ({ ...previous, default_included_in_jobs: Boolean(checked) }));
                  }}
                />
              </label>

              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Requires signature</span>
                <Switch
                  checked={draft.default_requires_signature}
                  onCheckedChange={(checked) => {
                    setDraft((previous) => ({ ...previous, default_requires_signature: Boolean(checked) }));
                  }}
                />
              </label>

              <div className="flex items-center justify-between gap-3 text-sm">
                <span>Send email timing</span>
                <Select
                  value={draft.default_email_timing}
                  onValueChange={(value: DocumentEmailTiming) => {
                    setDraft((previous) => ({ ...previous, default_email_timing: value }));
                  }}
                >
                  <SelectTrigger className="h-9 w-[200px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_EMAIL_TIMINGS.map((timing) => (
                      <SelectItem key={timing} value={timing}>
                        {DOCUMENT_EMAIL_TIMING_LABELS[timing]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="mt-4 border-t border-border bg-background pt-4">
            <div className="flex justify-end">
              <Button type="button" onClick={() => void saveTemplate()} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {editingTemplate ? "Save Changes" : "Create Template"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MobileNav />
    </div>
  );
}
