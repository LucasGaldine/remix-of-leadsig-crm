import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OnboardingSource from "@/pages/OnboardingSource";
import { ONBOARDING_PREVIOUS_CRM_STORAGE_KEY, ONBOARDING_SOURCE_STORAGE_KEY } from "@/lib/onboarding";

const navigateMock = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) =>
    createElement("header", null, createElement("h1", null, title), subtitle ? createElement("p", null, subtitle) : null),
}));

describe("OnboardingSource page", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    window.localStorage.removeItem(ONBOARDING_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_PREVIOUS_CRM_STORAGE_KEY);
  });

  it("captures selected CRM and continues to profile onboarding", () => {
    render(<OnboardingSource />);

    fireEvent.click(screen.getByRole("button", { name: /Jobber/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    expect(window.localStorage.getItem(ONBOARDING_PREVIOUS_CRM_STORAGE_KEY)).toBe("Jobber");
    expect(window.localStorage.getItem(ONBOARDING_SOURCE_STORAGE_KEY)).toBe("completed");
    expect(navigateMock).toHaveBeenCalledWith("/onboarding/profile");
  });

  it("supports custom CRM names", () => {
    render(<OnboardingSource />);

    fireEvent.click(screen.getByRole("button", { name: /Other/i }));
    fireEvent.change(screen.getByLabelText(/Previous CRM name/i), { target: { value: "Pipedrive" } });
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    expect(window.localStorage.getItem(ONBOARDING_PREVIOUS_CRM_STORAGE_KEY)).toBe("Pipedrive");
  });

  it("shows CRM comparison on source page 2 with vertical bars", () => {
    window.localStorage.setItem(ONBOARDING_PREVIOUS_CRM_STORAGE_KEY, "Jobber");
    render(<OnboardingSource />);

    expect(screen.queryByText(/LeadSig is already outrunning Jobber/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));

    expect(screen.getByText(/LeadSig is already outrunning Jobber/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /CRM performance comparison/i })).toHaveAttribute("aria-orientation", "vertical");
  });

  it("shows step indicator for the first onboarding step", () => {
    render(<OnboardingSource />);

    expect(screen.getByText(/^Step 1 of 3$/i)).toBeInTheDocument();
  });
});
