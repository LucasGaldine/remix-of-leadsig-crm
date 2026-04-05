import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AffiliateSignup from "@/pages/AffiliateSignup";

const { rpcMock, toastErrorMock, toastSuccessMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: rpcMock,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

describe("AffiliateSignup", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    toastErrorMock.mockReset();
    toastSuccessMock.mockReset();
  });

  it("keeps create button disabled until required fields are complete and valid", () => {
    render(
      <MemoryRouter>
        <AffiliateSignup />
      </MemoryRouter>,
    );

    const submitButton = screen.getByRole("button", { name: /create affiliate link/i });
    const nameInput = screen.getByLabelText(/full name/i);
    const emailInput = screen.getByLabelText(/email/i);
    const promotionInput = screen.getByLabelText(/how do you plan to promote your affiliate link/i);

    expect(submitButton).toBeDisabled();
    expect(
      screen.getByText(/complete required fields: full name, email, promotion strategy/i),
    ).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: "Taylor Smith" } });

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/complete required fields: email, promotion strategy/i)).toBeInTheDocument();

    fireEvent.change(emailInput, { target: { value: "taylor" } });

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/complete required fields: valid email, promotion strategy/i)).toBeInTheDocument();
    expect(emailInput).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(emailInput, { target: { value: "taylor@example.com" } });

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/complete required fields: promotion strategy/i)).toBeInTheDocument();

    fireEvent.change(promotionInput, {
      target: { value: "I will share on Instagram, YouTube, and with clients by email." },
    });

    expect(submitButton).not.toBeDisabled();
    expect(screen.queryByText(/complete required fields:/i)).not.toBeInTheDocument();
    expect(emailInput).toHaveAttribute("aria-invalid", "false");
  });

  it("sends the promotion strategy to affiliate signup RPC", async () => {
    rpcMock.mockResolvedValue({
      data: {
        affiliate_id: "00000000-0000-0000-0000-000000000001",
        referral_code: "AFF123TEST",
        referral_link: "https://app.test/auth?ref=AFF123TEST",
      },
      error: null,
    });

    render(
      <MemoryRouter>
        <AffiliateSignup />
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "Taylor Smith" } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "taylor@example.com" } });
    fireEvent.change(screen.getByLabelText(/how do you plan to promote your affiliate link/i), {
      target: { value: "Instagram reels and neighborhood Facebook groups." },
    });

    fireEvent.click(screen.getByRole("button", { name: /create affiliate link/i }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("upsert_affiliate_signup", {
        p_full_name: "Taylor Smith",
        p_email: "taylor@example.com",
        p_marketing_plan: "Instagram reels and neighborhood Facebook groups.",
        p_base_url: window.location.origin,
      });
    });
  });
});
