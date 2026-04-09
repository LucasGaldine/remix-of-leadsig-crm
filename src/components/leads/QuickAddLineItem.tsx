import { useState } from "react";
import { PlusCircle, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { LineItemTemplate } from "@/lib/lineItemTemplates";

interface QuickAddLineItemProps {
  templates: LineItemTemplate[];
  onApply: (template: LineItemTemplate) => void;
}

function formatTemplatePrice(value: string): string {
  const parsed = parseFloat(value || "0");
  if (!Number.isFinite(parsed)) return "0.00";
  return parsed.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function QuickAddLineItem({ templates, onApply }: QuickAddLineItemProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground h-7 px-2"
        onClick={() => setOpen(true)}
      >
        <PlusCircle className="h-3.5 w-3.5" />
        Use Template
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md [&>button]:hidden">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle>Use Template</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                aria-label="Manage templates"
                onClick={() => {
                  setOpen(false);
                  navigate("/settings/pricing-rules");
                }}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription>
              Pick a line item template to autofill this row.
            </DialogDescription>
          </DialogHeader>

          {templates.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No templates yet. Use <span className="font-medium text-foreground">Save as template</span> on any line item first.
            </div>
          ) : (
            <div className="space-y-2 max-h-[252px] overflow-y-auto pr-1">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    onApply(template);
                    setOpen(false);
                  }}
                  className="w-full p-3 rounded-lg border border-border text-left hover:border-primary hover:bg-primary/5 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">{template.name}</div>
                      {template.description ? (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-medium text-foreground">${formatTemplatePrice(template.unit_price)}</div>
                      <div className="text-[11px] text-muted-foreground">/{template.unit || "each"}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Tip: Open any line item and click <span className="font-medium text-foreground">Save as template</span> to add reusable templates.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
