import { Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/hooks/useAuth";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { GoogleCalendarAutoSync } from "@/components/routing/GoogleCalendarAutoSync";

const queryClient = new QueryClient();

export function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <GoogleCalendarAutoSync />
          <Outlet />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
