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

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchema = z.string().min(6, 'Password must be at least 6 characters');

const roleLabels: Record<AppRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  sales: 'Sales',
  crew_lead: 'Crew Lead',
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
  const [isCreatingCompany, setIsCreatingCompany] = useState(false);

  useEffect(() => {
    if (isCreatingCompany) {
      setSelectedRole('owner');
    } else {
      setSelectedRole('sales');
    }
  }, [isCreatingCompany]);
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

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/');
    }
  }, [user, authLoading, navigate]);

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

    if (isSignUp) {
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
      navigate('/');
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
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
                    <Label htmlFor="signin-password">Password</Label>
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-primary hover:underline"
                    >
                      Forgot password?
                    </button>
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

                <div className="border-t pt-4">
                  <div className="space-y-3">
                    {!isCreatingCompany ? (
                      <>
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
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingCompany(true);
                            setCompanyCode('');
                            setErrors({});
                          }}
                          className="text-sm text-primary hover:underline"
                          disabled={isLoading}
                        >
                          Don't have a company code? Create a new company
                        </button>
                      </>
                    ) : (
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
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingCompany(false);
                            setCompanyName('');
                            setCompanyPhone('');
                            setCompanyAddress('');
                            setErrors({});
                          }}
                          className="text-sm text-primary hover:underline"
                          disabled={isLoading}
                        >
                          Already have a company code? Join existing company
                        </button>
                      </>
                    )}
                  </div>
                </div>

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
                          {(['sales', 'crew_lead'] as AppRole[]).map((role) => (
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
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isCreatingCompany ? 'Creating company...' : 'Creating account...'}
                    </>
                  ) : (
                    isCreatingCompany ? 'Create Company & Account' : 'Join Company'
                  )}
                </Button>
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
