export const ONBOARDING_IMPORT_STORAGE_KEY = "leadsig:onboarding-import";
export const ONBOARDING_TUTORIAL_STORAGE_KEY = "leadsig:onboarding-tutorial";

type ImportState = "pending" | "completed";
type TutorialState = "pending" | "completed";

function getStoredImportState(): ImportState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(ONBOARDING_IMPORT_STORAGE_KEY);
  return value === "pending" || value === "completed" ? value : null;
}

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

export function shouldShowOnboardingImport() {
  return getStoredImportState() === "pending";
}

export function markOnboardingImportPending() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_IMPORT_STORAGE_KEY, "pending");
}

export function completeOnboardingImport() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_IMPORT_STORAGE_KEY, "completed");
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
    markOnboardingImportPending();
    markOnboardingTutorialPending();
    return "/onboarding/import";
  }

  if (shouldShowOnboardingImport()) {
    return "/onboarding/import";
  }

  return shouldShowOnboardingTutorial() ? "/tutorial" : "/";
}
