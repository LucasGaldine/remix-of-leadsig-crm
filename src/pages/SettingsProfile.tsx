import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { User, Camera, Save } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Phoenix", label: "Arizona Time (MST)" },
];

interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  newLeads: boolean;
  jobUpdates: boolean;
}

export default function SettingsProfile() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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

  const [notifications, setNotifications] = useState<NotificationPreferences>({
    email: true,
    sms: true,
    push: true,
    newLeads: true,
    jobUpdates: true,
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        email: profile.email || user?.email || "",
        phone: profile.phone || "",
        timezone: profile.timezone || "America/New_York",
      });

      if (profile.notification_preferences) {
        setNotifications(profile.notification_preferences as NotificationPreferences);
      }

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
          notification_preferences: notifications,
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

        {/* Notification Preferences */}
        <div className="card-elevated rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">Notification Preferences</h3>
          <div className="space-y-4">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Notification Channels
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-email" className="cursor-pointer flex-1">
                  Email Notifications
                </Label>
                <Switch
                  id="notif-email"
                  checked={notifications.email}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, email: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-sms" className="cursor-pointer flex-1">
                  SMS Notifications
                </Label>
                <Switch
                  id="notif-sms"
                  checked={notifications.sms}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, sms: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-push" className="cursor-pointer flex-1">
                  Push Notifications
                </Label>
                <Switch
                  id="notif-push"
                  checked={notifications.push}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, push: checked })
                  }
                />
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Event Notifications
              </p>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-new-leads" className="cursor-pointer flex-1">
                  New Leads
                </Label>
                <Switch
                  id="notif-new-leads"
                  checked={notifications.newLeads}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, newLeads: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="notif-job-updates" className="cursor-pointer flex-1">
                  Job Updates
                </Label>
                <Switch
                  id="notif-job-updates"
                  checked={notifications.jobUpdates}
                  onCheckedChange={(checked) =>
                    setNotifications({ ...notifications, jobUpdates: checked })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
