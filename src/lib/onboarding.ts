export const ONBOARDING_SOURCE_STORAGE_KEY = "leadsig:onboarding-source";
export const ONBOARDING_PROFILE_STORAGE_KEY = "leadsig:onboarding-profile";
export const ONBOARDING_IMPORT_STORAGE_KEY = "leadsig:onboarding-import";
export const ONBOARDING_TUTORIAL_STORAGE_KEY = "leadsig:onboarding-tutorial";
export const ONBOARDING_PLAN_STORAGE_KEY = "leadsig:onboarding-plan";
export const ONBOARDING_PREVIOUS_CRM_STORAGE_KEY = "leadsig:onboarding-previous-crm";
export const SIGNUP_SOURCE_STORAGE_KEY = "leadsig:signup-source";
export const POST_ONBOARDING_SKOOL_MODAL_STORAGE_KEY = "leadsig:post-onboarding-skool-modal";

type SourceState = "pending" | "completed";
type ProfileState = "pending" | "completed";
type ImportState = "pending" | "completed";
type TutorialState = "pending" | "completed";
type PlanState = "pending" | "completed";
type SignupSource = "elo" | "default";

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

function getStoredProfileState(): ProfileState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(ONBOARDING_PROFILE_STORAGE_KEY);
  return value === "pending" || value === "completed" ? value : null;
}

function getStoredTutorialState(): TutorialState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(ONBOARDING_TUTORIAL_STORAGE_KEY);
  return value === "pending" || value === "completed" ? value : null;
}

function getStoredPlanState(): PlanState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(ONBOARDING_PLAN_STORAGE_KEY);
  return value === "pending" || value === "completed" ? value : null;
}

export function shouldShowOnboardingTutorial() {
  return getStoredTutorialState() === "pending";
}

export function shouldShowOnboardingSource() {
  return getStoredSourceState() === "pending";
}

export function shouldShowOnboardingProfile() {
  return getStoredProfileState() === "pending";
}

export function shouldShowOnboardingImport() {
  return getStoredImportState() === "pending";
}

export function shouldShowOnboardingPlan() {
  return getStoredPlanState() === "pending";
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

export function markOnboardingProfilePending() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_PROFILE_STORAGE_KEY, "pending");
}

export function completeOnboardingImport() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_IMPORT_STORAGE_KEY, "completed");
}

export function completeOnboardingProfile() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_PROFILE_STORAGE_KEY, "completed");
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

export function markOnboardingPlanPending() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_PLAN_STORAGE_KEY, "pending");
}

export function completeOnboardingPlan() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ONBOARDING_PLAN_STORAGE_KEY, "completed");
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

export function setSignupSource(source: SignupSource) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SIGNUP_SOURCE_STORAGE_KEY, source);
}

export function getSignupSource(): SignupSource | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(SIGNUP_SOURCE_STORAGE_KEY);
  return value === "elo" || value === "default" ? value : null;
}

export function markPostOnboardingSkoolModalPending() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(POST_ONBOARDING_SKOOL_MODAL_STORAGE_KEY, "pending");
}

export function shouldShowPostOnboardingSkoolModal() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(POST_ONBOARDING_SKOOL_MODAL_STORAGE_KEY) === "pending";
}

export function clearPostOnboardingSkoolModalPending() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(POST_ONBOARDING_SKOOL_MODAL_STORAGE_KEY);
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
      markOnboardingProfilePending();
      markOnboardingImportPending();
      markOnboardingTutorialPending();
      markOnboardingPlanPending();
      return "/onboarding/source";
    }

    markOnboardingTutorialPending();
    return "/tutorial";
  }

  if (shouldShowOnboardingSource()) {
    return "/onboarding/source";
  }

  if (shouldShowOnboardingProfile()) {
    return "/onboarding/profile";
  }

  if (shouldShowOnboardingImport()) {
    return "/onboarding/import";
  }

  if (shouldShowOnboardingTutorial()) {
    return "/tutorial";
  }

  return shouldShowOnboardingPlan() ? "/onboarding/plan" : "/";
}
