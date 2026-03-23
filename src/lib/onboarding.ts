export const ONBOARDING_TUTORIAL_STORAGE_KEY = "leadsig:onboarding-tutorial";

type TutorialState = "pending" | "completed";

function getStoredTutorialState(): TutorialState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(ONBOARDING_TUTORIAL_STORAGE_KEY);
  return value === "pending" || value === "completed" ? value : null;
}

export function shouldShowOnboardingTutorial() {
  return getStoredTutorialState() === "pending";
}

export function markOnboardingTutorialPending() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_TUTORIAL_STORAGE_KEY, "pending");
}

export function completeOnboardingTutorial() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_TUTORIAL_STORAGE_KEY, "completed");
}

export function getPostAuthRedirectPath({ isNewSignup = false }: { isNewSignup?: boolean }) {
  if (isNewSignup) {
    markOnboardingTutorialPending();
    return "/tutorial";
  }

  return shouldShowOnboardingTutorial() ? "/tutorial" : "/";
}
