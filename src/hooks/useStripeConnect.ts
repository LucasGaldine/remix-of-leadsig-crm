import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface StripeConnectStatus {
  connected: boolean;
  status: "not_connected" | "pending" | "action_required" | "active";
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements?: string[];
  account_email?: string;
  stripe_user_id?: string;
}

export function useStripeConnect() {
  const [status, setStatus] = useState<StripeConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("stripe-connect-status");

      if (error) {
        console.error("Error checking Stripe status:", error);
        setStatus({
          connected: false,
          status: "not_connected",
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
        });
        return;
      }

      setStatus(data);
    } catch (err) {
      console.error("Error checking Stripe status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const startOnboarding = useCallback(async () => {
    try {
      setConnecting(true);
      const { data, error } = await supabase.functions.invoke("stripe-oauth-connect");

      if (error) {
        toast.error("Failed to start Stripe connection");
        console.error("OAuth error:", error);
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Error starting OAuth:", err);
      toast.error("Failed to start Stripe connection");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      const { error } = await supabase.functions.invoke("stripe-oauth-disconnect");

      if (error) {
        toast.error("Failed to disconnect Stripe");
        console.error("Disconnect error:", error);
        return;
      }

      toast.success("Stripe account disconnected");
      checkStatus();
    } catch (err) {
      console.error("Error disconnecting:", err);
      toast.error("Failed to disconnect Stripe");
    }
  }, [checkStatus]);

  const openDashboard = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-dashboard");

      if (error) {
        toast.error("Failed to open Stripe dashboard");
        console.error("Dashboard error:", error);
        return;
      }

      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Error opening dashboard:", err);
      toast.error("Failed to open Stripe dashboard");
    }
  }, []);

  const createPaymentSession = useCallback(async (params: {
    amount: number;
    invoiceId: string;
    customerId: string;
    jobId?: string;
    customerEmail?: string;
    customerName?: string;
    description?: string;
  }) => {
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-payment", {
        body: params,
      });

      if (error) {
        const errorMsg = error.message || "Failed to create payment session";
        toast.error(errorMsg);
        console.error("Payment error:", error);
        return null;
      }

      return data;
    } catch (err) {
      console.error("Error creating payment session:", err);
      toast.error("Failed to create payment session");
      return null;
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    status,
    loading,
    connecting,
    checkStatus,
    startOnboarding,
    disconnect,
    openDashboard,
    createPaymentSession,
    isReady: status?.connected && status?.charges_enabled,
  };
}
