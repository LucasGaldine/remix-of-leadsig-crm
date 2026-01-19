import { useState, useEffect } from "react";
import { ArrowLeft, Check, Copy, ChevronDown, ChevronUp, Loader2, RefreshCw, Mail, Webhook, ExternalLink, Key } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";

type Platform = "facebook" | "google" | "angi" | "yelp" | "thumbtack";
type ConnectionStatus = "not_connected" | "connected" | "needs_attention";
type ConnectionMethod = "oauth" | "email_relay" | "webhook";

interface LeadSourceConnection {
  id: string;
  platform: Platform;
  status: ConnectionStatus;
  connected_at: string | null;
  last_sync_at: string | null;
  api_key_id: string | null;
  inbound_email: string | null;
  connection_method: ConnectionMethod | null;
}

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
}

interface PlatformInfo {
  id: Platform;
  name: string;
  description: string;
  icon: React.ReactNode;
  connectionMethod: ConnectionMethod;
  oauthSupported: boolean;
}

const platforms: PlatformInfo[] = [
  {
    id: "facebook",
    name: "Facebook Leads",
    description: "Capture leads from Meta Lead Forms & Ads",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
    connectionMethod: "oauth",
    oauthSupported: true,
  },
  {
    id: "google",
    name: "Google Leads",
    description: "Google Business Profile & Google Ads leads",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    ),
    connectionMethod: "oauth",
    oauthSupported: true,
  },
  {
    id: "angi",
    name: "Angi",
    description: "Receive Angi leads directly in LeadSig",
    icon: (
      <div className="h-6 w-6 rounded bg-[#FF6138] flex items-center justify-center text-white font-bold text-sm">
        A
      </div>
    ),
    connectionMethod: "email_relay",
    oauthSupported: false,
  },
  {
    id: "yelp",
    name: "Yelp",
    description: "Connect Yelp lead requests",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#D32323">
        <path d="M21.111 18.226c-.141.969-2.119 3.483-3.029 3.847-.311.124-.611.094-.849-.09-.169-.131-.259-.239-1.069-1.627-.585-1.004-1.016-1.754-1.277-2.222l-.016-.028c-.163-.291-.229-.515-.2-.682.048-.283.268-.486.659-.612 1.661-.535 2.788-.864 3.38-1.01.26-.059.446-.073.597-.037.255.057.418.231.495.528.097.389.309 1.345.309 1.933zM11.217 15.238c-.058.079-.198.152-.427.221-1.019.312-2.451.756-4.33 1.369l-.046.015c-.333.107-.589.125-.785.047-.337-.134-.47-.492-.425-1.073.092-1.163.16-2.389.205-3.664l.003-.077c.014-.314.079-.536.205-.672.199-.21.514-.233.942-.072.179.066 1.604.717 4.227 1.937.213.099.356.195.423.293.115.168.108.384-.016.642-.089.171-.313.528-.676.749l.7.285zM8.762 7.94c.233.012.408.085.527.215 1.354 1.472 2.418 2.614 3.207 3.459l.051.055c.219.234.336.455.35.661.018.355-.226.609-.736.769-.304.094-1.311.355-3.023.793l-.082.021c-.303.077-.534.096-.707.055-.293-.07-.459-.286-.513-.647-.026-.18-.138-1.666-.328-4.438-.015-.224.007-.398.074-.519.112-.203.331-.318.655-.352.185-.019.375-.069.525-.072zm2.722-6.037c.212-.048.392-.03.544.053.259.141 3.349 2.016 3.666 2.716.112.247.103.483-.024.716-.073.135-.134.223-.871 1.168l-.014.018c-.536.689-.925 1.188-1.161 1.492-.112.145-.222.252-.331.32-.22.135-.466.124-.736-.032-.193-.11-.404-.287-.623-.513l-.059-.062c-.786-.84-1.949-2.099-3.471-3.747-.12-.13-.2-.256-.236-.378-.061-.202-.009-.407.158-.613l.023-.028c.248-.31 1.67-1.038 3.135-1.11zM7.073 17.269l.011-.046c.238-.924.392-1.665.478-2.199.082-.501.092-.873.031-1.118-.162-.649-.751-1.079-1.769-1.288-.539-.112-1.339-.219-2.396-.321l-.078-.007c-.406-.038-.706-.021-.917.055-.36.128-.529.437-.515.925.013.478.06 1.189.14 2.133.096 1.139.191 1.927.286 2.363.065.299.148.517.25.657.172.235.42.327.745.283.187-.026.398-.098.636-.22.198-.101 1.074-.606 2.649-1.515a.776.776 0 0 0 .449-.702z"/>
      </svg>
    ),
    connectionMethod: "email_relay",
    oauthSupported: false,
  },
  {
    id: "thumbtack",
    name: "Thumbtack",
    description: "Import Thumbtack customer requests",
    icon: (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="#009FD9">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 9.596l-6.12 6.12a.749.749 0 0 1-1.061 0L7.106 12.11a.75.75 0 1 1 1.06-1.06l3.077 3.076 5.59-5.59a.75.75 0 0 1 1.061 1.06z"/>
      </svg>
    ),
    connectionMethod: "email_relay",
    oauthSupported: false,
  },
];

const generateInboundEmail = (userId: string): string => {
  const shortId = userId.slice(0, 8);
  return `leads+${shortId}@inbound.leadsig.ai`;
};

export default function LeadSources() {
  const navigate = useNavigate();
  const { user, currentAccount } = useAuth();

  const [connections, setConnections] = useState<LeadSourceConnection[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [testing, setTesting] = useState<Platform | null>(null);

  const [connectDialog, setConnectDialog] = useState<{
    open: boolean;
    platform: PlatformInfo | null;
    method: ConnectionMethod;
    inboundEmail: string;
    apiKey: string | null;
    apiKeyId: string | null;
    copied: "email" | "key" | null;
  }>({
    open: false,
    platform: null,
    method: "email_relay",
    inboundEmail: "",
    apiKey: null,
    apiKeyId: null,
    copied: null,
  });

  const [oauthComingSoonDialog, setOauthComingSoonDialog] = useState<{
    open: boolean;
    platform: PlatformInfo | null;
  }>({
    open: false,
    platform: null,
  });

  const [disconnectDialog, setDisconnectDialog] = useState<{
    open: boolean;
    platform: PlatformInfo | null;
  }>({
    open: false,
    platform: null,
  });

  const [successOpen, setSuccessOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, [user, currentAccount]);

  const fetchData = async () => {
    if (!user || !currentAccount) return;

    const [connectionsRes, keysRes] = await Promise.all([
      supabase
        .from("lead_source_connections")
        .select("*")
        .eq("account_id", currentAccount.id),
      supabase
        .from("api_keys")
        .select("id, name, key_prefix, is_active")
        .eq("account_id", currentAccount.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
    ]);

    if (connectionsRes.error) {
      console.error("Error fetching connections:", connectionsRes.error);
    } else {
      setConnections((connectionsRes.data as LeadSourceConnection[]) || []);
    }

    if (keysRes.error) {
      console.error("Error fetching API keys:", keysRes.error);
    } else {
      setApiKeys(keysRes.data || []);
    }

    setLoading(false);
  };

  const getConnection = (platform: Platform): LeadSourceConnection | undefined => {
    return connections.find((c) => c.platform === platform);
  };

  const getWebhookUrl = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    return `${supabaseUrl}/functions/v1/leads-inbound`;
  };

  const generateApiKey = (): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let key = "lsig_";
    for (let i = 0; i < 40; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  };

  const hashApiKey = async (key: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const handleConnect = async (platform: PlatformInfo) => {
    if (!user) return;

    if (platform.id === "google") {
      await handleConnectWebhook(platform);
      return;
    }

    if (platform.oauthSupported) {
      setOauthComingSoonDialog({ open: true, platform });
      return;
    }

    const inboundEmail = generateInboundEmail(user.id);

    setConnectDialog({
      open: true,
      platform,
      method: "email_relay",
      inboundEmail,
      apiKey: null,
      apiKeyId: null,
      copied: null,
    });
  };

  const handleConnectWebhook = async (platform: PlatformInfo) => {
    if (!user || !currentAccount) return;

    const existingKey = apiKeys.find(key =>
      key.name === `${platform.name} Integration` && key.is_active
    );

    setConnectDialog({
      open: true,
      platform,
      method: "webhook",
      inboundEmail: "",
      apiKey: null,
      apiKeyId: existingKey?.id || null,
      copied: null,
    });
  };

  const handleGenerateNewApiKey = async () => {
    if (!user || !currentAccount || !connectDialog.platform) return;

    const platform = connectDialog.platform;

    const existingKeys = apiKeys.filter(key =>
      key.name === `${platform.name} Integration`
    );

    if (existingKeys.length > 0) {
      const { error: deleteError } = await supabase
        .from("api_keys")
        .delete()
        .in("id", existingKeys.map(k => k.id));

      if (deleteError) {
        console.error("Error deleting old API keys:", deleteError);
        toast.error("Failed to delete old API keys");
        return;
      }
    }

    const newApiKey = generateApiKey();
    const keyHash = await hashApiKey(newApiKey);
    const keyPrefix = newApiKey.slice(0, 12);

    const { data: createdKey, error } = await supabase
      .from("api_keys")
      .insert({
        user_id: user.id,
        account_id: currentAccount.id,
        name: `${platform.name} Integration`,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        is_active: true,
      })
      .select("id, name, key_prefix, is_active")
      .single();

    if (error) {
      console.error("Error creating API key:", error);
      toast.error("Failed to create API key");
      return;
    }

    sessionStorage.setItem('leadsig_debug_api_key', newApiKey);
    toast.success("New API key generated");

    setConnectDialog(prev => ({
      ...prev,
      apiKey: newApiKey,
      apiKeyId: createdKey.id,
    }));

    const updatedKeys = apiKeys.filter(key =>
      key.name !== `${platform.name} Integration`
    );
    setApiKeys([createdKey, ...updatedKeys]);
  };

  const handleConnectViaEmailRelay = async (platform: PlatformInfo) => {
    if (!user) return;

    const inboundEmail = generateInboundEmail(user.id);

    setOauthComingSoonDialog({ open: false, platform: null });
    setConnectDialog({
      open: true,
      platform,
      method: "email_relay",
      inboundEmail,
      apiKey: null,
      apiKeyId: null,
      copied: null,
    });
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(connectDialog.inboundEmail);
      setConnectDialog((prev) => ({ ...prev, copied: "email" }));
      toast.success("Email copied!");
      setTimeout(() => {
        setConnectDialog((prev) => ({ ...prev, copied: null }));
      }, 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleConfirmEmailRelayConnection = async () => {
    if (!user || !currentAccount || !connectDialog.platform) return;

    const platform = connectDialog.platform;

    const { error } = await supabase
      .from("lead_source_connections")
      .upsert({
        user_id: user.id,
        account_id: currentAccount.id,
        platform: platform.id,
        status: "connected",
        connected_at: new Date().toISOString(),
        inbound_email: connectDialog.inboundEmail,
        connection_method: "email_relay",
      }, {
        onConflict: "user_id,platform",
      });

    if (error) {
      console.error("Error creating connection:", error);
      toast.error("Failed to connect");
      return;
    }

    setConnectDialog({
      open: false,
      platform: null,
      method: "email_relay",
      inboundEmail: "",
      apiKey: null,
      apiKeyId: null,
      copied: null,
    });
    setSuccessOpen(true);
    fetchData();
  };

  const handleConfirmWebhookConnection = async () => {
    if (!user || !currentAccount || !connectDialog.platform || !connectDialog.apiKeyId) return;

    const platform = connectDialog.platform;

    const { error } = await supabase
      .from("lead_source_connections")
      .upsert({
        user_id: user.id,
        account_id: currentAccount.id,
        platform: platform.id,
        status: "connected",
        connected_at: new Date().toISOString(),
        api_key_id: connectDialog.apiKeyId,
        connection_method: "webhook",
      }, {
        onConflict: "user_id,platform",
      });

    if (error) {
      console.error("Error creating connection:", error);
      toast.error("Failed to connect");
      return;
    }

    setConnectDialog({
      open: false,
      platform: null,
      method: "webhook",
      inboundEmail: "",
      apiKey: null,
      apiKeyId: null,
      copied: null,
    });
    setSuccessOpen(true);
    fetchData();
  };

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(getWebhookUrl());
      toast.success("Webhook URL copied!");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleCopyApiKey = async () => {
    if (!connectDialog.apiKey) return;
    try {
      await navigator.clipboard.writeText(connectDialog.apiKey);
      setConnectDialog((prev) => ({ ...prev, copied: "key" }));
      toast.success("API key copied!");
      setTimeout(() => {
        setConnectDialog((prev) => ({ ...prev, copied: null }));
      }, 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDisconnect = async () => {
    if (!user || !currentAccount || !disconnectDialog.platform) return;

    const { error } = await supabase
      .from("lead_source_connections")
      .update({ status: "not_connected" })
      .eq("account_id", currentAccount.id)
      .eq("platform", disconnectDialog.platform.id);

    if (error) {
      console.error("Error disconnecting:", error);
      toast.error("Failed to disconnect");
    } else {
      toast.success("Disconnected successfully");
      fetchData();
    }

    setDisconnectDialog({ open: false, platform: null });
  };

  const handleTestConnection = async (platform: PlatformInfo) => {
    if (!user || !currentAccount) return;

    setTesting(platform.id);

    try {
      const { data, error } = await supabase.functions.invoke("leads-test-connection", {
        body: {
          platform: platform.id,
          userId: user.id,
          accountId: currentAccount.id,
        },
      });

      if (error) {
        console.error("Test connection error:", error);
        toast.error("Test failed: " + (error.message || "Unknown error"));
      } else if (data?.success) {
        toast.success("Test successful! Check your Leads tab for the test lead.");

        await supabase
          .from("lead_source_connections")
          .update({ last_sync_at: new Date().toISOString() })
          .eq("account_id", currentAccount.id)
          .eq("platform", platform.id);

        fetchData();
      } else {
        toast.error("Test failed: " + (data?.error || "Unknown error"));
      }
    } catch (err) {
      console.error("Test connection error:", err);
      toast.error("Test failed. Please try again.");
    }

    setTesting(null);
  };

  const getStatusDot = (status: ConnectionStatus | undefined) => {
    switch (status) {
      case "connected":
        return <span className="h-2.5 w-2.5 rounded-full bg-status-confirmed" />;
      case "needs_attention":
        return <span className="h-2.5 w-2.5 rounded-full bg-status-attention" />;
      default:
        return <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />;
    }
  };

  const getStatusLabel = (status: ConnectionStatus | undefined) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "needs_attention":
        return "Needs attention";
      default:
        return "Not connected";
    }
  };

  const getMethodIcon = (method: ConnectionMethod | null) => {
    switch (method) {
      case "email_relay":
        return <Mail className="h-3.5 w-3.5" />;
      case "webhook":
        return <Webhook className="h-3.5 w-3.5" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">Lead Sources</h1>
            <p className="text-sm text-muted-foreground">Connect your lead platforms</p>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-3">
            {platforms.map((platform) => {
              const connection = getConnection(platform.id);
              const isConnected = connection?.status === "connected";

              return (
                <div
                  key={platform.id}
                  className="card-elevated rounded-lg p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                      {platform.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">{platform.name}</h3>
                        {getStatusDot(connection?.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {platform.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                    {isConnected ? (
                      <>
                        <div className="flex items-center gap-1.5 text-sm text-status-confirmed mr-auto">
                          <Check className="h-4 w-4" />
                          <span>{getStatusLabel(connection?.status)}</span>
                          {connection?.connection_method && (
                            <span className="flex items-center gap-1 text-muted-foreground text-xs">
                              ({getMethodIcon(connection.connection_method)} {connection.connection_method === "email_relay" ? "Email" : "Webhook"})
                            </span>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConnection(platform)}
                          disabled={testing === platform.id}
                        >
                          {testing === platform.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          )}
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={() => setDisconnectDialog({ open: true, platform })}
                        >
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        className="ml-auto"
                        onClick={() => handleConnect(platform)}
                      >
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="mt-6">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-muted-foreground">
              <span className="text-sm">Advanced: Webhook integration</span>
              {advancedOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="card-elevated rounded-lg p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                For advanced users: Connect any platform using webhooks, Zapier, or Make.
              </p>
              <div>
                <p className="text-sm font-medium mb-2">Webhook Endpoint</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                    POST {getWebhookUrl()}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await navigator.clipboard.writeText(getWebhookUrl());
                      toast.success("Copied!");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Required Headers</p>
                <div className="text-xs bg-muted p-2 rounded font-mono space-y-1">
                  <p>x-leadsig-api-key: {"<your-api-key>"}</p>
                  <p>Content-Type: application/json</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Example Payload</p>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
{`{
  "source": "facebook",
  "name": "John Doe",
  "phone": "555-123-4567",
  "email": "john@example.com",
  "serviceType": "Pavers",
  "location": "Miami, FL",
  "budget": 5000,
  "message": "Need a new patio"
}`}
                </pre>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => navigate("/settings/api-keys")}
              >
                Manage API Keys
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </main>

      <Dialog
        open={oauthComingSoonDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setOauthComingSoonDialog({ open: false, platform: null });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {oauthComingSoonDialog.platform?.icon}
              Connect {oauthComingSoonDialog.platform?.name}
            </DialogTitle>
            <DialogDescription>
              Native integration is coming soon
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium mb-2">Direct connection coming soon</h4>
              <p className="text-sm text-muted-foreground">
                We're working on a native {oauthComingSoonDialog.platform?.name} integration.
                In the meantime, you can connect using email forwarding.
              </p>
            </div>

            <div className="p-4 border border-border rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Use Email Relay
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Forward lead notification emails from {oauthComingSoonDialog.platform?.name} to LeadSig.
                Works with any email provider.
              </p>
              <Button
                className="w-full"
                onClick={() => handleConnectViaEmailRelay(oauthComingSoonDialog.platform!)}
              >
                Set Up Email Relay
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOauthComingSoonDialog({ open: false, platform: null })}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={connectDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setConnectDialog({
              open: false,
              platform: null,
              method: "email_relay",
              inboundEmail: "",
              apiKey: null,
              apiKeyId: null,
              copied: null,
            });
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {connectDialog.platform?.icon}
              Connect {connectDialog.platform?.name}
            </DialogTitle>
            <DialogDescription>
              {connectDialog.method === "webhook"
                ? "Set up webhook integration for Google Ads lead forms"
                : "Set up email forwarding to receive leads automatically"
              }
            </DialogDescription>
          </DialogHeader>

          {connectDialog.method === "webhook" ? (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium mb-2 text-blue-900 dark:text-blue-100">AI-Powered Lead Intelligence</h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Our AI automatically extracts and qualifies all information from your Google Ads leads. No field mapping needed!
                </p>
              </div>

              <div className="p-4 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">API Key</h4>
                  <Button
                    size="sm"
                    onClick={handleGenerateNewApiKey}
                    variant={connectDialog.apiKey ? "outline" : "default"}
                  >
                    <Key className="h-4 w-4 mr-1" />
                    {connectDialog.apiKey ? "Generate New Key" : "Generate API Key"}
                  </Button>
                </div>
                {connectDialog.apiKey ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <h4 className="font-medium mb-2 text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
                        <span className="text-lg">⚠️</span> Copy Your API Key
                      </h4>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-3">
                        Copy this key now and paste it into Google Ads. You won't be able to see it again.
                      </p>
                      <div className="flex items-center gap-2 p-3 bg-background rounded-lg border">
                        <code className="flex-1 text-sm break-all font-mono">
                          {connectDialog.apiKey}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCopyApiKey}
                        >
                          {connectDialog.copied === "key" ? (
                            <Check className="h-4 w-4 text-status-confirmed" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : connectDialog.apiKeyId ? (
                  <p className="text-sm text-muted-foreground">
                    You have an existing API key. Generate a new one to see and copy it.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Click "Generate API Key" to create a key for this integration.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Setup Instructions</h4>
                <ol className="text-sm space-y-3 list-decimal list-inside">
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">Sign in to your Google Ads account</span>
                  </li>
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">Create or edit a lead form campaign</span>
                  </li>
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">In your lead form settings, scroll to "Webhook integration (optional)"</span>
                  </li>
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">Enter your webhook details:</span>
                    <div className="ml-6 mt-2 space-y-3">
                      <div>
                        <p className="text-xs font-medium mb-1">Webhook URL</p>
                        <div className="flex items-center gap-2 p-2 bg-muted rounded border">
                          <code className="flex-1 text-xs break-all">
                            {getWebhookUrl()}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={handleCopyWebhookUrl}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {connectDialog.apiKey && (
                        <div>
                          <p className="text-xs font-medium mb-1">Key</p>
                          <div className="flex items-center gap-2 p-2 bg-muted rounded border">
                            <code className="flex-1 text-xs break-all">
                              {connectDialog.apiKey}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={handleCopyApiKey}
                            >
                              {connectDialog.copied === "key" ? (
                                <Check className="h-3 w-3 text-status-confirmed" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </li>
                  <li className="text-muted-foreground">
                    <span className="font-medium text-foreground">Save your lead form settings</span>
                  </li>
                </ol>
                <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-800 dark:text-green-200">
                    <span className="font-medium">✨ AI Magic:</span> Our AI automatically extracts names, emails, phone numbers, budgets, service types, and more from any form format. Leads are qualified instantly!
                  </p>
                </div>
              </div>

              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Need help? View Google's documentation
                    </span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="p-3 bg-muted rounded-lg text-sm space-y-2">
                    <p className="text-muted-foreground">
                      For detailed instructions on setting up webhooks in Google Ads lead forms, visit:
                    </p>
                    <a
                      href="https://support.google.com/google-ads/answer/7759777"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      Google Ads Lead Form Extensions Help
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Your LeadSig email address</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Forward lead emails from {connectDialog.platform?.name} to this address:
                </p>
                <div className="flex items-center gap-2 p-3 bg-background rounded-lg border">
                  <code className="flex-1 text-sm break-all font-mono">
                    {connectDialog.inboundEmail}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyEmail}
                  >
                    {connectDialog.copied === "email" ? (
                      <Check className="h-4 w-4 text-status-confirmed" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Quick setup</h4>
                <ol className="text-sm space-y-2 list-decimal list-inside text-muted-foreground">
                  <li>In your email (Gmail/Outlook), create a filter/rule for emails from {connectDialog.platform?.name}</li>
                  <li>Set the rule to forward matching emails to your LeadSig address above</li>
                </ol>
              </div>

              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
                    <span>Show detailed instructions</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="p-3 bg-muted rounded-lg text-sm space-y-3">
                    <div>
                      <p className="font-medium mb-1">Gmail:</p>
                      <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                        <li>Go to Settings → Filters and Blocked Addresses</li>
                        <li>Create a new filter with "from" containing the platform domain</li>
                        <li>Select "Forward it to" and add your LeadSig email</li>
                      </ol>
                    </div>
                    <div>
                      <p className="font-medium mb-1">Outlook:</p>
                      <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                        <li>Go to Settings → Mail → Rules</li>
                        <li>Add a new rule for emails from the platform</li>
                        <li>Set action to "Forward to" your LeadSig email</li>
                      </ol>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setConnectDialog(prev => ({ ...prev, open: false }))}
            >
              Cancel
            </Button>
            {connectDialog.method === "email_relay" ? (
              <Button onClick={handleConfirmEmailRelayConnection}>
                I've Set Up Forwarding
              </Button>
            ) : (
              <Button
                onClick={handleConfirmWebhookConnection}
                disabled={!connectDialog.apiKeyId}
              >
                Complete Setup
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connected!</DialogTitle>
          </DialogHeader>
          <div className="text-center py-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-status-confirmed/10 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-status-confirmed" />
            </div>
            <p className="text-muted-foreground mb-2">
              Your connection is set up. Test it to make sure everything works.
            </p>
            <p className="text-sm text-muted-foreground">
              New leads will appear in your Leads tab after approval.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setSuccessOpen(false)} className="w-full">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={disconnectDialog.open}
        onOpenChange={(open) => setDisconnectDialog({ open, platform: disconnectDialog.platform })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {disconnectDialog.platform?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll stop receiving leads from this source. Your existing leads won't be affected.
              You can reconnect anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisconnect}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileNav />
    </div>
  );
}
