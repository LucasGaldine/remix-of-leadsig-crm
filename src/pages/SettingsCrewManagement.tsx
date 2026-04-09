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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { isMissingRelationError } from "@/lib/supabaseErrors";
import { CREW_DESCRIPTION_MAX_LENGTH, normalizeCrewDescription } from "@/lib/crewDescription";
import {
  fetchAccountMembersWithDescriptionFallback,
  updateAccountMemberWithDescriptionFallback,
} from "@/lib/accountMembers";
import { CrewRoleSelect } from "@/components/crew/CrewRoleSelect";
import { crewOnlyRoles, roleBadgeColors, roleLabels } from "@/lib/crewRoles";

interface AccountMember {
  id: string;
  user_id: string;
  role: AppRole;
  joined_at: string;
  description: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface MockCrewProfile {
  id: string;
  full_name: string;
  phone: string | null;
  description: string | null;
  role: "crew_lead" | "crew_member";
  created_at: string;
}

export default function SettingsCrewManagement() {
  const navigate = useNavigate();
  const { currentAccount, user, role: currentUserRole } = useAuth();
  const queryClient = useQueryClient();
  const [copiedCode, setCopiedCode] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<AccountMember | null>(null);
  const [memberToEdit, setMemberToEdit] = useState<AccountMember | null>(null);
  const [newRole, setNewRole] = useState<AppRole | "">("");
  const [memberDescription, setMemberDescription] = useState("");
  const [mockProfileToEdit, setMockProfileToEdit] = useState<MockCrewProfile | { id?: string } | null>(null);
  const [mockProfileToRemove, setMockProfileToRemove] = useState<MockCrewProfile | null>(null);
  const [mockProfileName, setMockProfileName] = useState("");
  const [mockProfilePhone, setMockProfilePhone] = useState("");
  const [mockProfileDescription, setMockProfileDescription] = useState("");
  const [mockProfileRole, setMockProfileRole] = useState<"crew_lead" | "crew_member">("crew_member");

  const { data: members, isLoading } = useQuery({
    queryKey: ['account-members', currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const membersData = await fetchAccountMembersWithDescriptionFallback(async (includeDescription) => {
        const columns = includeDescription
          ? "id, user_id, role, joined_at, description"
          : "id, user_id, role, joined_at";

        return supabase
          .from('account_members')
          .select(columns)
          .eq('account_id', currentAccount.id)
          .eq('is_active', true)
          .order('joined_at', { ascending: false });
      });

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
        description: member.description || null,
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
        .select("id, full_name, phone, description, role, created_at")
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
            description: normalizeCrewDescription(mockProfileDescription),
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
          description: normalizeCrewDescription(mockProfileDescription),
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
      setMockProfileDescription("");
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

  const updateMemberMutation = useMutation({
    mutationFn: async ({
      memberId,
      updates,
    }: {
      memberId: string;
      updates: { role?: AppRole; description?: string | null };
    }) => {
      if (Object.keys(updates).length > 0) {
        await updateAccountMemberWithDescriptionFallback(async (updatePayload) => {
          const { error } = await supabase
            .from('account_members')
            .update(updatePayload)
            .eq('id', memberId);
          return { error };
        }, updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-members'] });
      toast.success('Member updated');
      setMemberToEdit(null);
      setNewRole("");
      setMemberDescription("");
    },
    onError: (error: Error) => {
      toast.error('Failed to update member: ' + error.message);
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
    setMemberDescription(member.description || "");
  };

  const handleUpdateMember = () => {
    if (!memberToEdit) return;

    const updates: { role?: AppRole; description?: string | null } = {};

    if (isOwner && newRole && newRole !== memberToEdit.role) {
      updates.role = newRole as AppRole;
    }

    if (normalizeCrewDescription(memberDescription) !== normalizeCrewDescription(memberToEdit.description)) {
      updates.description = normalizeCrewDescription(memberDescription);
    }

    if (Object.keys(updates).length === 0) {
      setMemberToEdit(null);
      setNewRole("");
      setMemberDescription("");
      return;
    }

    updateMemberMutation.mutate({
      memberId: memberToEdit.id,
      updates,
    });
  };

  const openCreateMockProfile = () => {
    setMockProfileToEdit({});
    setMockProfileName("");
    setMockProfilePhone("");
    setMockProfileDescription("");
    setMockProfileRole("crew_member");
  };

  const openEditMockProfile = (profile: MockCrewProfile) => {
    setMockProfileToEdit(profile);
    setMockProfileName(profile.full_name || "");
    setMockProfilePhone(profile.phone || "");
    setMockProfileDescription(profile.description || "");
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
  const canEditMemberDetails = currentUserRole === 'owner' || currentUserRole === 'admin';
  const hasMemberRoleChange = Boolean(memberToEdit && newRole && newRole !== memberToEdit.role);
  const hasMemberDescriptionChange =
    Boolean(memberToEdit) &&
    normalizeCrewDescription(memberDescription) !== normalizeCrewDescription(memberToEdit?.description);

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
                <Table className="table-fixed min-w-[1100px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Name</TableHead>
                      <TableHead className="w-[280px]">Email</TableHead>
                      <TableHead className="w-[180px]">Phone</TableHead>
                      <TableHead className="w-[280px]">Description</TableHead>
                      <TableHead className="w-[140px]">Role</TableHead>
                      <TableHead className="w-[140px]">Joined</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium whitespace-nowrap">
                          {member.full_name || 'Unknown'}
                        </TableCell>
                        <TableCell className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{member.email || 'No email'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="min-w-0">
                          {member.phone ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate">{member.phone}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[280px] truncate">
                          {member.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${roleBadgeColors[member.role]} whitespace-nowrap text-white`}
                          >
                            {roleLabels[member.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(member.joined_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canEditMemberDetails && member.user_id !== user?.id && (
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
                <Table className="table-fixed min-w-[920px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[220px]">Name</TableHead>
                      <TableHead className="w-[180px]">Phone</TableHead>
                      <TableHead className="w-[280px]">Description</TableHead>
                      <TableHead className="w-[140px]">Role</TableHead>
                      <TableHead className="w-[140px]">Created</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mockProfiles.map((profile) => (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium whitespace-nowrap">{profile.full_name}</TableCell>
                        <TableCell className="min-w-0">
                          {profile.phone ? (
                            <div className="flex items-center gap-2 min-w-0">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span className="truncate">{profile.phone}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[280px] truncate">
                          {profile.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`${roleBadgeColors[profile.role]} whitespace-nowrap text-white`}>
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
          setMemberDescription("");
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              Update details for {memberToEdit?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isOwner && (
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <CrewRoleSelect
                  id="role"
                  value={newRole}
                  onValueChange={(value) => setNewRole(value as AppRole)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="member-description">Short Description (optional)</Label>
              <Textarea
                id="member-description"
                value={memberDescription}
                onChange={(event) => setMemberDescription(event.target.value.slice(0, CREW_DESCRIPTION_MAX_LENGTH))}
                placeholder="e.g. Handles detail finishing and shrub shaping"
              />
              <p className="text-xs text-muted-foreground text-right">
                {memberDescription.length}/{CREW_DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
            {isOwner && memberToEdit?.role === 'owner' && newRole !== 'owner' && (
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
                setMemberDescription("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateMember}
              disabled={(!hasMemberRoleChange && !hasMemberDescriptionChange) || updateMemberMutation.isPending}
            >
              {updateMemberMutation.isPending ? "Updating..." : "Save Changes"}
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
            setMockProfileDescription("");
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
              <Label htmlFor="mock-profile-description">Short Description (optional)</Label>
              <Textarea
                id="mock-profile-description"
                value={mockProfileDescription}
                onChange={(event) => setMockProfileDescription(event.target.value.slice(0, CREW_DESCRIPTION_MAX_LENGTH))}
                placeholder="e.g. Seasonal cleanup and mulch installs"
              />
              <p className="text-xs text-muted-foreground text-right">
                {mockProfileDescription.length}/{CREW_DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mock-profile-role">Role</Label>
              <CrewRoleSelect
                id="mock-profile-role"
                value={mockProfileRole}
                roles={crewOnlyRoles}
                onValueChange={(value) => setMockProfileRole(value as "crew_lead" | "crew_member")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMockProfileToEdit(null);
                setMockProfileName("");
                setMockProfilePhone("");
                setMockProfileDescription("");
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
