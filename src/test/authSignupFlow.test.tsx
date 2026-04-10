import { createContext, useContext, useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Auth from "@/pages/Auth";
import {
  ONBOARDING_IMPORT_STORAGE_KEY,
  ONBOARDING_SOURCE_STORAGE_KEY,
  ONBOARDING_TUTORIAL_STORAGE_KEY,
} from "@/lib/onboarding";

const { navigateMock, signInMock, signUpMock } = vi.hoisted(() => ({
  navigateMock: vi.fn(),
  signInMock: vi.fn(),
  signUpMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: null,
    signIn: signInMock,
    signUp: signUpMock,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/usePasswordStrength", () => ({
  usePasswordStrength: () => ({
    isValid: true,
    requirements: { notCommon: true },
    feedback: [],
  }),
}));

vi.mock("@/components/auth/PasswordStrengthIndicator", () => ({
  PasswordStrengthIndicator: () => <div>Password strength</div>,
}));

vi.mock("@/components/auth/ForgotPasswordDialog", () => ({
  ForgotPasswordDialog: () => null,
}));

const TabsContext = createContext<{
  value: string;
  setValue: (value: string) => void;
} | null>(null);

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value: string;
    onValueChange: (value: string) => void;
  }) => {
    const [internalValue, setInternalValue] = useState(value);
    return (
      <TabsContext.Provider
        value={{
          value: internalValue,
          setValue: (nextValue: string) => {
            setInternalValue(nextValue);
            onValueChange(nextValue);
          },
        }}
      >
        <div>{children}</div>
      </TabsContext.Provider>
    );
  },
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => {
    const context = useContext(TabsContext)!;
    return (
      <button role="tab" onClick={() => context.setValue(value)}>
        {children}
      </button>
    );
  },
  TabsContent: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => {
    const context = useContext(TabsContext)!;
    if (context.value !== value) return null;
    return <div>{children}</div>;
  },
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => (
    <div data-value={value}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("Auth signup flow", () => {
  beforeEach(() => {
    signInMock.mockReset();
    signUpMock.mockReset();
    navigateMock.mockReset();
    window.localStorage.removeItem(ONBOARDING_SOURCE_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_IMPORT_STORAGE_KEY);
    window.localStorage.removeItem(ONBOARDING_TUTORIAL_STORAGE_KEY);
  });

  it("uses a three-step signup flow with company choice before company details", () => {
    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Sign Up/i }));

    expect(screen.getByText(/Step 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Company Code/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Taylor Smith" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "taylor@example.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "StrongPassword123!" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to receive SMS messages from LeadSig/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create a new company/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Join an existing company/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Join an existing company/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(screen.getByText(/Step 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Company Code/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Company Name/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    fireEvent.click(screen.getByRole("button", { name: /Create a new company/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(screen.getByLabelText(/Company Name/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Company Code/i)).not.toBeInTheDocument();
  });

  it("redirects new company signups into onboarding sequence", async () => {
    signUpMock.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Sign Up/i }));

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Taylor Smith" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "taylor@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "StrongPassword123!" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to receive SMS messages from LeadSig/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    fireEvent.click(screen.getByRole("button", { name: /Create a new company/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: "LeadSig Landscaping" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create Company & Account$/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/onboarding/source");
    });

    expect(window.localStorage.getItem(ONBOARDING_SOURCE_STORAGE_KEY)).toBe("pending");
    expect(window.localStorage.getItem(ONBOARDING_IMPORT_STORAGE_KEY)).toBe("pending");
    expect(window.localStorage.getItem(ONBOARDING_TUTORIAL_STORAGE_KEY)).toBe("pending");
  });

  it("redirects join-company signups to tutorial", async () => {
    signUpMock.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Sign Up/i }));

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Taylor Smith" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "taylor@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "StrongPassword123!" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to receive SMS messages from LeadSig/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    fireEvent.click(screen.getByRole("button", { name: /Join an existing company/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    fireEvent.change(screen.getByLabelText(/Company Code/i), { target: { value: "ABC123" } });
    fireEvent.click(screen.getByRole("button", { name: /^Join Company$/i }));

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith("/tutorial");
    });
  });

  it("passes affiliate referral code from the signup URL", async () => {
    signUpMock.mockResolvedValue({ error: null });

    render(
      <MemoryRouter initialEntries={["/auth?ref=partner777"]}>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Sign Up/i }));

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Taylor Smith" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "taylor@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "StrongPassword123!" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /I agree to receive SMS messages from LeadSig/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    fireEvent.click(screen.getByRole("button", { name: /Create a new company/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.change(screen.getByLabelText(/Company Name/i), { target: { value: "LeadSig Landscaping" } });
    fireEvent.click(screen.getByRole("button", { name: /^Create Company & Account$/i }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith(
        "taylor@example.com",
        "StrongPassword123!",
        "Taylor Smith",
        "owner",
        expect.objectContaining({ companyName: "LeadSig Landscaping" }),
        expect.objectContaining({
          status: "opted_in",
          source: "signup_form",
          textVersion: "2026-04-09-v1",
          capturedAt: expect.any(String),
        }),
        "",
        "PARTNER777",
      );
    });
  });

  it("allows step 1 continue without opting in to SMS", () => {
    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Sign Up/i }));
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Taylor Smith" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "taylor@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "StrongPassword123!" } });

    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    expect(screen.getByText(/Step 2 of 3/i)).toBeInTheDocument();
  });

  it("submits opted-out SMS consent metadata when user leaves SMS unchecked", async () => {
    signUpMock.mockResolvedValue({ error: null });

    render(
      <MemoryRouter>
        <Auth />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("tab", { name: /Sign Up/i }));
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Taylor Smith" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "taylor@example.com" } });
    fireEvent.change(screen.getByLabelText(/^Password$/i), { target: { value: "StrongPassword123!" } });
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    fireEvent.click(screen.getByRole("button", { name: /Join an existing company/i }));
    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));
    fireEvent.change(screen.getByLabelText(/Company Code/i), { target: { value: "ABC123" } });
    fireEvent.click(screen.getByRole("button", { name: /^Join Company$/i }));

    await waitFor(() => {
      expect(signUpMock).toHaveBeenCalledWith(
        "taylor@example.com",
        "StrongPassword123!",
        "Taylor Smith",
        "sales",
        expect.objectContaining({ companyCode: "ABC123" }),
        expect.objectContaining({
          status: "opted_out",
          source: "signup_form",
          textVersion: "2026-04-09-v1",
          capturedAt: expect.any(String),
        }),
        "",
        null,
      );
    });
  });
});
