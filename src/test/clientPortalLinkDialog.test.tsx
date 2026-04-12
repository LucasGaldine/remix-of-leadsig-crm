import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientPortalLinkDialog } from "@/components/shared/ClientPortalLinkDialog";

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

    const textButton = screen.getByRole("button", { name: /text client/i });
    const emailButton = screen.getByRole("button", { name: /email client/i });

    expect(textButton.className).toContain("flex-1");
    expect(emailButton.className).toContain("flex-1");
    expect(textButton.className).toContain("bg-primary");
    expect(emailButton.className).toContain("bg-secondary");
    expect(textButton).not.toBeDisabled();
    expect(emailButton).not.toBeDisabled();
  });

  it("disables text and email actions when contact values are missing", () => {
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

    expect(screen.getByRole("button", { name: /text client/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /email client/i })).toBeDisabled();
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

    fireEvent.click(screen.getByRole("button", { name: /text client/i }));
    fireEvent.click(screen.getByRole("button", { name: /email client/i }));

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

    expect(screen.getByRole("button", { name: /email client/i })).toBeEnabled();

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
});
