import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'owner' | 'admin' | 'sales' | 'crew_lead';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  timezone: string | null;
  notification_preferences: Record<string, any> | null;
}

interface Account {
  id: string;
  company_name: string;
  company_email: string | null;
  company_phone: string | null;
  company_address: string | null;
  billing_email: string | null;
  website: string | null;
  logo_url: string | null;
  settings: Record<string, any> | null;
}

interface AccountMembership {
  account_id: string;
  role: AppRole;
  is_active: boolean;
  account: Account;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  currentAccount: Account | null;
  accounts: AccountMembership[];
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    role: AppRole,
    companyInfo: { companyCode?: string; companyName?: string; companyPhone?: string; companyAddress?: string },
    phone?: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isOwnerOrAdmin: () => boolean;
  refreshProfile: () => Promise<void>;
  switchAccount: (accountId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [accounts, setAccounts] = useState<AccountMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData as Profile);
    }

    const { data: membershipsData } = await supabase
      .from('account_members')
      .select(`
        account_id,
        role,
        is_active,
        accounts:account_id (
          id,
          company_name,
          company_email,
          company_phone,
          company_address,
          billing_email,
          website,
          logo_url,
          settings
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (membershipsData && membershipsData.length > 0) {
      const formattedAccounts: AccountMembership[] = membershipsData.map((m: any) => ({
        account_id: m.account_id,
        role: m.role as AppRole,
        is_active: m.is_active,
        account: m.accounts
      }));

      setAccounts(formattedAccounts);

      const storedAccountId = localStorage.getItem('currentAccountId');
      const accountToSet = storedAccountId
        ? formattedAccounts.find(a => a.account_id === storedAccountId)
        : formattedAccounts[0];

      if (accountToSet) {
        setCurrentAccount(accountToSet.account);
        setRole(accountToSet.role);
        localStorage.setItem('currentAccountId', accountToSet.account_id);
      }
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer data fetching to avoid deadlock
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }
        
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    selectedRole: AppRole,
    companyInfo: { companyCode?: string; companyName?: string; companyPhone?: string; companyAddress?: string },
    phone?: string
  ) => {
    try {
      let targetAccountId: string | null = null;

      if (companyInfo.companyCode) {
        const { data: accountData, error: accountError } = await supabase
          .rpc('get_account_by_invite_code', { code: companyInfo.companyCode });

        if (accountError || !accountData || accountData.length === 0) {
          return { error: new Error('Invalid company code') };
        }

        targetAccountId = accountData[0].id;
      }

      const redirectUrl = `${window.location.origin}/`;

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            phone: phone || null,
            role: selectedRole,
            company_name: companyInfo.companyName,
            company_phone: companyInfo.companyPhone || null,
            company_address: companyInfo.companyAddress || null,
            target_account_id: targetAccountId,
          },
        },
      });

      if (signUpError) return { error: signUpError };

      if (signUpData.user && targetAccountId) {
        const { error: memberError } = await supabase
          .from('account_members')
          .insert({
            account_id: targetAccountId,
            user_id: signUpData.user.id,
            role: selectedRole,
            is_active: true,
          });

        if (memberError) {
          console.error('Error adding user to account:', memberError);
        }
      }

      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setCurrentAccount(null);
    setAccounts([]);
    localStorage.removeItem('currentAccountId');
  };

  const hasRole = (checkRole: AppRole): boolean => {
    if (!role) return false;
    return role === checkRole;
  };

  const isOwnerOrAdmin = (): boolean => {
    return role === 'owner' || role === 'admin';
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserData(user.id);
    }
  };

  const switchAccount = (accountId: string) => {
    const membership = accounts.find(a => a.account_id === accountId);
    if (membership) {
      setCurrentAccount(membership.account);
      setRole(membership.role);
      localStorage.setItem('currentAccountId', accountId);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        currentAccount,
        accounts,
        isLoading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isOwnerOrAdmin,
        refreshProfile,
        switchAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
