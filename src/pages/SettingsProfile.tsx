import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Camera, Save, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona Time (MST)" },
];

export default function SettingsProfile() {
  const navigate = useNavigate();
  const { user, profile, role, currentAccount, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    timezone: "America/New_York",
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const formatRole = (role: string | null) => {
    if (!role) return "N/A";
    const roleMap: Record<string, string> = {
      owner: "Owner",
      admin: "Administrator",
      sales: "Sales",
      crew_lead: "Crew Lead",
    };
    return roleMap[role] || role;
  };

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        email: profile.email || user?.email || "",
        phone: profile.phone || "",
        timezone: profile.timezone || "America/New_York",
      });

      setAvatarUrl(profile.avatar_url || null);
    }
  }, [profile, user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          timezone: formData.timezone,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      toast.success("Password changed successfully");
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }

    if (!user) return;

    setDeleting(true);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account`;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No valid session found. Please sign in again.');
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete account');
      }

      await supabase.auth.signOut();
      toast.success("Account deleted successfully");
      navigate("/auth");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete account");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
      setDeleteConfirmText("");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("profiles")
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: urlData.publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(urlData.publicUrl);
      await refreshProfile();
      toast.success("Profile photo updated");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Profile Settings"
        showBack
        backTo="/settings"
        showNotifications={false}
      />

      <main className="px-4 py-6 space-y-6">
        {/* Profile Photo */}
        <div className="card-elevated rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Profile Photo</h3>
          <div className="flex items-center gap-4">
            <div className="relative">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center">
                  <User className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              {uploadingAvatar && (
                <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                  <div className="animate-spin h-6 w-6 border-2 border-white border-t-transparent rounded-full" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors">
                  <Camera className="h-4 w-4" />
                  Change Photo
                </div>
              </Label>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
                disabled={uploadingAvatar}
              />
              <p className="text-xs text-muted-foreground mt-1">
                JPG, PNG or GIF. Max 5MB.
              </p>
            </div>
          </div>
        </div>

        {/* Account & Role Information */}
        <div className="card-elevated rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Account Information</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <div className="px-3 py-2 bg-secondary rounded-md text-sm">
                {formatRole(role)}
              </div>
            </div>
            {currentAccount && (
              <div className="space-y-2">
                <Label>Company</Label>
                <div className="px-3 py-2 bg-secondary rounded-md text-sm">
                  {currentAccount.company_name}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Personal Information */}
        <div className="card-elevated rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Personal Information</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) =>
                  setFormData({ ...formData, full_name: e.target.value })
                }
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="(555) 555-5555"
              />
            </div>
          </div>
        </div>

        {/* Timezone */}
        <div className="card-elevated rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Time Zone</h3>
          <div className="space-y-2">
            <Label htmlFor="timezone">Default Time Zone</Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) =>
                setFormData({ ...formData, timezone: value })
              }
            >
              <SelectTrigger id="timezone">
                <SelectValue placeholder="Select timezone" />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Used for scheduling and notifications
            </p>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSaveProfile}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? (
            "Saving..."
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>

        {/* Change Password */}
        <div className="card-elevated rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Change Password</h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) =>
                  setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                }
                placeholder="Enter new password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    confirmPassword: e.target.value,
                  })
                }
                placeholder="Confirm new password"
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword}
              variant="outline"
              className="w-full"
            >
              {changingPassword ? "Changing Password..." : "Change Password"}
            </Button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card-elevated rounded-lg p-6 border-2 border-destructive/20">
          <div className="flex items-start gap-3 mb-4">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-semibold text-lg text-destructive">Danger Zone</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Once you delete your account, there is no going back. Please be certain.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setShowDeleteDialog(true)}
            variant="destructive"
            className="w-full"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Account
          </Button>
        </div>
      </main>

      <MobileNav />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This action cannot be undone. This will permanently delete your account
                and remove all of your data from our servers.
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-confirm" className="text-foreground font-medium">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm:
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleting || deleteConfirmText !== "DELETE"}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
