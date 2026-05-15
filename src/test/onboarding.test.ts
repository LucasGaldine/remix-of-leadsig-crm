import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import {
  completeOnboardingImport,
  completeOnboardingProfile,
  completeOnboardingSource,
  completeOnboardingTutorial,
  getPostAuthRedirectPath,
  ONBOARDING_IMPORT_STORAGE_KEY,
  ONBOARDING_PREVIOUS_CRM_STORAGE_KEY,
  ONBOARDING_SOURCE_STORAGE_KEY,
  ONBOARDING_TUTORIAL_STORAGE_KEY,
  saveOnboardingPreviousCrm,
  getOnboardingPreviousCrm,
  shouldShowOnboardingImport,
  shouldShowOnboardingSource,
  shouldShowOnboardingTutorial,
} from "@/lib/onboarding";
import { filterSearchPages } from "@/lib/globalSearch";
import Tutorial from "@/pages/Tutorial";

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) =>
    createElement("header", null, createElement("h1", null, title), subtitle ? createElement("p", null, subtitle) : null),
}));

describe("onboarding tutorial state", () => {
  it("routes new signups to the CRM source onboarding step", () => {
    window.localStorage.removeItem(ONBOARDING_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    expect(getPostAuthRedirectPath({ isNewSignup: true })).toBe("/onboarding/source");
    expect(shouldShowOnboardingSource()).toBe(true);
    expect(shouldShowOnboardingImport()).toBe(true);
    expect(shouldShowOnboardingTutorial()).toBe(true);
  });

  it("routes new signups to tutorial even when onboarding setup steps are skipped", () => {
    window.localStorage.removeItem(ONBOARDING_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    expect(getPostAuthRedirectPath({ isNewSignup: true, shouldStartOnboarding: false })).toBe("/tutorial");
    expect(shouldShowOnboardingSource()).toBe(false);
    expect(shouldShowOnboardingImport()).toBe(false);
    expect(shouldShowOnboardingTutorial()).toBe(true);
  });

  it("routes to CRM source onboarding first when source and import are pending", () => {
    window.localStorage.removeItem(ONBOARDING_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    getPostAuthRedirectPath({ isNewSignup: true });

    expect(getPostAuthRedirectPath({ isNewSignup: false })).toBe("/onboarding/source");
  });

  it("routes to profile onboarding after CRM source is complete", () => {
    window.localStorage.removeItem(ONBOARDING_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    getPostAuthRedirectPath({ isNewSignup: true });
    completeOnboardingSource();

    expect(shouldShowOnboardingSource()).toBe(false);
    expect(getPostAuthRedirectPath({ isNewSignup: false })).toBe("/onboarding/profile");
  });

  it("routes to import onboarding after profile onboarding is complete", () => {
    window.localStorage.removeItem(ONBOARDING_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    getPostAuthRedirectPath({ isNewSignup: true });
    completeOnboardingSource();
    completeOnboardingProfile();

    expect(getPostAuthRedirectPath({ isNewSignup: false })).toBe("/onboarding/import");
  });

  it("routes to tutorial after import onboarding is complete", () => {
    window.localStorage.removeItem(ONBOARDING_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    getPostAuthRedirectPath({ isNewSignup: true });
    completeOnboardingSource();
    completeOnboardingProfile();
    completeOnboardingImport();

    expect(shouldShowOnboardingImport()).toBe(false);
    expect(getPostAuthRedirectPath({ isNewSignup: false })).toBe("/tutorial");
  });

  it("marks the tutorial complete and routes to plan onboarding", () => {
    window.localStorage.removeItem(ONBOARDING_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    getPostAuthRedirectPath({ isNewSignup: true });
    completeOnboardingSource();
    completeOnboardingProfile();
    completeOnboardingImport();
    completeOnboardingTutorial();

    expect(shouldShowOnboardingTutorial()).toBe(false);
    expect(getPostAuthRedirectPath({ isNewSignup: false })).toBe("/onboarding/plan");
  });
});

describe("onboarding previous CRM state", () => {
  it("stores and retrieves selected previous CRM", () => {
    window.localStorage.removeItem(ONBOARDING_PREVIOUS_CRM_STORAGE_KEY);

    saveOnboardingPreviousCrm("Jobber");

    expect(getOnboardingPreviousCrm()).toBe("Jobber");
  });

  it("returns null when no previous CRM is set", () => {
    window.localStorage.removeItem(ONBOARDING_PREVIOUS_CRM_STORAGE_KEY);

    expect(getOnboardingPreviousCrm()).toBeNull();
  });
});

describe("global search tutorial entry", () => {
  it("finds the tutorial from onboarding-related terms", () => {
    const results = filterSearchPages("tutorial", "owner");

    expect(results.some((page) => page.path === "/tutorial")).toBe(true);
  });

  it("finds CRM source replay from onboarding-related terms", () => {
    const results = filterSearchPages("crm", "owner");

    expect(results.some((page) => page.path === "/onboarding/source")).toBe(true);
  });

  it("finds import onboarding replay from import-related terms", () => {
    const results = filterSearchPages("import", "owner");

    expect(results.some((page) => page.path === "/onboarding/import")).toBe(true);
  });
});

describe("tutorial page content", () => {
  it("renders the embedded tutorial video", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/tutorial"] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: "/tutorial", element: createElement(Tutorial) }),
        ),
      ),
    );

    const iframe = screen.getByTitle("LeadSig product tutorial video");
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute("src")).toBe("https://www.youtube.com/embed/BqVdPVgaqqY");
  });

  it("removes legacy walkthrough content", () => {
    render(
      createElement(
        MemoryRouter,
        { initialEntries: ["/tutorial"] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: "/tutorial", element: createElement(Tutorial) }),
        ),
      ),
    );

    expect(screen.getByText("Video tutorial")).toBeInTheDocument();
    expect(screen.queryByText("Product walkthrough")).toBeNull();
    expect(screen.queryByLabelText(/^Tutorial scene:/i)).toBeNull();
  });
});
