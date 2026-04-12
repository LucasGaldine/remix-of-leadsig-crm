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
        clientPhone=""
        clientEmail=""
      />,
    );

    expect(screen.getByRole("button", { name: /text client/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /email client/i })).toBeDisabled();
  });

  it("opens sms and mailto links when actions are clicked", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
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

    fireEvent.click(screen.getByRole("button", { name: /text client/i }));
    fireEvent.click(screen.getByRole("button", { name: /email client/i }));

    expect(openSpy).toHaveBeenCalledWith("sms:5551234567", "_blank");
    expect(openSpy).toHaveBeenCalledWith("mailto:client@example.com", "_blank");

    openSpy.mockRestore();
  });
});
