export const ONBOARDING_SOURCE_STORAGE_KEY = "leadsig:onboarding-source";
export const ONBOARDING_IMPORT_STORAGE_KEY = "leadsig:onboarding-import";
export const ONBOARDING_TUTORIAL_STORAGE_KEY = "leadsig:onboarding-tutorial";
export const ONBOARDING_PREVIOUS_CRM_STORAGE_KEY = "leadsig:onboarding-previous-crm";

type SourceState = "pending" | "completed";
type ImportState = "pending" | "completed";
type TutorialState = "pending" | "completed";

function getStoredSourceState(): SourceState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(ONBOARDING_SOURCE_STORAGE_KEY);
  return value === "pending" || value === "completed" ? value : null;
}

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

export function shouldShowOnboardingSource() {
  return getStoredSourceState() === "pending";
}

export function shouldShowOnboardingImport() {
  return getStoredImportState() === "pending";
}

export function markOnboardingSourcePending() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_SOURCE_STORAGE_KEY, "pending");
}

export function completeOnboardingSource() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_SOURCE_STORAGE_KEY, "completed");
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

export function saveOnboardingPreviousCrm(crmName: string) {
  if (typeof window === "undefined") {
    return;
  }

  const value = crmName.trim();
  if (!value) {
    return;
  }

  window.localStorage.setItem(ONBOARDING_PREVIOUS_CRM_STORAGE_KEY, value);
}

export function getOnboardingPreviousCrm() {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(ONBOARDING_PREVIOUS_CRM_STORAGE_KEY);
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

export function getPostAuthRedirectPath({
  isNewSignup = false,
  shouldStartOnboarding = isNewSignup,
}: {
  isNewSignup?: boolean;
  shouldStartOnboarding?: boolean;
}) {
  if (isNewSignup) {
    if (shouldStartOnboarding) {
      markOnboardingSourcePending();
      markOnboardingImportPending();
      markOnboardingTutorialPending();
      return "/onboarding/source";
    }

    markOnboardingTutorialPending();
    return "/tutorial";
  }

  if (shouldShowOnboardingSource()) {
    return "/onboarding/source";
  }

  if (shouldShowOnboardingImport()) {
    return "/onboarding/import";
  }

  return shouldShowOnboardingTutorial() ? "/tutorial" : "/";
}
