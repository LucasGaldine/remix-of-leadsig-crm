import { useMemo } from 'react';

// Common weak passwords that should be rejected
const COMMON_WEAK_PASSWORDS = [
  'password', 'password1', 'password123', '123456', '12345678', '123456789',
  'qwerty', 'qwerty123', 'abc123', 'monkey', 'master', 'dragon', 'letmein',
  '111111', '1234567', 'sunshine', 'princess', 'football', 'baseball',
  'iloveyou', 'admin', 'welcome', 'shadow', 'superman', 'michael', 'ashley',
  'jessica', 'charlie', 'trustno1', '000000', 'passw0rd', 'hello', 'freedom',
  'whatever', 'qazwsx', 'ninja', 'mustang', 'password1234', 'password12',
  'login', 'starwars', 'solo', 'access', 'flower', 'hottie', 'lovely',
  'letmein1', '1234', 'test', 'test123', 'guest', 'master123', 'changeme'
];

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordValidation {
  isValid: boolean;
  strength: PasswordStrength;
  score: number; // 0-4
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    notCommon: boolean;
  };
  feedback: string[];
}

export function usePasswordStrength(password: string): PasswordValidation {
  return useMemo(() => {
    const requirements = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      notCommon: !COMMON_WEAK_PASSWORDS.includes(password.toLowerCase()),
    };

    const feedback: string[] = [];
    
    if (!requirements.minLength) {
      feedback.push('Use at least 8 characters');
    }
    if (!requirements.hasUppercase) {
      feedback.push('Add an uppercase letter');
    }
    if (!requirements.hasLowercase) {
      feedback.push('Add a lowercase letter');
    }
    if (!requirements.hasNumber) {
      feedback.push('Add a number');
    }
    if (!requirements.hasSpecial) {
      feedback.push('Add a special character (!@#$%^&*)');
    }
    if (!requirements.notCommon) {
      feedback.push('This password is too common');
    }

    // Calculate score (0-4)
    let score = 0;
    if (requirements.minLength) score++;
    if (requirements.hasUppercase && requirements.hasLowercase) score++;
    if (requirements.hasNumber) score++;
    if (requirements.hasSpecial) score++;
    
    // Penalize common passwords
    if (!requirements.notCommon) {
      score = 0;
    }

    // Bonus for extra length
    if (password.length >= 12) score = Math.min(4, score + 0.5);
    if (password.length >= 16) score = Math.min(4, score + 0.5);

    // Determine strength label
    let strength: PasswordStrength;
    if (score <= 1) {
      strength = 'weak';
    } else if (score <= 2) {
      strength = 'fair';
    } else if (score <= 3) {
      strength = 'good';
    } else {
      strength = 'strong';
    }

    // Password is valid if it meets minimum requirements
    const isValid = requirements.minLength && 
                    requirements.hasUppercase && 
                    requirements.hasLowercase && 
                    requirements.hasNumber && 
                    requirements.notCommon;

    return {
      isValid,
      strength,
      score: Math.floor(score),
      requirements,
      feedback,
    };
  }, [password]);
}
