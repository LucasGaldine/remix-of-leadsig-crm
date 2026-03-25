import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, AppRole } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Leaf } from 'lucide-react';
import { z } from 'zod';
import { usePasswordStrength } from '@/hooks/usePasswordStrength';
import { PasswordStrengthIndicator } from '@/components/auth/PasswordStrengthIndicator';
import { ForgotPasswordDialog } from '@/components/auth/ForgotPasswordDialog';
import { getPostAuthRedirectPath } from '@/lib/onboarding';
import { cn } from '@/lib/utils';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const roleLabels: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales: 'Sales',
  crew_lead: 'Crew Lead',
  crew_member: 'Crew Member',
};

export default function Auth() {
  const navigate = useNavigate();
  const { user, signIn, signUp, isLoading: authLoading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedRole, setSelectedRole] = useState<AppRole>('sales');
  const [companyCode, setCompanyCode] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [phone, setPhone] = useState('');
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
    email?: string;
    password?: string;
    fullName?: string;
    companyCode?: string;
    companyName?: string;
  }>({});
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  // Password strength validation for signup
  const passwordValidation = usePasswordStrength(password);

  const isCreatingCompany = signupCompanyMode === 'create';

  useEffect(() => {
    if (user && !authLoading) {
      navigate(getPostAuthRedirectPath({ isNewSignup: false }));
    }
  }, [user, authLoading, navigate]);

  const resetSignupFlow = () => {
    setSignupStep(1);
    setSignupCompanyMode(null);
    setSelectedRole('sales');
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
      if (error.message.includes('Invalid login credentials')) {
        toast.error('Invalid email or password');
      } else if (error.message.includes('Email not confirmed')) {
        toast.error('Please confirm your email before signing in');
      } else {
        toast.error(error.message);
      }
    } else {
      toast.success('Welcome back!');
      navigate('/');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    setIsLoading(true);
    const { error } = await signUp(
      email,
      password,
      fullName,
      selectedRole,
      isCreatingCompany
        ? { companyName, companyPhone, companyAddress }
        : { companyCode },
      phone
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
      toast.success('Account created successfully!');
      if (isCreatingCompany) {
        navigate('/settings/pricing?onboarding=1&trial=14&defaultPlan=basic');
      } else {
        navigate(getPostAuthRedirectPath({ isNewSignup: true, shouldStartOnboarding: false }));
      }
    }
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Leaf className="h-6 w-6 text-primary" />
            </div>
            <span className="text-2xl font-bold">LeadSig</span>
          </div>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>
            Sign in to your account or create a new one
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => {
            const nextTab = v as 'signin' | 'signup';
            setActiveTab(nextTab);
            if (nextTab === 'signup') {
              resetSignupFlow();
              setErrors({});
            }
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Log In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
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
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4 mt-4">
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
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                      />
                      {password.length > 0 && (
                        <PasswordStrengthIndicator validation={passwordValidation} />
                      )}
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

                <div className="flex gap-3 pt-2">
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
                </div>
              </form>
            </TabsContent>
          </Tabs>
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
