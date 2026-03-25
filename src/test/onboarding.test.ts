import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import {
  completeOnboardingImport,
  completeOnboardingTutorial,
  getPostAuthRedirectPath,
  ONBOARDING_IMPORT_STORAGE_KEY,
  ONBOARDING_TUTORIAL_STORAGE_KEY,
  shouldShowOnboardingImport,
  shouldShowOnboardingTutorial,
} from "@/lib/onboarding";
import { filterSearchPages } from "@/lib/globalSearch";
import { onboardingSlides } from "@/lib/onboardingContent";
import Tutorial from "@/pages/Tutorial";

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) =>
    createElement("header", null, createElement("h1", null, title), subtitle ? createElement("p", null, subtitle) : null),
}));

describe("onboarding tutorial state", () => {
  it("routes new signups to the import onboarding step", () => {
    localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    expect(getPostAuthRedirectPath({ isNewSignup: true })).toBe("/onboarding/import");
    expect(shouldShowOnboardingImport()).toBe(true);
    expect(shouldShowOnboardingTutorial()).toBe(true);
  });

  it("routes to import onboarding before tutorial when import is pending", () => {
    localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    getPostAuthRedirectPath({ isNewSignup: true });

    expect(getPostAuthRedirectPath({ isNewSignup: false })).toBe("/onboarding/import");
  });

  it("routes to tutorial after import onboarding is complete", () => {
    localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    getPostAuthRedirectPath({ isNewSignup: true });
    completeOnboardingImport();

    expect(shouldShowOnboardingImport()).toBe(false);
    expect(getPostAuthRedirectPath({ isNewSignup: false })).toBe("/tutorial");
  });

  it("marks the tutorial complete after finishing", () => {
    localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);

    getPostAuthRedirectPath({ isNewSignup: true });
    completeOnboardingImport();
    completeOnboardingTutorial();

    expect(shouldShowOnboardingTutorial()).toBe(false);
    expect(getPostAuthRedirectPath({ isNewSignup: false })).toBe("/");
  });
});

describe("global search tutorial entry", () => {
  it("finds the tutorial from onboarding-related terms", () => {
    const results = filterSearchPages("tutorial", "owner");

    expect(results.some((page) => page.path === "/tutorial")).toBe(true);
  });

  it("finds import onboarding replay from import-related terms", () => {
    const results = filterSearchPages("import", "owner");

    expect(results.some((page) => page.path === "/onboarding/import")).toBe(true);
  });
});

describe("onboarding slide content", () => {
  it("keeps the requested onboarding stages in order", () => {
    expect(onboardingSlides.map((slide) => slide.id)).toEqual([
      "dashboard",
      "lead-to-job",
      "unassigned-job",
      "need-invoice-job",
      "client-portal",
      "calendar",
      "payment",
      "integrations",
    ]);
  });

  it("renders tutorial details before media in the mobile DOM order", () => {
    const { container } = render(
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

    const slideTitle = screen.getByRole("heading", { name: "Dashboard" });
    const slideImage = screen.getByRole("img", { name: "Dashboard" });
    const cardGrid = container.querySelector(".grid");

    expect(cardGrid).not.toBeNull();
    expect(cardGrid?.firstElementChild).toContainElement(slideTitle);
    expect(cardGrid?.lastElementChild).toContainElement(slideImage);
  });

  it("caps desktop media height to 80 percent of the viewport", () => {
    const { container } = render(
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

    const mediaPanel = container.querySelector(".lg\\:max-h-\\[80vh\\]");

    expect(mediaPanel).not.toBeNull();
  });

  it("resizes tutorial media without cropping it", () => {
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

    const slideImage = screen.getByRole("img", { name: "Dashboard" });

    expect(slideImage.className).toContain("object-contain");
  });
});
