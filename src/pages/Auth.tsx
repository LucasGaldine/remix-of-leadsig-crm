import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import { usePasswordStrength } from '@/hooks/usePasswordStrength';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { getPostAuthRedirectPath, setSignupSource } from '@/lib/onboarding';
import { extractAffiliateReferralCode } from '@/lib/affiliate';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');
const SMS_CONSENT_TEXT_VERSION = '2026-04-09-v1';

const roleLabels: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales: 'Sales',
  crew_lead: 'Crew Lead',
  crew_member: 'Crew Member',
};

type AuthProps = {
  signupVariant?: 'default' | 'elo';
};

export default function Auth({ signupVariant = 'default' }: AuthProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn, signUp, isLoading: authLoading } = useAuth();
  const affiliateReferralCode = extractAffiliateReferralCode(location.search);
  const signupSource = new URLSearchParams(location.search).get('source')?.toLowerCase();
  const isEloSignup = signupVariant === 'elo' || signupSource === 'elo';
  
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [eloMembershipEmail, setEloMembershipEmail] = useState('');
  const [eloSignupGateCompleted, setEloSignupGateCompleted] = useState(!isEloSignup);
  const [eloMembershipStatus, setEloMembershipStatus] = useState<'free' | 'premium' | null>(null);
  const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('sales');
  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [smsConsentEnabled, setSmsConsentEnabled] = useState(false);
  const [isSignupPasswordFocused, setIsSignupPasswordFocused] = useState(false);
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [signupCompanyMode, setSignupCompanyMode] = useState<'create' | 'join' | null>(null);

  useEffect(() => {
    if (signupCompanyMode === 'create') {
      setSelectedRole('owner');
    } else if (signupCompanyMode === 'join') {
      setSelectedRole('sales');
    }
  }, [signupCompanyMode]);
  const [errors, setErrors] = useState<{
    eloMembershipEmail?: string;
    email?: string;
    password?: string;
    fullName?: string;
    companyCode?: string;
    companyName?: string;
  }>({});
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>(isEloSignup ? 'signup' : 'signin');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // Password strength validation for signup
  const passwordValidation = usePasswordStrength(password);

  const isCreatingCompany = signupCompanyMode === 'create';

  const normalizeAuthErrorMessage = (error: unknown): string => {
    if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }

    if (error && typeof error === 'object' && 'message' in error) {
      const rawMessage = (error as { message?: unknown }).message;
      if (typeof rawMessage === 'string' && rawMessage.trim()) {
        return rawMessage.trim();
      }
    }

    return 'Unable to sign in right now. Please try again.';
  };

  useEffect(() => {
    if (user && !authLoading) {
      navigate(getPostAuthRedirectPath({ isNewSignup: false }));
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (isEloSignup) {
      setActiveTab('signup');
      setEloSignupGateCompleted(false);
    } else {
      setEloSignupGateCompleted(true);
    }
  }, [isEloSignup]);

  const resetSignupFlow = () => {
    setSignupStep(1);
    setSignupCompanyMode(null);
    setSelectedRole('sales');
    setSmsConsentEnabled(false);
    if (isEloSignup) {
      setEloMembershipEmail('');
      setEloSignupGateCompleted(false);
      setEloMembershipStatus(null);
    }
  };

  const validateForm = (isSignUp: boolean): boolean => {
    const newErrors: typeof errors = {};
    
    try {
      emailSchema.parse(email);
    } catch (e) {
      if (e instanceof z.ZodError) {
        newErrors.email = e.errors[0].message;
      }
    }

    // For sign up, use stronger password validation
    if (isSignUp) {
      if (!passwordValidation.isValid) {
        if (!passwordValidation.requirements.notCommon) {
          newErrors.password = 'This password is too common. Please choose a stronger password.';
        } else if (passwordValidation.feedback.length > 0) {
          newErrors.password = passwordValidation.feedback[0];
        }
      }
    } else {
      // For sign in, just check minimum length
      try {
        passwordSchema.parse(password);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.password = e.errors[0].message;
        }
      }
    }

    if (isSignUp && !fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (isSignUp && signupStep === 3) {
      if (isCreatingCompany) {
        if (!companyName.trim()) {
          newErrors.companyName = 'Company name is required';
        }
      } else {
        if (!companyCode.trim()) {
          newErrors.companyCode = 'Company code is required';
        } else if (companyCode.trim().length < 6) {
          newErrors.companyCode = 'Please enter a valid company code';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSignupStep = (step: 1 | 2 | 3) => {
    const newErrors: typeof errors = {};

    if (step === 1) {
      try {
        emailSchema.parse(email);
      } catch (e) {
        if (e instanceof z.ZodError) {
          newErrors.email = e.errors[0].message;
        }
      }

      if (!passwordValidation.isValid) {
        if (!passwordValidation.requirements.notCommon) {
          newErrors.password = 'This password is too common. Please choose a stronger password.';
        } else if (passwordValidation.feedback.length > 0) {
          newErrors.password = passwordValidation.feedback[0];
        }
      }

      if (!fullName.trim()) {
        newErrors.fullName = 'Full name is required';
      }

    }

    if (step === 2 && !signupCompanyMode) {
      toast.error('Choose whether you are creating a company or joining one');
      return false;
    }

    if (step === 3) {
      return validateForm(true);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      const authErrorMessage = normalizeAuthErrorMessage(error);
      const normalizedAuthErrorMessage = authErrorMessage.toLowerCase();

      if (normalizedAuthErrorMessage.includes('invalid login credentials')) {
        toast.error('Invalid email or password');
      } else if (normalizedAuthErrorMessage.includes('email not confirmed')) {
        toast.error('Please confirm your email before signing in');
      } else {
        toast.error(authErrorMessage);
      }
    } else {
      toast.success('Welcome back!');
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEloSignup && !eloSignupGateCompleted) return;
    if (!validateForm(true)) return;

    setIsLoading(true);
    const signupPlanOverride =
      isEloSignup && eloMembershipStatus === 'premium'
        ? { plan: 'basic' as const, tier: 'growth' as const }
        : undefined;
    const signupPayload = isCreatingCompany
      ? { companyName, companyPhone, companyAddress }
      : { companyCode };
    const signupSmsConsent = {
      status: smsConsentEnabled ? 'opted_in' : 'opted_out',
      capturedAt: new Date().toISOString(),
      source: 'signup_form' as const,
      textVersion: SMS_CONSENT_TEXT_VERSION,
    };
    const { error } = signupPlanOverride
      ? await signUp(
          email,
          password,
          fullName,
          selectedRole,
          signupPayload,
          signupSmsConsent,
          phone,
          affiliateReferralCode,
          signupPlanOverride,
        )
      : await signUp(
          email,
          password,
          fullName,
          selectedRole,
          signupPayload,
          signupSmsConsent,
          phone,
          affiliateReferralCode,
        );
    setIsLoading(false);

    if (error) {
      if (error.message.includes('User already registered')) {
        toast.error('An account with this email already exists');
      } else if (error.message.includes('Invalid company code')) {
            setErrors({ ...errors, companyCode: 'Invalid company code' });
            toast.error('Invalid company code. Please check and try again.');
      } else {
        toast.error(error.message);
      }
    } else {
      setSignupSource(isEloSignup ? "elo" : "default");
      toast.success('Account created successfully!');
      navigate(getPostAuthRedirectPath({ isNewSignup: true, shouldStartOnboarding: isCreatingCompany }));
    }
  };

  const handleEloMembershipEmailContinue = async () => {
    const nextErrors: typeof errors = {};
    const normalizedEmail = eloMembershipEmail.trim();

    try {
      emailSchema.parse(normalizedEmail);
    } catch (e) {
      if (e instanceof z.ZodError) {
        nextErrors.eloMembershipEmail = e.errors[0].message;
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!eloMembershipStatus) {
      setIsCheckingEligibility(true);
      const { data, error } = await supabase.functions.invoke('elo-membership-status', {
        body: { email: normalizedEmail },
      });
      setIsCheckingEligibility(false);

      if (error) {
        toast.error(error.message || 'Unable to check account status right now');
        return;
      }

      const status = (data as { status?: unknown } | null)?.status;
      if (status !== 'free' && status !== 'premium') {
        toast.error('Could not determine account status. Please try again.');
        return;
      }

      setEloMembershipStatus(status);
      setEmail(normalizedEmail);
      setErrors({});
      return;
    }

    setEmail(normalizedEmail);
    setEloSignupGateCompleted(true);
    setErrors({});
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <Card
        className={cn(
          "w-full max-w-md",
          activeTab === "signup" && "max-h-[90vh] flex flex-col overflow-hidden",
        )}
      >
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <img src="/header_logo.png" alt="LeadSig logo" className="h-8 w-auto object-contain" />
            <span className="text-2xl font-bold">LeadSig</span>
          </div>
          <CardTitle className="text-2xl">{isEloSignup ? 'Create your account' : 'Welcome'}</CardTitle>
          <CardDescription>
            {isEloSignup
              ? 'Elo Growth sign-up database check'
              : 'Sign in to your account or create a new one'}
          </CardDescription>
        </CardHeader>

        <CardContent
          className={cn(
            activeTab === "signup" && "flex-1 min-h-0 flex flex-col overflow-hidden",
          )}
        >
          <Tabs value={activeTab} onValueChange={(v) => {
            if (isEloSignup) return;
            const nextTab = v as 'signin' | 'signup';
            setActiveTab(nextTab);
            if (nextTab === 'signup') {
              resetSignupFlow();
              setErrors({});
            }
          }} className={cn("w-full", activeTab === "signup" && "flex-1 min-h-0 flex flex-col overflow-hidden")}>
            {!isEloSignup && (
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Log In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
            )}
            
            {!isEloSignup && <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" >Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                  
                <div className="space-y-2">

                  <div className="flex items-center justify-between">
                    <Label htmlFor="signin-password" >Password</Label>
                    <p

                    tabIndex={0}
                    onClick={() => setShowForgotPassword(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setShowForgotPassword(true);
                      }
                    }}
                    className="text-xs text-primary hover:underline cursor-pointer"
                  >
                    Forgot password?
                  </p>
                  </div>

                  <Input
                    id="signin-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className='block h-2'></div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>

              </form>
            </TabsContent>}
            
            <TabsContent value="signup" className="flex-1 min-h-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col">
              <form onSubmit={handleSignUp} className="pt-4 flex flex-1 min-h-0 flex-col">
                <div className="space-y-4 flex-1 min-h-0 overflow-y-auto pr-1">
                  {isEloSignup && !eloSignupGateCompleted ? (
                    <div className="space-y-3">
                      <Label htmlFor="elo-membership-email">What email did you use for your ELO membership?</Label>
                      <Input
                        id="elo-membership-email"
                        type="email"
                        placeholder="you@elo.com"
                        value={eloMembershipEmail}
                        onChange={(e) => {
                          setEloMembershipEmail(e.target.value);
                          setEloMembershipStatus(null);
                        }}
                        disabled={isLoading}
                      />
                      {errors.eloMembershipEmail && (
                        <p className="text-sm text-destructive">{errors.eloMembershipEmail}</p>
                      )}
                      {eloMembershipStatus ? (
                        <p
                          className={cn(
                            'text-sm font-medium text-center',
                            eloMembershipStatus === 'premium' ? 'text-emerald-600' : 'text-emerald-600',
                          )}
                        >
                          {eloMembershipStatus === 'premium' ? 'Elo membership status: Yes' : 'You have access to a 14 day free trial!'}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          We will verify this email against the ELO membership table in the LeadSig database.
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                  {affiliateReferralCode && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                      Referral code applied: <span className="font-semibold">{affiliateReferralCode}</span>
                    </div>
                  )}
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Step {signupStep} of 3
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {signupStep === 1 && 'Tell us about yourself'}
                      {signupStep === 2 && 'Choose how you want to start'}
                      {signupStep === 3 && (isCreatingCompany ? 'Set up your company details' : 'Enter your company invite code')}
                    </p>
                  </div>

                  {signupStep === 1 && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Full Name</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="John Smith"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          disabled={isLoading}
                        />
                        {errors.fullName && (
                          <p className="text-sm text-destructive">{errors.fullName}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoading}
                        />
                        {errors.email && (
                          <p className="text-sm text-destructive">{errors.email}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Password</Label>
                        <div className="relative">
                          <Input
                            id="signup-password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onFocus={() => setIsSignupPasswordFocused(true)}
                            onBlur={() => setIsSignupPasswordFocused(false)}
                            disabled={isLoading}
                          />
                          {password.length > 0 && isSignupPasswordFocused && (
                            <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-md border bg-popover p-3 shadow-lg">
                              <PasswordStrengthIndicator validation={passwordValidation} />
                            </div>
                          )}
                        </div>
                        {errors.password && (
                          <p className="text-sm text-destructive">{errors.password}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-phone">Phone Number (Optional)</Label>
                        <Input
                          id="signup-phone"
                          type="tel"
                          placeholder="(555) 123-4567"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={smsConsentEnabled}
                            onChange={(e) => {
                              setSmsConsentEnabled(e.target.checked);
                            }}
                            disabled={isLoading}
                          />
                          <span>I agree to receive SMS messages from LeadSig</span>
                        </label>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          By providing your mobile number and opting in, you agree to receive SMS messages from LeadSig regarding appointments, estimates, service updates, and account notifications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out and HELP for help.
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          SMS opt-in data and consent will not be sold or shared with third parties or affiliates for marketing purposes.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          View our{" "}
                          <Link to="/privacy-policy" className="text-primary hover:underline">
                            Privacy Policy
                          </Link>{" "}
                          and{" "}
                          <Link to="/terms" className="text-primary hover:underline">
                            Terms of Service
                          </Link>
                          .
                        </p>
                      </div>
                    </>
                  )}

                  {signupStep === 2 && (
                    <div className="grid gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSignupCompanyMode('create');
                          setCompanyCode('');
                          setErrors({});
                        }}
                        className={cn(
                          'rounded-lg border p-4 text-left transition-colors',
                          signupCompanyMode === 'create' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
                        )}
                        disabled={isLoading}
                      >
                        <p className="font-medium text-foreground">Create a new company</p>
                        <p className="mt-1 text-sm text-muted-foreground">Set up a new LeadSig company and become the owner.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSignupCompanyMode('join');
                          setCompanyName('');
                          setCompanyPhone('');
                          setCompanyAddress('');
                          setErrors({});
                        }}
                        className={cn(
                          'rounded-lg border p-4 text-left transition-colors',
                          signupCompanyMode === 'join' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40',
                        )}
                        disabled={isLoading}
                      >
                        <p className="font-medium text-foreground">Join an existing company</p>
                        <p className="mt-1 text-sm text-muted-foreground">Use a company invite code to join your team.</p>
                      </button>
                    </div>
                  )}

                  {signupStep === 3 && (
                    <>
                      {isCreatingCompany ? (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="company-name">Company Name</Label>
                            <Input
                              id="company-name"
                              type="text"
                              placeholder="Your Company Name"
                              value={companyName}
                              onChange={(e) => setCompanyName(e.target.value)}
                              disabled={isLoading}
                            />
                            {errors.companyName && (
                              <p className="text-sm text-destructive">{errors.companyName}</p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="company-phone">Business Phone (Optional)</Label>
                            <Input
                              id="company-phone"
                              type="tel"
                              placeholder="(555) 123-4567"
                              value={companyPhone}
                              onChange={(e) => setCompanyPhone(e.target.value)}
                              disabled={isLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="company-address">Business Address (Optional)</Label>
                            <Input
                              id="company-address"
                              type="text"
                              placeholder="123 Main St, City, State 12345"
                              value={companyAddress}
                              onChange={(e) => setCompanyAddress(e.target.value)}
                              disabled={isLoading}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <Label htmlFor="company-code">Company Code</Label>
                          <Input
                            id="company-code"
                            type="text"
                            placeholder="Enter your company code"
                            value={companyCode}
                            onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                            disabled={isLoading}
                            className="uppercase"
                          />
                          {errors.companyCode && (
                            <p className="text-sm text-destructive">{errors.companyCode}</p>
                          )}
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="signup-role">Your Role</Label>
                        <Select
                          value={selectedRole}
                          onValueChange={(value) => setSelectedRole(value as AppRole)}
                          disabled={isLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select your role" />
                          </SelectTrigger>
                          <SelectContent>
                            {isCreatingCompany ? (
                              <SelectItem value="owner">Owner</SelectItem>
                            ) : (
                              <>
                                {(['sales', 'crew_lead', 'crew_member'] as AppRole[]).map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {roleLabels[role]}
                                  </SelectItem>
                                ))}
                              </>
                            )}
                          </SelectContent>
                        </Select>
                        {!isCreatingCompany && (
                          <p className="text-xs text-muted-foreground">
                            Owner and Admin roles require an invitation from an existing administrator.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                    </>
                  )}
                </div>

                <div className="flex gap-3 py-3 shrink-0 bg-card">
                  {isEloSignup && !eloSignupGateCompleted ? (
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={handleEloMembershipEmailContinue}
                      disabled={isLoading || isCheckingEligibility}
                    >
                      {isCheckingEligibility
                        ? 'Checking eligibility...'
                        : eloMembershipStatus
                          ? 'Continue'
                          : 'Check eligibility first'}
                    </Button>
                  ) : (
                    <>
                  {signupStep > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSignupStep((signupStep - 1) as 1 | 2 | 3)}
                      disabled={isLoading}
                    >
                      Back
                    </Button>
                  )}

                  {signupStep < 3 ? (
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => {
                        if (!validateSignupStep(signupStep)) return;
                        setSignupStep((signupStep + 1) as 1 | 2 | 3);
                      }}
                      disabled={isLoading}
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button type="submit" className="flex-1" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {isCreatingCompany ? 'Creating company...' : 'Creating account...'}
                        </>
                      ) : (
                        isCreatingCompany ? 'Create Company & Account' : 'Join Company'
                      )}
                    </Button>
                  )}
                    </>
                  )}
                </div>
              </form>
            </TabsContent>
          </Tabs>
          {isEloSignup ? (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/auth" className="font-medium text-primary hover:underline">
                Log In
              </Link>
            </p>
          ) : (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Want to earn referral commissions?{" "}
              <Link to="/affiliate" className="font-medium text-primary hover:underline">
                Become an affiliate
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      <ForgotPasswordDialog
        open={showForgotPassword}
        onOpenChange={setShowForgotPassword}
        initialEmail={email}
      />
    </div>
  );
}
