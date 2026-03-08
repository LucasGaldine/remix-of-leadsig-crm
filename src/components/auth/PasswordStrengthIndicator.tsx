import { PasswordValidation, PasswordStrength } from '@/hooks/usePasswordStrength';
import { Check, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthIndicatorProps {
  validation: PasswordValidation;
  showRequirements?: boolean;
}

const strengthConfig: Record<PasswordStrength, { label: string; className: string }> = {
  weak: { label: 'Weak', className: 'bg-destructive' },
  fair: { label: 'Fair', className: 'bg-orange-500' },
  good: { label: 'Good', className: 'bg-yellow-500' },
  strong: { label: 'Strong', className: 'bg-green-500' },
};

export function PasswordStrengthIndicator({ 
  validation, 
  showRequirements = true 
}: PasswordStrengthIndicatorProps) {
  const { strength, score, requirements, feedback } = validation;
  const config = strengthConfig[strength];

  return (
    <div className="space-y-2">
      {/* Strength bar */}
      <div className="space-y-1">
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                index < score ? config.className : 'bg-muted'
              )}
            />
          ))}
        </div>
        <div className="flex justify-between items-center">
          <span className={cn(
            'text-xs font-medium',
            strength === 'weak' && 'text-destructive',
            strength === 'fair' && 'text-orange-500',
            strength === 'good' && 'text-yellow-600',
            strength === 'strong' && 'text-green-600'
          )}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Requirements checklist */}
      {showRequirements && (
        <div className="space-y-1.5 text-xs">
          <RequirementItem 
            met={requirements.minLength} 
            label="At least 8 characters" 
          />
          <RequirementItem 
            met={requirements.hasUppercase} 
            label="Uppercase letter (A-Z)" 
          />
          <RequirementItem 
            met={requirements.hasLowercase} 
            label="Lowercase letter (a-z)" 
          />
          <RequirementItem 
            met={requirements.hasNumber} 
            label="Number (0-9)" 
          />
          <RequirementItem 
            met={requirements.hasSpecial} 
            label="Special character (!@#$%^&*)" 
          />
          {!requirements.notCommon && (
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>This password is too common</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={cn(
      'flex items-center gap-1.5 transition-colors',
      met ? 'text-green-600' : 'text-muted-foreground'
    )}>
      {met ? (
        <Check className="h-3 w-3" />
      ) : (
        <X className="h-3 w-3" />
      )}
      <span>{label}</span>
    </div>
  );
}
