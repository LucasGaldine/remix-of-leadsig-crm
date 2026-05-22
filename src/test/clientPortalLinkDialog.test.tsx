import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientPortalLinkDialog } from "@/components/shared/ClientPortalLinkDialog";

const { toastErrorMock } = vi.hoisted(() => ({
  toastErrorMock: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

describe("ClientPortalLinkDialog", () => {
  it("renders text as primary and email as secondary full-width actions", () => {
    render(
      <ClientPortalLinkDialog
        open
        onOpenChange={vi.fn()}
        portalLink="https://example.com/client/job?token=abc"
        copied={false}
        onCopy={vi.fn()}
        onEmailClient={vi.fn()}
        clientPhone="5551234567"
        clientEmail="client@example.com"
      />,
    );

    const textButton = screen.getByRole("button", { name: /send via text/i });
    const emailButton = screen.getByRole("button", { name: /send via email/i });

    expect(textButton.className).toContain("flex-1");
    expect(emailButton.className).toContain("flex-1");
    expect(textButton.className).toContain("bg-primary");
    expect(emailButton.className).toContain("bg-secondary");
    expect(textButton).not.toBeDisabled();
    expect(emailButton).not.toBeDisabled();
  });

  it("shows disabled state copy and explains why actions are unavailable when contact values are missing", () => {
    render(
      <ClientPortalLinkDialog
        open
        onOpenChange={vi.fn()}
        portalLink="https://example.com/client/job?token=abc"
        copied={false}
        onCopy={vi.fn()}
        onEmailClient={vi.fn()}
        clientPhone=""
        clientEmail=""
      />,
    );

    const textButton = screen.getByRole("button", { name: /send via text/i });
    const emailButton = screen.getByRole("button", { name: /send via email/i });

    expect(textButton).toHaveAttribute("aria-disabled", "true");
    expect(emailButton).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(textButton);
    fireEvent.click(emailButton);

    expect(toastErrorMock).toHaveBeenCalledWith("Add a customer phone number before sending a text.");
    expect(toastErrorMock).toHaveBeenCalledWith("Add a customer email before sending an email.");
  });

  it("uses the text callback when provided and does not open sms directly", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const onTextClient = vi.fn().mockResolvedValue(undefined);

    render(
      <ClientPortalLinkDialog
        open
        onOpenChange={vi.fn()}
        portalLink="https://example.com/client/job?token=abc"
        copied={false}
        onCopy={vi.fn()}
        onTextClient={onTextClient}
        onEmailClient={vi.fn()}
        clientPhone="5551234567"
        clientEmail="client@example.com"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /send via text/i }));

    expect(onTextClient).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalledWith("sms:5551234567", "_blank");

    openSpy.mockRestore();
  });

  it("opens sms and calls the email send callback when actions are clicked", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const onEmailClient = vi.fn().mockResolvedValue(undefined);

    render(
      <ClientPortalLinkDialog
        open
        onOpenChange={vi.fn()}
        portalLink="https://example.com/client/job?token=abc"
        copied={false}
        onCopy={vi.fn()}
        onEmailClient={onEmailClient}
        clientPhone="5551234567"
        clientEmail="client@example.com"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /send via text/i }));
    fireEvent.click(screen.getByRole("button", { name: /send via email/i }));

    expect(openSpy).toHaveBeenCalledWith("sms:5551234567", "_blank");
    expect(onEmailClient).toHaveBeenCalledTimes(1);
    expect(openSpy).not.toHaveBeenCalledWith("mailto:client@example.com", "_blank");

    openSpy.mockRestore();
  });

  it("shows email send status feedback on the email action button", () => {
    const { rerender } = render(
      <ClientPortalLinkDialog
        open
        onOpenChange={vi.fn()}
        portalLink="https://example.com/client/job?token=abc"
        copied={false}
        onCopy={vi.fn()}
        onEmailClient={vi.fn()}
        clientPhone="5551234567"
        clientEmail="client@example.com"
      />,
    );

    expect(screen.getByRole("button", { name: /send via email/i })).toBeEnabled();

    rerender(
      <ClientPortalLinkDialog
        open
        onOpenChange={vi.fn()}
        portalLink="https://example.com/client/job?token=abc"
        copied={false}
        onCopy={vi.fn()}
        onEmailClient={vi.fn()}
        emailSending
        clientPhone="5551234567"
        clientEmail="client@example.com"
      />,
    );

    expect(screen.getByRole("button", { name: /sending/i })).toBeDisabled();

    rerender(
      <ClientPortalLinkDialog
        open
        onOpenChange={vi.fn()}
        portalLink="https://example.com/client/job?token=abc"
        copied={false}
        onCopy={vi.fn()}
        onEmailClient={vi.fn()}
        emailSent
        clientPhone="5551234567"
        clientEmail="client@example.com"
      />,
    );

    expect(screen.getByRole("button", { name: /email sent/i })).toBeEnabled();
  });

  it("renders compact portal status text below the link", () => {
    const { rerender } = render(
      <ClientPortalLinkDialog
        open
        onOpenChange={vi.fn()}
        portalLink="https://example.com/client/job?token=abc"
        copied={false}
        onCopy={vi.fn()}
        clientPhone="5551234567"
        clientEmail="client@example.com"
      />,
    );

    expect(screen.getByText(/not sent yet/i)).toBeInTheDocument();

    rerender(
      <ClientPortalLinkDialog
        open
        onOpenChange={vi.fn()}
        portalLink="https://example.com/client/job?token=abc"
        copied={false}
        onCopy={vi.fn()}
        clientPhone="5551234567"
        clientEmail="client@example.com"
        portalSentAt="2026-05-22T19:14:00.000Z"
      />,
    );

    expect(screen.getByText(/not viewed yet/i)).toBeInTheDocument();

    rerender(
      <ClientPortalLinkDialog
        open
        onOpenChange={vi.fn()}
        portalLink="https://example.com/client/job?token=abc"
        copied={false}
        onCopy={vi.fn()}
        clientPhone="5551234567"
        clientEmail="client@example.com"
        portalSentAt="2026-05-22T19:14:00.000Z"
        portalViewedAt="2026-05-22T20:01:00.000Z"
      />,
    );

    expect(screen.getByText(/viewed on/i)).toBeInTheDocument();
  });
});
