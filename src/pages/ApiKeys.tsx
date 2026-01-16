import { useState, useEffect } from "react";
import { ArrowLeft, Plus, Copy, Trash2, Key, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export default function ApiKeys() {
  const navigate = useNavigate();
  const { user, currentAccount } = useAuth();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create key dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("Default API Key");
  const [creating, setCreating] = useState(false);
  
  // Show new key dialog
  const [showKeyOpen, setShowKeyOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  
  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);

  useEffect(() => {
    fetchApiKeys();
  }, [user, currentAccount]);

  const fetchApiKeys = async () => {
    if (!user || !currentAccount) return;

    const { data, error } = await supabase
      .from("api_keys")
      .select("id, name, key_prefix, is_active, last_used_at, created_at, expires_at")
      .eq("account_id", currentAccount.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching API keys:", error);
      toast.error("Failed to load API keys");
    } else {
      setApiKeys(data || []);
    }
    setLoading(false);
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

  const handleCreateKey = async () => {
    if (!user || !currentAccount || !newKeyName.trim()) return;

    setCreating(true);

    const apiKey = generateApiKey();
    const keyHash = await hashApiKey(apiKey);
    const keyPrefix = apiKey.slice(0, 10) + "...";

    const { error } = await supabase.from("api_keys").insert({
      user_id: user.id,
      account_id: currentAccount.id,
      name: newKeyName.trim(),
      key_hash: keyHash,
      key_prefix: keyPrefix,
      is_active: true,
    });

    if (error) {
      console.error("Error creating API key:", error);
      toast.error("Failed to create API key");
    } else {
      setNewApiKey(apiKey);
      setCreateOpen(false);
      setShowKeyOpen(true);
      setNewKeyName("Default API Key");
      fetchApiKeys();
      toast.success("API key created");
    }

    setCreating(false);
  };

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(newApiKey);
      toast.success("API key copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleRevokeKey = async () => {
    if (!keyToDelete) return;

    const { error } = await supabase
      .from("api_keys")
      .delete()
      .eq("id", keyToDelete.id);

    if (error) {
      console.error("Error revoking API key:", error);
      toast.error("Failed to revoke API key");
    } else {
      toast.success("API key revoked");
      fetchApiKeys();
    }
    
    setDeleteOpen(false);
    setKeyToDelete(null);
  };

  const handleToggleActive = async (key: ApiKey) => {
    const { error } = await supabase
      .from("api_keys")
      .update({ is_active: !key.is_active })
      .eq("id", key.id);

    if (error) {
      toast.error("Failed to update API key");
    } else {
      toast.success(key.is_active ? "API key deactivated" : "API key activated");
      fetchApiKeys();
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-lg">API Keys</h1>
            <p className="text-sm text-muted-foreground">Manage third-party integrations</p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Key
          </Button>
        </div>
      </header>

      <main className="px-4 py-4">
        {/* Info Card */}
        <div className="card-elevated rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">API Integration</h3>
              <p className="text-sm text-muted-foreground">
                Use API keys to connect third-party lead sources like Google Ads, Facebook, or Zapier. 
                Include the key in the <code className="bg-muted px-1 rounded">x-leadsig-api-key</code> header.
              </p>
            </div>
          </div>
        </div>

        {/* API Keys List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="text-center py-12">
            <Key className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">No API Keys</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create an API key to connect external lead sources.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Create API Key
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="card-elevated rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-medium">{key.name}</h4>
                    <p className="text-sm text-muted-foreground font-mono">
                      {key.key_prefix}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(key)}
                      className={key.is_active ? "text-status-confirmed" : "text-muted-foreground"}
                    >
                      {key.is_active ? "Active" : "Inactive"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setKeyToDelete(key);
                        setDeleteOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    Created {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
                  </span>
                  {key.last_used_at && (
                    <span>
                      Last used {formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Endpoint Documentation */}
        <div className="mt-6 card-elevated rounded-lg p-4">
          <h3 className="font-medium mb-3">Available Endpoints</h3>
          <div className="space-y-3 text-sm">
            <div>
              <code className="bg-muted px-2 py-1 rounded text-xs">POST /functions/v1/leads-inbound</code>
              <p className="text-muted-foreground mt-1">Create a new lead from external sources</p>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded text-xs">POST /functions/v1/leads-interactions/:leadId</code>
              <p className="text-muted-foreground mt-1">Add timeline events to a lead</p>
            </div>
            <div>
              <code className="bg-muted px-2 py-1 rounded text-xs">PATCH /functions/v1/leads-status/:leadId</code>
              <p className="text-muted-foreground mt-1">Update lead status</p>
            </div>
          </div>
        </div>
      </main>

      {/* Create Key Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Create a new API key for third-party integrations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Google Ads Integration"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateKey} disabled={creating || !newKeyName.trim()}>
              {creating ? "Creating..." : "Create Key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Show New Key Dialog */}
      <Dialog open={showKeyOpen} onOpenChange={(open) => {
        if (!open) {
          setNewApiKey("");
          setKeyVisible(false);
        }
        setShowKeyOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Key Created</DialogTitle>
            <DialogDescription>
              Copy this key now. You won't be able to see it again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <code className="flex-1 text-sm break-all">
                {keyVisible ? newApiKey : "•".repeat(45)}
              </code>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setKeyVisible(!keyVisible)}
              >
                {keyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyKey}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-start gap-2 text-sm text-status-attention">
              <AlertTriangle className="h-4 w-4 mt-0.5" />
              <span>Store this key securely. It cannot be recovered once you close this dialog.</span>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              setShowKeyOpen(false);
              setNewApiKey("");
              setKeyVisible(false);
            }}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently revoke "{keyToDelete?.name}". Any integrations using this key will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevokeKey}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MobileNav />
    </div>
  );
}
