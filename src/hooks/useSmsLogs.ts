import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SmsLogEntry {
  id: string;
  event_type: string;
  phone_to: string;
  message_body: string;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useSmsLogs(limit = 10) {
  const { currentAccount } = useAuth();
  const [logs, setLogs] = useState<SmsLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchLogs = async () => {
    if (!currentAccount) return;
    setIsLoading(true);

    const { data, error } = await supabase
      .from("sms_notification_log")
      .select("id, event_type, phone_to, message_body, status, error_message, created_at")
      .eq("account_id", currentAccount.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (!error && data) {
      setLogs(data as SmsLogEntry[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [currentAccount?.id]);

  return { logs, isLoading, refetch: fetchLogs };
}
