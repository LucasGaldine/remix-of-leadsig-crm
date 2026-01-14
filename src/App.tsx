import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
            <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
            <Route path="/leads/pending-approval" element={<ProtectedRoute><LeadsPendingApproval /></ProtectedRoute>} />
            <Route path="/leads/rejected" element={<ProtectedRoute><LeadsRejected /></ProtectedRoute>} />
            <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute><Jobs /></ProtectedRoute>} />
            <Route path="/jobs/:id" element={<ProtectedRoute><JobDetail /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/settings/stripe" element={<ProtectedRoute><StripeSettings /></ProtectedRoute>} />
            <Route path="/settings/api-keys" element={<ProtectedRoute><ApiKeys /></ProtectedRoute>} />
            <Route path="/settings/lead-sources" element={<ProtectedRoute><LeadSources /></ProtectedRoute>} />
            <Route path="/settings/profile" element={<ProtectedRoute><SettingsProfile /></ProtectedRoute>} />
            <Route path="/settings/company" element={<ProtectedRoute><SettingsCompanyProfile /></ProtectedRoute>} />
            <Route path="/settings/service-area" element={<ProtectedRoute><SettingsServiceArea /></ProtectedRoute>} />
            <Route path="/settings/min-job-size" element={<ProtectedRoute><SettingsMinJobSize /></ProtectedRoute>} />
            <Route path="/settings/availability" element={<ProtectedRoute><SettingsAvailability /></ProtectedRoute>} />
            <Route path="/settings/crew" element={<ProtectedRoute><SettingsCrewManagement /></ProtectedRoute>} />
            <Route path="/settings/auto-responses" element={<ProtectedRoute><SettingsAutoResponses /></ProtectedRoute>} />
            <Route path="/settings/notifications" element={<ProtectedRoute><SettingsNotifications /></ProtectedRoute>} />
            <Route path="/settings/pricing-rules" element={<ProtectedRoute><SettingsPricingRules /></ProtectedRoute>} />
            {/* Payments Routes */}
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/payments/estimates/new" element={<ProtectedRoute><CreateEstimate /></ProtectedRoute>} />
            <Route path="/payments/estimates/:id" element={<ProtectedRoute><EstimateDetail /></ProtectedRoute>} />
            <Route path="/payments/invoices/new" element={<ProtectedRoute><CreateInvoice /></ProtectedRoute>} />
            <Route path="/payments/invoices/:id" element={<ProtectedRoute><InvoiceDetail /></ProtectedRoute>} />
            <Route path="/payments/charge" element={<ProtectedRoute><ChargePayment /></ProtectedRoute>} />
            <Route path="/payments/:id" element={<ProtectedRoute><PaymentDetail /></ProtectedRoute>} />
            {/* Materials Routes */}
            <Route path="/materials" element={<ProtectedRoute><Materials /></ProtectedRoute>} />
            <Route path="/materials/lists/:id" element={<ProtectedRoute><MaterialListDetail /></ProtectedRoute>} />
            <Route path="/materials/lists/new" element={<ProtectedRoute><CreateMaterialList /></ProtectedRoute>} />
            <Route path="/materials/orders/new" element={<ProtectedRoute><CreateSupplyOrder /></ProtectedRoute>} />
            <Route path="/materials/orders/:id" element={<ProtectedRoute><SupplyOrderDetail /></ProtectedRoute>} />
            <Route path="/materials/suppliers/new" element={<ProtectedRoute><SupplierManagement /></ProtectedRoute>} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
