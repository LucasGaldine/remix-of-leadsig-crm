import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Outlet } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Schedule from "./pages/Schedule";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import Settings from "./pages/Settings";
import Payments from "./pages/Payments";
import EstimateDetail from "./pages/EstimateDetail";
import InvoiceDetail from "./pages/InvoiceDetail";
import ChargePayment from "./pages/ChargePayment";
import CreateEstimate from "./pages/CreateEstimate";
import CreateInvoice from "./pages/CreateInvoice";
import PaymentDetail from "./pages/PaymentDetail";
import Materials from "./pages/Materials";
import MaterialListDetail from "./pages/MaterialListDetail";
import CreateMaterialList from "./pages/CreateMaterialList";
import CreateSupplyOrder from "./pages/CreateSupplyOrder";
import SupplyOrderDetail from "./pages/SupplyOrderDetail";
import SupplierManagement from "./pages/SupplierManagement";
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
import DataDeletion from "./pages/DataDeletion";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";

const queryClient = new QueryClient();

function RootLayout() {
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
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: "/auth", element: <Auth /> },
      { path: "/reset-password", element: <ResetPassword /> },
      { path: "/approve-estimate", element: <EstimateApproval /> },
      { path: "/client/job", element: <ClientJobPortal /> },
      { path: "/privacy", element: <PrivacyPolicy /> },
      { path: "/terms", element: <TermsOfService /> },
      { path: "/data-deletion", element: <DataDeletion /> },
      { path: "/stripe-callback", element: <Protected><StripeCallback /></Protected> },
      { path: "/facebook-callback", element: <Protected><FacebookCallback /></Protected> },
      { path: "/", element: <Protected><Index /></Protected> },
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
      { path: "/settings/notifications", element: <Protected><SettingsNotifications /></Protected> },
      { path: "/settings/pricing-rules", element: <Protected><SettingsPricingRules /></Protected> },
      { path: "/settings/dashboard", element: <Protected><SettingsDashboard /></Protected> },
      { path: "/settings/pricing", element: <Protected><SettingsPricing /></Protected> },
      { path: "/payments", element: <Protected><Payments /></Protected> },
      { path: "/payments/estimates/new", element: <Protected><CreateEstimate /></Protected> },
      { path: "/payments/estimates/:id", element: <Protected><EstimateDetail /></Protected> },
      { path: "/payments/invoices/new", element: <Protected><CreateInvoice /></Protected> },
      { path: "/payments/invoices/:id", element: <Protected><InvoiceDetail /></Protected> },
      { path: "/payments/charge", element: <Protected><ChargePayment /></Protected> },
      { path: "/payments/:id", element: <Protected><PaymentDetail /></Protected> },
      { path: "/materials", element: <Protected><Materials /></Protected> },
      { path: "/materials/lists/:id", element: <Protected><MaterialListDetail /></Protected> },
      { path: "/materials/lists/new", element: <Protected><CreateMaterialList /></Protected> },
      { path: "/materials/orders/new", element: <Protected><CreateSupplyOrder /></Protected> },
      { path: "/materials/orders/:id", element: <Protected><SupplyOrderDetail /></Protected> },
      { path: "/materials/suppliers/new", element: <Protected><SupplierManagement /></Protected> },
      { path: "/customers", element: <Protected><Customers /></Protected> },
      { path: "/customers/:id", element: <Protected><CustomerDetail /></Protected> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const App = () => <RouterProvider router={router} />;

export default App;
