import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, ShieldCheck, ShieldOff, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface TwoFactorSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SetupStep = 'initial' | 'enroll' | 'verify' | 'success' | 'unenroll';

interface FactorData {
  id: string;
  type: string;
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

export function TwoFactorSetup({ open, onOpenChange }: TwoFactorSetupProps) {
  const [step, setStep] = useState<SetupStep>('initial');
  const [isLoading, setIsLoading] = useState(false);
  const [factorData, setFactorData] = useState<FactorData | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [existingFactorId, setExistingFactorId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      checkExisting2FA();
    }
  }, [open]);

  const checkExisting2FA = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      
      if (error) throw error;
      
      const verifiedFactor = data?.totp?.find(f => f.status === 'verified');
      if (verifiedFactor) {
        setIs2FAEnabled(true);
        setExistingFactorId(verifiedFactor.id);
        setStep('initial');
      } else {
        setIs2FAEnabled(false);
        setExistingFactorId(null);
        setStep('initial');
      }
    } catch (err) {
      console.error('Error checking 2FA status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnroll = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'LeadSig Authenticator',
      });

      if (error) throw error;

      setFactorData(data as FactorData);
      setStep('enroll');
    } catch (err: any) {
      toast.error(err.message || 'Failed to start 2FA enrollment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!factorData || verificationCode.length !== 6) return;

    setIsLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: factorData.id,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: factorData.id,
        challengeId: challengeData.id,
        code: verificationCode,
      });

      if (verifyError) throw verifyError;

      setStep('success');
      setIs2FAEnabled(true);
      setExistingFactorId(factorData.id);
      toast.success('Two-factor authentication enabled successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnenroll = async () => {
    if (!existingFactorId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({
        factorId: existingFactorId,
      });

      if (error) throw error;

      setIs2FAEnabled(false);
      setExistingFactorId(null);
      setStep('initial');
      toast.success('Two-factor authentication disabled');
    } catch (err: any) {
      toast.error(err.message || 'Failed to disable 2FA');
    } finally {
      setIsLoading(false);
    }
  };

  const copySecret = () => {
    if (factorData?.totp.secret) {
      navigator.clipboard.writeText(factorData.totp.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Secret copied to clipboard');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after close
    setTimeout(() => {
      setStep('initial');
      setFactorData(null);
      setVerificationCode('');
      setCopied(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            Add an extra layer of security to your account
          </DialogDescription>
        </DialogHeader>

        {isLoading && step === 'initial' ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Initial State - Show enable/disable options */}
            {step === 'initial' && (
              <div className="space-y-4">
                {is2FAEnabled ? (
                  <>
                    <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                      <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <AlertDescription className="text-green-800 dark:text-green-200">
                        Two-factor authentication is enabled on your account.
                      </AlertDescription>
                    </Alert>
                    <Button
                      variant="destructive"
                      className="w-full"
                      onClick={() => setStep('unenroll')}
                    >
                      <ShieldOff className="mr-2 h-4 w-4" />
                      Disable 2FA
                    </Button>
                  </>
                ) : (
                  <>
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        Two-factor authentication adds an extra layer of security by requiring a code from your authenticator app when signing in.
                      </AlertDescription>
                    </Alert>
                    <Button className="w-full" onClick={handleEnroll} disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      Enable 2FA
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Enroll Step - Show QR code */}
            {step === 'enroll' && factorData && (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
                  </p>
                  <div className="flex justify-center mb-4">
                    <img
                      src={factorData.totp.qr_code}
                      alt="2FA QR Code"
                      className="w-48 h-48 border rounded-lg"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                      {factorData.totp.secret}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={copySecret}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Can't scan? Enter this secret manually in your app.
                  </p>
                </div>
                <Button className="w-full" onClick={() => setStep('verify')}>
                  Continue
                </Button>
              </div>
            )}

            {/* Verify Step - Enter code */}
            {step === 'verify' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="verification-code">Verification Code</Label>
                  <Input
                    id="verification-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                    className="text-center text-2xl tracking-widest font-mono"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Enter the 6-digit code from your authenticator app
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep('enroll')}
                    disabled={isLoading}
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleVerify}
                    disabled={isLoading || verificationCode.length !== 6}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Verify
                  </Button>
                </div>
              </div>
            )}

            {/* Success Step */}
            {step === 'success' && (
              <div className="space-y-4 text-center">
                <div className="flex justify-center">
                  <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                    <ShieldCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">2FA Enabled!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your account is now protected with two-factor authentication.
                  </p>
                </div>
                <Button className="w-full" onClick={handleClose}>
                  Done
                </Button>
              </div>
            )}

            {/* Unenroll Confirmation */}
            {step === 'unenroll' && (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <ShieldOff className="h-4 w-4" />
                  <AlertDescription>
                    Disabling 2FA will make your account less secure. Are you sure you want to continue?
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep('initial')}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={handleUnenroll}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Disable 2FA
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
