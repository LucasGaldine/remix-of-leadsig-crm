import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Tutorial from "@/pages/Tutorial";
import { ONBOARDING_PLAN_STORAGE_KEY, ONBOARDING_TUTORIAL_STORAGE_KEY } from "@/lib/onboarding";

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

describe("Tutorial completion routing", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    mockSearchParams = new URLSearchParams();
    window.localStorage.removeItem(ONBOARDING_PLAN_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);
  });

  it("routes to onboarding plan when skipping tutorial", () => {
    window.localStorage.setItem(ONBOARDING_TUTORIAL_STORAGE_KEY, "pending");
    render(<Tutorial />);

    fireEvent.click(screen.getByRole("button", { name: /Skip tutorial/i }));

    expect(window.localStorage.getItem(ONBOARDING_TUTORIAL_STORAGE_KEY)).toBe("completed");
    expect(window.localStorage.getItem(ONBOARDING_PLAN_STORAGE_KEY)).toBe("pending");
    expect(navigateMock).toHaveBeenCalledWith("/onboarding/plan");
  });

  it("routes to onboarding plan when finishing tutorial", () => {
    window.localStorage.setItem(ONBOARDING_TUTORIAL_STORAGE_KEY, "pending");
    render(<Tutorial />);

    fireEvent.click(screen.getByRole("button", { name: /Finish tutorial/i }));

    expect(window.localStorage.getItem(ONBOARDING_TUTORIAL_STORAGE_KEY)).toBe("completed");
    expect(window.localStorage.getItem(ONBOARDING_PLAN_STORAGE_KEY)).toBe("pending");
    expect(navigateMock).toHaveBeenCalledWith("/onboarding/plan");
  });
});
