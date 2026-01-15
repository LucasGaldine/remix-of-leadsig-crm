import { MobileNav } from "@/components/layout/MobileNav";
import { PageHeader } from "@/components/layout/PageHeader";

export default function Jobs() {
  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Jobs" />

      <main className="flex items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-2">Coming Soon</h2>
          <p className="text-muted-foreground">This feature is under development</p>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
