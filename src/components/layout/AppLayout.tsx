import { ReactNode } from "react";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-sunken">
      <DesktopNav />
      <div className="md:pl-64">
        {children}
      </div>
      <MobileNav />
    </div>
  );
}
