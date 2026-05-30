import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { createBrowserRouter, RouterProvider, Outlet, useLocation, Navigate, useRouteError, isRouteErrorResponse } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppKeyboardShortcuts } from "@/components/layout/AppKeyboardShortcuts";
import { ReleaseUpdateModal } from "@/components/modals/ReleaseUpdateModal";
import { useAuth } from "@/hooks/useAuth";
import { shouldAnimateMainPageTransition } from "@/lib/pageTransition";
import { buildAdminAppUrl, isAdminAppHostname } from "@/lib/adminDomain";
import { getLatestUnseenReleaseUpdate, markReleaseUpdateSeen, type ReleaseUpdate } from "@/lib/releaseUpdates";
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
import SettingsAvailability from "./pages/SettingsAvailability";
import SettingsCrewManagement from "./pages/SettingsCrewManagement";
import SettingsAutoResponses from "./pages/SettingsAutoResponses";
import SettingsLeadAutomations from "./pages/SettingsLeadAutomations";
import SettingsNotifications from "./pages/SettingsNotifications";
import SettingsPricingRules from "./pages/SettingsPricingRules";
import SettingsDocumentTemplates from "./pages/SettingsDocumentTemplates";
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
import SiteCareersPage from "./pages/SiteCareersPage";
import SiteCareerPositionPage from "./pages/SiteCareerPositionPage";
import Hiring from "./pages/Hiring";
import ComingSoon from "./pages/ComingSoon";
import MembershipRequired from "./pages/MembershipRequired";

const queryClient = new QueryClient();

function ExternalRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(to);
  }, [to]);

  return null;
}

function HomeRoute() {
  if (isAdminAppHostname(window.location.hostname)) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <Protected>
      <Index />
    </Protected>
  );
}

function AdminRoute() {
  const location = useLocation();

  if (!isAdminAppHostname(window.location.hostname)) {
    const target = buildAdminAppUrl(location.pathname, location.search, location.hash);
    return <ExternalRedirect to={target} />;
  }

  return (
    <Protected>
      <Admin />
    </Protected>
  );
}

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

function AppErrorBoundary() {
  const error = useRouteError();
  const errorTitle = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText || "Request failed"}`
    : "Something went wrong";
  const errorMessage = isRouteErrorResponse(error)
    ? (typeof error.data === "string" ? error.data : "The page could not be loaded.")
    : (error instanceof Error ? error.message : "An unexpected error occurred.");

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/40 backdrop-blur">
        <div className="inline-flex w-fit items-center rounded-full border border-red-400/50 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-200">
          Application Error
        </div>
        <div>
          <h1 className="text-2xl font-semibold leading-tight">{errorTitle}</h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{errorMessage}</p>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-white"
          >
            Reload page
          </button>
          <a
            href="/"
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
          >
            Return home
          </a>
        </div>
      </div>
    </div>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, currentAccount, hasActiveEloEntitlement, requiresEloEntitlementGate } = useAuth();
  const location = useLocation();
  const [activeReleaseUpdate, setActiveReleaseUpdate] = useState<ReleaseUpdate | null>(null);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);

  const isMembershipAllowedPath =
    location.pathname === "/membership-required" ||
    location.pathname === "/settings/pricing";

  if (requiresEloEntitlementGate() && !hasActiveEloEntitlement() && !isMembershipAllowedPath) {
    return <Navigate to="/membership-required" replace />;
  }

  useEffect(() => {
    if (!user?.id || !currentAccount?.id) return;

    let active = true;

    const loadReleaseUpdate = async () => {
      try {
        const latestUnseen = await getLatestUnseenReleaseUpdate(currentAccount.id, user.id);
        if (!active || !latestUnseen) return;
        setActiveReleaseUpdate(latestUnseen);
        setReleaseModalOpen(true);
      } catch (error) {
        console.error("Failed to load release updates", error);
      }
    };

    void loadReleaseUpdate();

    return () => {
      active = false;
    };
  }, [user?.id, currentAccount?.id]);

  const dismissReleaseUpdate = () => {
    setReleaseModalOpen(false);
  };

  const markReleaseUpdateAsRead = async () => {
    if (activeReleaseUpdate && user?.id) {
      try {
        await markReleaseUpdateSeen(activeReleaseUpdate.id, activeReleaseUpdate.account_id, user.id);
      } catch (error) {
        console.error("Failed to mark release update as seen", error);
      }
    }
    setReleaseModalOpen(false);
  };

  return (
    <ProtectedRoute>
      <AppKeyboardShortcuts />
      <ReleaseUpdateModal
        open={releaseModalOpen}
        update={activeReleaseUpdate}
        onLater={dismissReleaseUpdate}
        onMarkAsRead={markReleaseUpdateAsRead}
      />
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
    errorElement: <AppErrorBoundary />,
    children: [
      { path: "/auth", element: <Auth /> },
      { path: "/signup/elo", element: <Auth signupVariant="elo" /> },
      { path: "/signup/elo-growth", element: <Auth signupVariant="elo" /> },
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
      { path: "/site/:accountId/careers", element: <SiteCareersPage /> },
      { path: "/site/:accountId/careers/:roleId", element: <SiteCareerPositionPage /> },
      { path: "/onboarding/source", element: <Protected><OnboardingSource /></Protected> },
      { path: "/onboarding/profile", element: <Protected><OnboardingProfile /></Protected> },
      { path: "/onboarding/import", element: <Protected><OnboardingImport /></Protected> },
      { path: "/onboarding/plan", element: <Protected><OnboardingPlan /></Protected> },
      { path: "/tutorial", element: <Protected><Tutorial /></Protected> },
      { path: "/stripe-callback", element: <Protected><StripeCallback /></Protected> },
      { path: "/facebook-callback", element: <Protected><FacebookCallback /></Protected> },
      { path: "/", element: <HomeRoute /> },
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
      { path: "/settings/availability", element: <Protected><SettingsAvailability /></Protected> },
      { path: "/settings/crew", element: <Protected><SettingsCrewManagement /></Protected> },
      { path: "/settings/auto-responses", element: <Protected><SettingsAutoResponses /></Protected> },
      { path: "/settings/lead-automations", element: <Protected><SettingsLeadAutomations /></Protected> },
      { path: "/settings/notifications", element: <Protected><SettingsNotifications /></Protected> },
      { path: "/settings/pricing-rules", element: <Protected><SettingsPricingRules /></Protected> },
      { path: "/settings/document-templates", element: <Protected><SettingsDocumentTemplates /></Protected> },
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
      { path: "/admin", element: <AdminRoute /> },
      { path: "/website", element: <Protected><Website /></Protected> },
      { path: "/hiring", element: <Protected><Hiring /></Protected> },
      { path: "/coming-soon", element: <Protected><ComingSoon /></Protected> },
      { path: "/membership-required", element: <Protected><MembershipRequired /></Protected> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const App = () => <RouterProvider router={router} />;

export default App;
