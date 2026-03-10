import { ReactNode } from "react";
import { DesktopNav } from "./DesktopNav";
import { MobileNav } from "./MobileNav";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <>
      <DesktopNav />
      <div className="min-h-screen bg-surface-sunken pb-24 md:pb-0 md:ml-64">
        {children}
        <MobileNav />
      </div>
    </>
  );
}
