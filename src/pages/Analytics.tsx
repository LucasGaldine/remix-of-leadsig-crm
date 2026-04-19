import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { DashboardVisuals } from "@/components/dashboard/DashboardVisuals";

export default function Analytics() {
  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Analytics" subtitle="Performance trends and business insights" />

      <main className="flex flex-col gap-8 px-4 py-4 max-w-[1200px] m-auto">
        <DashboardVisuals />
      </main>

      <MobileNav />
    </div>
  );
}
