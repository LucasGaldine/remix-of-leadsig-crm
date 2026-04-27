import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, PlayCircle } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  completeOnboardingTutorial,
  markOnboardingPlanPending,
  ONBOARDING_PLAN_STORAGE_KEY,
} from "@/lib/onboarding";
import { onboardingSlides } from "@/lib/onboardingContent";

export default function Tutorial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentIndex, setCurrentIndex] = useState(0);

  const isReplay = searchParams.get("source") === "search";
  const currentSlide = onboardingSlides[currentIndex];
  const isLastSlide = currentIndex === onboardingSlides.length - 1;
  const progressValue = ((currentIndex + 1) / onboardingSlides.length) * 100;

  const subtitle = useMemo(() => {
    return isReplay ? "Replay the walkthrough anytime" : "Quick walkthrough before you get started";
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
        <div className="mx-auto flex w-full max-w-[var(--content-max-width)] items-center justify-between gap-4 px-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Step {currentIndex + 1} of {onboardingSlides.length}
            </p>
            <div className="mt-2 h-2 w-52 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>

          <Button variant="ghost" onClick={handleSkip}>
            Skip tutorial
          </Button>
        </div>

        <section className="w-full">
          <div className="space-y-5 rounded-2xl border border-border/70 bg-card p-6 shadow-sm md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary">
              <PlayCircle className="h-4 w-4" />
              Product walkthrough
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-semibold tracking-tight">{currentSlide.title}</h2>
              <p className="text-base text-muted-foreground">{currentSlide.description}</p>
            </div>

            <ul className="space-y-3">
              {currentSlide.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3 text-sm leading-6 text-foreground/90">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {onboardingSlides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    aria-label={`Go to ${slide.title}`}
                    aria-pressed={index === currentIndex}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${
                      index === currentIndex ? "w-10 bg-primary" : "w-2.5 bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={currentIndex === 0}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                {isLastSlide ? (
                  <Button onClick={handleFinish}>
                    <Check className="mr-2 h-4 w-4" />
                    Finish tutorial
                  </Button>
                ) : (
                  <Button onClick={() => setCurrentIndex((index) => Math.min(onboardingSlides.length - 1, index + 1))}>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
