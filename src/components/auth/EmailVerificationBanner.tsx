import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface EmailVerificationBannerProps {
  email: string;
  isEmailConfirmed: boolean;
}

export function EmailVerificationBanner({ email, isEmailConfirmed }: EmailVerificationBannerProps) {
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // If email is confirmed, don't render anything
  if (isEmailConfirmed) {
    return null;
  }

  const handleResendVerification = async () => {
    if (cooldown > 0) return;
    
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Verification email sent! Please check your inbox.');
        // Start 60 second cooldown
        setCooldown(60);
        const interval = setInterval(() => {
          setCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      toast.error('Failed to resend verification email');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <span className="text-amber-800 dark:text-amber-200">
          Your email is not verified. Please check your inbox.
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResendVerification}
          disabled={isResending || cooldown > 0}
          className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900"
        >
          {isResending ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Sending...
            </>
          ) : cooldown > 0 ? (
            <>
              <Mail className="mr-2 h-3 w-3" />
              Resend in {cooldown}s
            </>
          ) : (
            <>
              <Mail className="mr-2 h-3 w-3" />
              Resend email
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
