import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import OnboardingImport from "@/pages/OnboardingImport";
import { ONBOARDING_IMPORT_STORAGE_KEY, ONBOARDING_PREVIOUS_CRM_STORAGE_KEY } from "@/lib/onboarding";

const navigateMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
    useSearchParams: () => [mockSearchParams, vi.fn()],
  };
});

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title, subtitle }: { title: string; subtitle?: string }) =>
    createElement("header", null, createElement("h1", null, title), subtitle ? createElement("p", null, subtitle) : null),
}));

vi.mock("@/components/leads/CSVImportModal", () => ({
  CSVImportModal: ({ open, onImportComplete }: { open: boolean; onImportComplete?: () => void }) =>
    open
      ? createElement(
          "div",
          null,
          createElement("p", null, "Leads import modal"),
          createElement("button", { type: "button", onClick: onImportComplete }, "Complete leads import"),
        )
      : null,
}));

vi.mock("@/components/customers/CustomerCSVImportModal", () => ({
  CustomerCSVImportModal: ({ open, onImportComplete }: { open: boolean; onImportComplete?: () => void }) =>
    open
      ? createElement(
          "div",
          null,
          createElement("p", null, "Clients import modal"),
          createElement("button", { type: "button", onClick: onImportComplete }, "Complete clients import"),
        )
      : null,
}));

vi.mock("@/components/jobs/JobCSVImportModal", () => ({
  JobCSVImportModal: ({ open, onImportComplete }: { open: boolean; onImportComplete?: () => void }) =>
    open
      ? createElement(
          "div",
          null,
          createElement("p", null, "Jobs import modal"),
          createElement("button", { type: "button", onClick: onImportComplete }, "Complete jobs import"),
        )
      : null,
}));

describe("OnboardingImport page", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mockSearchParams = new URLSearchParams();
    window.localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_PREVIOUS_CRM_STORAGE_KEY);
  });

  it("supports skipping imports and continues to tutorial", () => {
    render(<OnboardingImport />);

    fireEvent.click(screen.getByRole("button", { name: /Skip for now/i }));

    expect(window.localStorage.getItem(ONBOARDING_IMPORT_STORAGE_KEY)).toBe("completed");
    expect(navigateMock).toHaveBeenCalledWith("/tutorial");
  });

  it("continues to tutorial when skipping imports during replay mode", () => {
    mockSearchParams = new URLSearchParams("source=search");
    render(<OnboardingImport />);

    fireEvent.click(screen.getByRole("button", { name: /Skip for now/i }));

    expect(window.localStorage.getItem(ONBOARDING_IMPORT_STORAGE_KEY)).toBe("completed");
    expect(navigateMock).toHaveBeenCalledWith("/tutorial");
  });

  it("shows all import sections after selecting import now", () => {
    render(<OnboardingImport />);

    fireEvent.click(screen.getByRole("button", { name: /Import now/i }));

    expect(screen.getByRole("heading", { name: /Import leads/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Import clients/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Import jobs/i })).toBeInTheDocument();
  });

  it("does not show CRM comparison copy on the import slide", () => {
    window.localStorage.setItem(ONBOARDING_PREVIOUS_CRM_STORAGE_KEY, "Jobber");

    render(<OnboardingImport />);

    expect(screen.queryByText(/LeadSig is already outrunning Jobber/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Import now/i }));

    expect(screen.queryByText(/LeadSig is already outrunning Jobber/i)).not.toBeInTheDocument();
  });

  it("shows step indicator for the third onboarding step", () => {
    render(<OnboardingImport />);

    expect(screen.getByText(/^Step 3 of 3$/i)).toBeInTheDocument();
  });

  it("opens each import modal from the section actions", () => {
    render(<OnboardingImport />);

    fireEvent.click(screen.getByRole("button", { name: /Import now/i }));

    fireEvent.click(screen.getByRole("button", { name: /Import leads csv/i }));
    fireEvent.click(screen.getByRole("button", { name: /Import clients csv/i }));
    fireEvent.click(screen.getByRole("button", { name: /Import jobs csv/i }));

    expect(screen.getByText("Leads import modal")).toBeInTheDocument();
    expect(screen.getByText("Clients import modal")).toBeInTheDocument();
    expect(screen.getByText("Jobs import modal")).toBeInTheDocument();
  });
});
