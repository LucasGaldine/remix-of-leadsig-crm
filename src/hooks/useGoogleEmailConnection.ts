import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { normalizeGoogleEmailConnectionRow } from "@/lib/googleEmailConnection";
import { useAuth } from "./useAuth";

export async function startGoogleEmailConnect(accountId: string | null, appUrl: string) {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("You must be signed in to connect Google Email");
  }

  const { data, error } = await supabase.functions.invoke("google-email-connect", {
    body: { accountId, appUrl },
  });

  if (error) throw error;
  return data;
}

export function shouldRetryGoogleEmailConnectionStatus() {
  return false;
}

export function useGoogleEmailConnection() {
  const { currentAccount } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = useMemo(
    () => ["account-google-email-connection", currentAccount?.id] as const,
    [currentAccount?.id],
  );

  const { data: connection, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!currentAccount?.id) return normalizeGoogleEmailConnectionRow(null);
      const { data, error } = await supabase.functions.invoke("google-email-status", {
        body: { accountId: currentAccount.id },
      });
      if (error) throw error;
      return normalizeGoogleEmailConnectionRow((data?.connection as Record<string, unknown> | null) ?? null);
    },
    enabled: !!currentAccount?.id,
    retry: shouldRetryGoogleEmailConnectionStatus,
  });

  useEffect(() => {
    const status = searchParams.get("google_email");
    if (!status) return;

    if (status === "connected") {
      toast.success("Google Email connected successfully");
      queryClient.invalidateQueries({ queryKey });
    } else if (status === "error") {
      const message = searchParams.get("message") || "Failed to connect Google Email";
      toast.error(message);
    }

    const next = new URLSearchParams(searchParams);
    next.delete("google_email");
    next.delete("message");
    setSearchParams(next, { replace: true });
  }, [queryClient, queryKey, searchParams, setSearchParams]);

  const connect = useMutation({
    mutationFn: async () => {
      const data = await startGoogleEmailConnect(currentAccount?.id ?? null, window.location.origin);
      if (!data?.authUrl) throw new Error("Failed to get authorization URL");
      window.location.href = data.authUrl;
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to start Google Email connection");
    },
  });

  const disconnect = useMutation({
    mutationFn: async () => {
      if (!currentAccount?.id) throw new Error("No account selected");
      const { error } = await supabase.functions.invoke("google-email-disconnect", {
        body: { accountId: currentAccount.id },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Google Email disconnected");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to disconnect Google Email");
    },
  });

  return {
    isConnected: connection?.isConnected ?? false,
    connectedEmail: connection?.connectedEmail ?? null,
    provider: connection?.provider ?? null,
    isLoading,
    isConnecting: connect.isPending,
    isDisconnecting: disconnect.isPending,
    connect: connect.mutate,
    connectAsync: connect.mutateAsync,
    disconnect: disconnect.mutate,
    disconnectAsync: disconnect.mutateAsync,
  };
}
