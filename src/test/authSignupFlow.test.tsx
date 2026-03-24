import { createContext, useContext, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import Auth from "@/pages/Auth";

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
});
