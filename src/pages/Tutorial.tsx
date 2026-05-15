import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, ExternalLink, PlayCircle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  completeOnboardingTutorial,
  markOnboardingPlanPending,
  ONBOARDING_PLAN_STORAGE_KEY,
} from "@/lib/onboarding";

export default function Tutorial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const isReplay = searchParams.get("source") === "search";
  const tutorialVideoEmbedUrl = "https://www.youtube.com/embed/BqVdPVgaqqY";

  const subtitle = useMemo(() => {
    return isReplay ? "Replay the tutorial anytime" : "Watch this tutorial before you get started";
  }, [isReplay]);

  const handleFinish = () => {
    completeOnboardingTutorial();
    const planState = window.localStorage.getItem(ONBOARDING_PLAN_STORAGE_KEY);
    if (planState === null) {
      markOnboardingPlanPending();
    }
    navigate("/onboarding/plan");
  };

  const handleSkip = () => {
    handleFinish();
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-10">
      <PageHeader
        title="LeadSig Tutorial"
        subtitle={subtitle}
        showNotifications={false}
        showSearch={false}
      />

      <main className="mx-auto flex w-full max-w-[var(--content-max-width)] flex-col gap-6 px-4 py-6">
        <div className="mx-auto flex w-full max-w-[var(--content-max-width)] items-center justify-end gap-4 px-4">
          <Button variant="ghost" onClick={handleSkip}>
            Skip tutorial
          </Button>
        </div>

        <section className="w-full">
          <div className="space-y-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
              <PlayCircle className="h-4 w-4" />
              Video tutorial
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight">LeadSig Product Tutorial</h2>
              <p className="text-base text-muted-foreground">
                Watch the full walkthrough, then finish the tutorial to continue onboarding.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-border/70 bg-black/95">
              <div className="aspect-video w-full">
                <iframe
                  className="h-full w-full"
                  src={tutorialVideoEmbedUrl}
                  title="LeadSig product tutorial video"
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button asChild variant="outline">
                <a href="https://www.youtube.com/watch?v=BqVdPVgaqqY" target="_blank" rel="noreferrer">
                  Watch on YouTube
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <div className="ml-auto">
                <Button onClick={handleFinish}>
                  <Check className="mr-2 h-4 w-4" />
                  Finish tutorial
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
