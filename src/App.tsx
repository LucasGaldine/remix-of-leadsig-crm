import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createBrowserRouter, RouterProvider, Outlet, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppKeyboardShortcuts } from "@/components/layout/AppKeyboardShortcuts";
import { shouldAnimateMainPageTransition } from "@/lib/pageTransition";
import { supabaseConfigError } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Schedule from "./pages/Schedule";
import Analytics from "./pages/Analytics";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Settings from "./pages/Settings";
import Payments from "./pages/Payments";
import Inbox from "./pages/Inbox";
import EstimateDetail from "./pages/EstimateDetail";
import InvoiceDetail from "./pages/InvoiceDetail";
import ChargePayment from "./pages/ChargePayment";
import CreateEstimate from "./pages/CreateEstimate";
import CreateInvoice from "./pages/CreateInvoice";
import PaymentDetail from "./pages/PaymentDetail";
import StripeSettings from "./pages/StripeSettings";
import ApiKeys from "./pages/ApiKeys";
import LeadSources from "./pages/LeadSources";
import LeadsPendingApproval from "./pages/LeadsPendingApproval";
import LeadsRejected from "./pages/LeadsRejected";
import SettingsProfile from "./pages/SettingsProfile";
import SettingsCompanyProfile from "./pages/SettingsCompanyProfile";
import SettingsServiceArea from "./pages/SettingsServiceArea";
import SettingsMinJobSize from "./pages/SettingsMinJobSize";
import SettingsAvailability from "./pages/SettingsAvailability";
import SettingsCrewManagement from "./pages/SettingsCrewManagement";
import SettingsAutoResponses from "./pages/SettingsAutoResponses";
import SettingsLeadAutomations from "./pages/SettingsLeadAutomations";
import SettingsNotifications from "./pages/SettingsNotifications";
import SettingsPricingRules from "./pages/SettingsPricingRules";
import SettingsDashboard from "./pages/SettingsDashboard";
import SettingsPricing from "./pages/SettingsPricing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import StripeCallback from "./pages/StripeCallback";
import FacebookCallback from "./pages/FacebookCallback";
import NotFound from "./pages/NotFound";
import CrewDashboard from "./pages/CrewDashboard";
import EstimateApproval from "./pages/EstimateApproval";
import ClientJobPortal from "./pages/ClientJobPortal";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import SmsConsent from "./pages/SmsConsent";
import DataDeletion from "./pages/DataDeletion";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Tutorial from "./pages/Tutorial";
import OnboardingSource from "./pages/OnboardingSource";
import OnboardingProfile from "./pages/OnboardingProfile";
import OnboardingImport from "./pages/OnboardingImport";
import OnboardingPlan from "./pages/OnboardingPlan";
import AffiliateSignup from "./pages/AffiliateSignup";
import Admin from "./pages/Admin";
import Website from "./pages/Website";
import SitePage from "./pages/SitePage";

const queryClient = new QueryClient();

function RootLayout() {
  if (supabaseConfigError) {
    return (
      <div className="min-h-screen bg-background px-6 py-10 text-foreground">
        <div className="mx-auto w-full max-w-2xl rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-xl font-semibold">Local setup required</h1>
          <p className="mt-3 text-sm text-muted-foreground">{supabaseConfigError}</p>
          <p className="mt-3 text-sm text-muted-foreground">
            Add these variables to a local <code>.env</code> file, then restart the dev server.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {`VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Outlet />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppKeyboardShortcuts />
      <MainPageTransition>{children}</MainPageTransition>
    </ProtectedRoute>
  );
}

function MainPageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const previousPathRef = useRef<string | null>(null);
  const frameRef = useRef<number | null>(null);
  const [routeNeedsTransition, setRouteNeedsTransition] = useState(false);
  const [playTransition, setPlayTransition] = useState(false);
  const [transitionNonce, setTransitionNonce] = useState(0);

  const shouldAnimate = shouldAnimateMainPageTransition(location.pathname, previousPathRef.current);

  const clearFrame = () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
  };

  const playRouteTransition = () => {
    clearFrame();
    requestAnimationFrame(() => {
      setTransitionNonce((value) => value + 1);
      setPlayTransition(true);
    });
  };

  useEffect(() => {
    clearFrame();

    if (shouldAnimate) {
      setRouteNeedsTransition(true);
      setPlayTransition(false);
      frameRef.current = window.requestAnimationFrame(() => {
        playRouteTransition();
      });
    } else {
      setRouteNeedsTransition(false);
      setPlayTransition(false);
    }

    previousPathRef.current = location.pathname;
    return () => {
      clearFrame();
    };
  }, [location.pathname]);

  const shouldRenderAnimation = playTransition && routeNeedsTransition;

  if (!shouldRenderAnimation) return <>{children}</>;

  return (
    <>
      {children}
      <div key={`${location.key}-${transitionNonce}`} className="main-page-transition-overlay" aria-hidden />
    </>
  );
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/auth", element: <Auth /> },
      { path: "/signup/elo", element: <Auth signupVariant="elo" /> },
      { path: "/reset-password", element: <ResetPassword /> },
      { path: "/approve-estimate", element: <EstimateApproval /> },
      { path: "/client/job", element: <ClientJobPortal /> },
      { path: "/privacy", element: <PrivacyPolicy /> },
      { path: "/privacy-policy", element: <PrivacyPolicy /> },
      { path: "/terms", element: <TermsOfService /> },
      { path: "/sms-consent", element: <SmsConsent /> },
      { path: "/data-deletion", element: <DataDeletion /> },
      { path: "/affiliate", element: <AffiliateSignup /> },
      { path: "/site/:accountId", element: <SitePage /> },
      { path: "/onboarding/source", element: <Protected><OnboardingSource /></Protected> },
      { path: "/onboarding/profile", element: <Protected><OnboardingProfile /></Protected> },
      { path: "/onboarding/import", element: <Protected><OnboardingImport /></Protected> },
      { path: "/onboarding/plan", element: <Protected><OnboardingPlan /></Protected> },
      { path: "/tutorial", element: <Protected><Tutorial /></Protected> },
      { path: "/stripe-callback", element: <Protected><StripeCallback /></Protected> },
      { path: "/facebook-callback", element: <Protected><FacebookCallback /></Protected> },
      { path: "/", element: <Protected><Index /></Protected> },
      { path: "/analytics", element: <Protected><Analytics /></Protected> },
      { path: "/schedule", element: <Protected><Schedule /></Protected> },
      { path: "/leads", element: <Protected><Leads /></Protected> },
      { path: "/leads/pending-approval", element: <Protected><LeadsPendingApproval /></Protected> },
      { path: "/leads/rejected", element: <Protected><LeadsRejected /></Protected> },
      { path: "/leads/:id", element: <Protected><LeadDetail /></Protected> },
      { path: "/jobs", element: <Protected><Jobs /></Protected> },
      { path: "/jobs/:id", element: <Protected><JobDetail /></Protected> },
      { path: "/crew", element: <Protected><CrewDashboard /></Protected> },
      { path: "/settings", element: <Protected><Settings /></Protected> },
      { path: "/settings/stripe", element: <Protected><StripeSettings /></Protected> },
      { path: "/settings/api-keys", element: <Protected><ApiKeys /></Protected> },
      { path: "/settings/lead-sources", element: <Protected><LeadSources /></Protected> },
      { path: "/settings/profile", element: <Protected><SettingsProfile /></Protected> },
      { path: "/settings/company", element: <Protected><SettingsCompanyProfile /></Protected> },
      { path: "/settings/service-area", element: <Protected><SettingsServiceArea /></Protected> },
      { path: "/settings/min-job-size", element: <Protected><SettingsMinJobSize /></Protected> },
      { path: "/settings/availability", element: <Protected><SettingsAvailability /></Protected> },
      { path: "/settings/crew", element: <Protected><SettingsCrewManagement /></Protected> },
      { path: "/settings/auto-responses", element: <Protected><SettingsAutoResponses /></Protected> },
      { path: "/settings/lead-automations", element: <Protected><SettingsLeadAutomations /></Protected> },
      { path: "/settings/notifications", element: <Protected><SettingsNotifications /></Protected> },
      { path: "/settings/pricing-rules", element: <Protected><SettingsPricingRules /></Protected> },
      { path: "/settings/dashboard", element: <Protected><SettingsDashboard /></Protected> },
      { path: "/settings/pricing", element: <Protected><SettingsPricing /></Protected> },
      { path: "/payments", element: <Protected><Payments /></Protected> },
      { path: "/inbox", element: <Protected><Inbox /></Protected> },
      { path: "/payments/estimates/new", element: <Protected><CreateEstimate /></Protected> },
      { path: "/payments/estimates/:id", element: <Protected><EstimateDetail /></Protected> },
      { path: "/payments/invoices/new", element: <Protected><CreateInvoice /></Protected> },
      { path: "/payments/invoices/:id", element: <Protected><InvoiceDetail /></Protected> },
      { path: "/payments/charge", element: <Protected><ChargePayment /></Protected> },
      { path: "/payments/:id", element: <Protected><PaymentDetail /></Protected> },
      { path: "/customers", element: <Protected><Customers /></Protected> },
      { path: "/customers/:id", element: <Protected><CustomerDetail /></Protected> },
      { path: "/admin", element: <Protected><Admin /></Protected> },
      { path: "/website", element: <Protected><Website /></Protected> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const App = () => <RouterProvider router={router} />;

export default App;
