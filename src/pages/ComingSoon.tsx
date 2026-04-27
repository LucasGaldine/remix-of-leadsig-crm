import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

export default function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-muted/30">
      <main className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-4 py-12">
        <section className="w-full rounded-2xl border bg-card p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">LeadSig</p>
          <h1 className="mt-3 text-3xl font-semibold text-foreground">Coming Soon</h1>
          <p className="mt-3 text-base text-muted-foreground">
            We&apos;re putting the finishing touches on this experience.
          </p>
          <div className="mt-6">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}
