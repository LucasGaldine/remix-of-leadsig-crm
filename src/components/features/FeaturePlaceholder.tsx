import { ArrowLeft, Clock, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FeaturePlaceholderProps {
  title: string;
  description: string;
  whatItDoes: string[];
  whatYouCanDoNow: string[];
  unlockInfo?: string;
  backTo: string;
  backLabel?: string;
  icon?: React.ReactNode;
  ctaLabel?: string;
  ctaAction?: () => void;
  alternativeAction?: {
    label: string;
    onClick: () => void;
  };
}

export function FeaturePlaceholder({
  title,
  description,
  whatItDoes,
  whatYouCanDoNow,
  unlockInfo,
  backTo,
  backLabel = "Go Back",
  icon,
  ctaLabel,
  ctaAction,
  alternativeAction,
}: FeaturePlaceholderProps) {
  const navigate = useNavigate();

  const handleContactSupport = () => {
    window.open("mailto:support@leadsig.ai?subject=Feature Request: " + title, "_blank");
  };

  return (
    <div className="min-h-screen bg-surface-sunken">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3">
        <button
          onClick={() => navigate(backTo)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors min-h-touch"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>{backLabel}</span>
        </button>
      </div>

      <main className="px-4 py-6 max-w-lg mx-auto">
        {/* Icon & Title */}
        <div className="text-center mb-6">
          <div className={cn(
            "inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4",
            "bg-primary/10"
          )}>
            {icon || <Clock className="h-8 w-8 text-primary" />}
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
          <p className="text-muted-foreground">{description}</p>
        </div>

        {/* What This Feature Does */}
        <div className="bg-card rounded-lg border border-border p-4 mb-4">
          <h2 className="font-semibold text-foreground mb-3">What this feature will do</h2>
          <ul className="space-y-2">
            {whatItDoes.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* What You Can Do Now */}
        <div className="bg-card rounded-lg border border-border p-4 mb-4">
          <h2 className="font-semibold text-foreground mb-3">What you can do today</h2>
          <ul className="space-y-2">
            {whatYouCanDoNow.map((item, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-status-confirmed mt-0.5">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Unlock Info */}
        {unlockInfo && (
          <div className="bg-muted/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-muted-foreground text-center">{unlockInfo}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          {ctaAction && ctaLabel && (
            <Button className="w-full" onClick={ctaAction}>
              {ctaLabel}
            </Button>
          )}
          
          {alternativeAction && (
            <Button 
              variant="outline" 
              className="w-full"
              onClick={alternativeAction.onClick}
            >
              {alternativeAction.label}
            </Button>
          )}

          <Button 
            variant="ghost" 
            className="w-full gap-2"
            onClick={handleContactSupport}
          >
            <Mail className="h-4 w-4" />
            Contact Support
          </Button>

          <Button 
            variant="ghost" 
            className="w-full"
            onClick={() => navigate(backTo)}
          >
            {backLabel}
          </Button>
        </div>
      </main>
    </div>
  );
}
