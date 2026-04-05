import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Phone, UserPlus, Trash2, Copy, CircleCheck as CheckCircle2, CircleAlert as AlertCircle, CreditCard as Edit, Pencil } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { isMissingRelationError } from "@/lib/supabaseErrors";

interface AccountMember {
  id: string;
  user_id: string;
  role: AppRole;
  joined_at: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface MockCrewProfile {
  id: string;
  full_name: string;
  phone: string | null;
  role: "crew_lead" | "crew_member";
  created_at: string;
}

const roleLabels: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales: 'Sales',
  crew_lead: 'Crew Lead',
  crew_member: 'Crew Member',
};

const roleBadgeColors: Record<AppRole, string> = {
  owner: 'bg-purple-500',
  admin: 'bg-blue-500',
  sales: 'bg-green-500',
  crew_lead: 'bg-orange-500',
  crew_member: 'bg-gray-500',
};

export default function SettingsCrewManagement() {
  const navigate = useNavigate();
  const { currentAccount, user, role: currentUserRole } = useAuth();
  const queryClient = useQueryClient();
  const [copiedCode, setCopiedCode] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<AccountMember | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<AccountMember | null>(null);
  const [newRole, setNewRole] = useState<AppRole | "">("");
  const [mockProfileToEdit, setMockProfileToEdit] = useState<MockCrewProfile | { id?: string } | null>(null);
  const [mockProfileToRemove, setMockProfileToRemove] = useState<MockCrewProfile | null>(null);
  const [mockProfileName, setMockProfileName] = useState("");
  const [mockProfilePhone, setMockProfilePhone] = useState("");
  const [mockProfileRole, setMockProfileRole] = useState<"crew_lead" | "crew_member">("crew_member");

  const { data: members, isLoading } = useQuery({
    queryKey: ['account-members', currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data: membersData, error: membersError } = await supabase
        .from('account_members')
        .select('id, user_id, role, joined_at')
        .eq('account_id', currentAccount.id)
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

      if (membersError) throw membersError;
      if (!membersData || membersData.length === 0) return [];

      const userIds = membersData.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(
        (profiles || []).map(p => [p.user_id, p])
      );

      return membersData.map(member => ({
        id: member.id,
        user_id: member.user_id,
        role: member.role,
        joined_at: member.joined_at,
        full_name: profilesMap.get(member.user_id)?.full_name || null,
        email: profilesMap.get(member.user_id)?.email || null,
        phone: profilesMap.get(member.user_id)?.phone || null,
      })) as AccountMember[];
    },
    enabled: !!currentAccount,
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('account_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-members'] });
      toast.success('Member removed from company');
      setMemberToRemove(null);
    },
    onError: (error: Error) => {
      toast.error('Failed to remove member: ' + error.message);
    },
  });

  const { data: mockProfiles, isLoading: isMockProfilesLoading } = useQuery({
    queryKey: ['mock-crew-profiles', currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount?.id) return [];

      const { data, error } = await supabase
        .from("mock_crew_profiles")
        .select("id, full_name, phone, role, created_at")
        .eq("account_id", currentAccount.id)
        .order("created_at", { ascending: false });

      const tableMissing = isMissingRelationError(error, "mock_crew_profiles");
      if (error && !tableMissing) throw error;

      return (data || []) as MockCrewProfile[];
    },
    enabled: !!currentAccount?.id,
  });

  const upsertMockProfileMutation = useMutation({
    mutationFn: async () => {
      if (!currentAccount?.id) throw new Error("Missing company account");
      if (!mockProfileName.trim()) throw new Error("Name is required");

      if (mockProfileToEdit?.id) {
        const { error } = await supabase
          .from("mock_crew_profiles")
          .update({
            full_name: mockProfileName.trim(),
            phone: mockProfilePhone.trim() || null,
            role: mockProfileRole,
          })
          .eq("id", mockProfileToEdit.id)
          .eq("account_id", currentAccount.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase
        .from("mock_crew_profiles")
        .insert({
          account_id: currentAccount.id,
          full_name: mockProfileName.trim(),
          phone: mockProfilePhone.trim() || null,
          role: mockProfileRole,
        });
      if (error) {
        if (isMissingRelationError(error, "mock_crew_profiles")) {
          throw new Error("Mock crew profiles are unavailable until the latest database migration is applied.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-crew-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success(mockProfileToEdit ? "Mock crew profile updated" : "Mock crew profile added");
      setMockProfileToEdit(null);
      setMockProfileName("");
      setMockProfilePhone("");
      setMockProfileRole("crew_member");
    },
    onError: (error: Error) => {
      toast.error("Failed to save mock crew profile: " + error.message);
    },
  });

  const removeMockProfileMutation = useMutation({
    mutationFn: async (mockProfileId: string) => {
      const { error } = await supabase
        .from("mock_crew_profiles")
        .delete()
        .eq("id", mockProfileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mock-crew-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      toast.success("Mock crew profile removed");
      setMockProfileToRemove(null);
    },
    onError: (error: Error) => {
      toast.error("Failed to remove mock crew profile: " + error.message);
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, role }: { memberId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('account_members')
        .update({ role })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-members'] });
      toast.success('Member role updated');
      setMemberToEdit(null);
      setNewRole("");
    },
    onError: (error: Error) => {
      toast.error('Failed to update role: ' + error.message);
    },
  });

  const handleCopyInviteCode = () => {
    if (currentAccount?.invite_code) {
      navigator.clipboard.writeText(currentAccount.invite_code);
      setCopiedCode(true);
      toast.success('Invite code copied to clipboard');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleRemoveMember = () => {
    if (memberToRemove) {
      removeMemberMutation.mutate(memberToRemove.id);
    }
  };

  const handleEditRole = (member: AccountMember) => {
    setMemberToEdit(member);
    setNewRole(member.role);
  };

  const handleUpdateRole = () => {
    if (memberToEdit && newRole && newRole !== memberToEdit.role) {
      updateRoleMutation.mutate({ memberId: memberToEdit.id, role: newRole as AppRole });
    } else {
      setMemberToEdit(null);
      setNewRole("");
    }
  };

  const openCreateMockProfile = () => {
    setMockProfileToEdit({});
    setMockProfileName("");
    setMockProfilePhone("");
    setMockProfileRole("crew_member");
  };

  const openEditMockProfile = (profile: MockCrewProfile) => {
    setMockProfileToEdit(profile);
    setMockProfileName(profile.full_name || "");
    setMockProfilePhone(profile.phone || "");
    setMockProfileRole(profile.role || "crew_member");
  };

  const handleSaveMockProfile = () => {
    upsertMockProfileMutation.mutate();
  };

  const handleRemoveMockProfile = () => {
    if (!mockProfileToRemove) return;
    removeMockProfileMutation.mutate(mockProfileToRemove.id);
  };

  const canManageMembers = currentAccount && user;
  const isOwner = currentUserRole === 'owner';

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Crew Management"
        subtitle="Manage team members and their roles"
        showBack
        backTo="/settings"
      />
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite New Members
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Share this company code with new members to join your team:
              </p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-lg p-4 font-mono text-lg font-semibold">
                  {currentAccount?.invite_code || 'Loading...'}
                </div>
                <Button
                  onClick={handleCopyInviteCode}
                  variant="outline"
                  size="lg"
                  disabled={!currentAccount?.invite_code}
                >
                  {copiedCode ? (
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                  ) : (
                    <Copy className="h-5 w-5 mr-2" />
                  )}
                  {copiedCode ? 'Copied!' : 'Copy Code'}
                </Button>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">How to invite members:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Share the company code with your team members</li>
                    <li>They create an account at the signup page</li>
                    <li>They enter this code and select their role</li>
                    <li>They'll immediately have access to the company</li>
                  </ol>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Signed Team Members ({members?.length || 0})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !members || members.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No team members yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Share your invite code to add members
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          {member.full_name || 'Unknown'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {member.email || 'No email'}
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {member.phone}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${roleBadgeColors[member.role]} text-white`}
                          >
                            {roleLabels[member.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(member.joined_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isOwner && member.user_id !== user?.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditRole(member)}
                                title="Edit role"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {canManageMembers && member.user_id !== user?.id && member.role !== 'owner' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setMemberToRemove(member)}
                                title="Remove member"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Mock Crew Profiles ({mockProfiles?.length || 0})</CardTitle>
            <Button onClick={openCreateMockProfile} size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Add Mock Profile
            </Button>
          </CardHeader>
          <CardContent>
            {isMockProfilesLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !mockProfiles || mockProfiles.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-muted-foreground">No mock crew profiles yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add unsigned crew so you can assign them to jobs now.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockProfiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.full_name}</TableCell>
                        <TableCell>
                          {profile.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              {profile.phone}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${roleBadgeColors[profile.role]} text-white`}>
                            {roleLabels[profile.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(profile.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditMockProfile(profile)}
                              title="Edit profile"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMockProfileToRemove(profile)}
                              title="Remove profile"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!memberToEdit} onOpenChange={(open) => {
        if (!open) {
          setMemberToEdit(null);
          setNewRole("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member Role</DialogTitle>
            <DialogDescription>
              Change the role for {memberToEdit?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={newRole}
                onValueChange={(value) => setNewRole(value as AppRole)}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-500 text-white">Owner</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500 text-white">Admin</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="sales">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500 text-white">Sales</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="crew_lead">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500 text-white">Crew Lead</Badge>
                    </div>
                  </SelectItem>
                  <SelectItem value="crew_member">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-gray-500 text-white">Crew Member</Badge>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {memberToEdit?.role === 'owner' && newRole !== 'owner' && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-semibold">Warning</p>
                    <p>Removing owner status from this member will reduce their permissions.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMemberToEdit(null);
                setNewRole("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateRole}
              disabled={!newRole || newRole === memberToEdit?.role || updateRoleMutation.isPending}
            >
              {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!memberToRemove} onOpenChange={(open) => !open && setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.full_name} from your company?
              They will lose access to all company data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMember}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove Member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={Boolean(mockProfileToEdit)}
        onOpenChange={(open) => {
          if (!open) {
            setMockProfileToEdit(null);
            setMockProfileName("");
            setMockProfilePhone("");
            setMockProfileRole("crew_member");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mockProfileToEdit?.id ? "Edit Mock Crew Profile" : "Add Mock Crew Profile"}</DialogTitle>
            <DialogDescription>
              Use mock profiles to assign unsigned crew members to job schedules.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mock-profile-name">Name</Label>
              <Input
                id="mock-profile-name"
                value={mockProfileName}
                onChange={(event) => setMockProfileName(event.target.value)}
                placeholder="e.g. Alex - Seasonal Crew"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mock-profile-phone">Phone (optional)</Label>
              <Input
                id="mock-profile-phone"
                value={mockProfilePhone}
                onChange={(event) => setMockProfilePhone(event.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mock-profile-role">Role</Label>
              <Select
                value={mockProfileRole}
                onValueChange={(value) => setMockProfileRole(value as "crew_lead" | "crew_member")}
              >
                <SelectTrigger id="mock-profile-role">
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crew_lead">Crew Lead</SelectItem>
                  <SelectItem value="crew_member">Crew Member</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMockProfileToEdit(null);
                setMockProfileName("");
                setMockProfilePhone("");
                setMockProfileRole("crew_member");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveMockProfile}
              disabled={!mockProfileName.trim() || upsertMockProfileMutation.isPending}
            >
              {upsertMockProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!mockProfileToRemove} onOpenChange={(open) => !open && setMockProfileToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Mock Crew Profile</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {mockProfileToRemove?.full_name}? Existing mock assignments for this profile will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMockProfile}
              className="bg-destructive hover:bg-destructive/90"
            >
              Remove Profile
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <MobileNav />
    </div>
  );
}
