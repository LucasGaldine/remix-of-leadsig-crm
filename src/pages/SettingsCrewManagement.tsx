import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, ArrowLeft, Mail, Phone, UserPlus, Trash2,
  Copy, CheckCircle2, AlertCircle
} from "lucide-react";
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
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface AccountMember {
  id: string;
  user_id: string;
  role: AppRole;
  joined_at: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
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
  const { currentAccount, user } = useAuth();
  const queryClient = useQueryClient();
  const [copiedCode, setCopiedCode] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<AccountMember | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['account-members', currentAccount?.id],
    queryFn: async () => {
      if (!currentAccount) return [];

      const { data, error } = await supabase
        .from('account_members_with_profiles')
        .select(`
          id,
          user_id,
          role,
          joined_at,
          full_name,
          email,
          phone
        `)
        .eq('account_id', currentAccount.id)
        .eq('is_active', true)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      return data as AccountMember[];
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

  const canManageMembers = currentAccount && user;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Crew Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage team members and their roles
            </p>
          </div>
        </div>

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
            <CardTitle>Team Members ({members?.length || 0})</CardTitle>
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
                          {canManageMembers && member.user_id !== user?.id && member.role !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setMemberToRemove(member)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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
    </div>
  );
}
