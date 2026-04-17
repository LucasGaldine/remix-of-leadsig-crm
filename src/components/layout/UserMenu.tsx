import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, Settings, Crown, Bug } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { BugReportModal } from './BugReportModal';

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales: 'Sales',
  crew_lead: 'Crew Lead',
  crew_member: 'Crew Member',
};

const roleColors: Record<string, string> = {
  owner: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  sales: 'bg-green-500/10 text-green-500 border-green-500/20',
  crew_lead: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  crew_member: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

interface UserMenuProps {
  clickable?: boolean;
}

export function UserMenu({ clickable = true }: UserMenuProps) {
  const { user, profile, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [bugReportOpen, setBugReportOpen] = useState(false);

  if (!user) return null;

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : user.email?.[0].toUpperCase() || 'U';

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  const avatar = (
    <Avatar className="h-10 w-10">
      <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.full_name || 'User'} />
      <AvatarFallback className="bg-primary/10 text-primary">
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  if (!clickable) {
    return (
      <>
        <div className="relative h-10 w-10 rounded-full">
          {avatar}
        </div>
        <BugReportModal open={bugReportOpen} onOpenChange={setBugReportOpen} />
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            {avatar}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-2">
              <p className="text-sm font-medium leading-none">
                {profile?.full_name || 'User'}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
              {role && (
                <Badge variant="outline" className={`w-fit ${roleColors[role]}`}>
                  {roleLabels[role]}
                </Badge>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate('/settings')}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </DropdownMenuItem>
          {role === 'owner' && (
            <DropdownMenuItem onClick={() => navigate('/settings/pricing')}>
              <Crown className="mr-2 h-4 w-4" />
              Pricing Plans
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setBugReportOpen(true)}>
            <Bug className="mr-2 h-4 w-4" />
            Report a Bug
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <BugReportModal open={bugReportOpen} onOpenChange={setBugReportOpen} />
    </>
  );
}
