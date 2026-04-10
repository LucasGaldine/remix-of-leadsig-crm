import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import SmsConsent from "@/pages/SmsConsent";
import PrivacyPolicy from "@/pages/PrivacyPolicy";

vi.mock("@/components/layout/PageHeader", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));

describe("Legal route declarations", () => {
  it("declares /privacy-policy and /sms-consent routes", () => {
    const appPath = resolve(process.cwd(), "src/App.tsx");
    const appSource = readFileSync(appPath, "utf8");

    expect(appSource).toContain('path: "/privacy-policy"');
    expect(appSource).toContain('path: "/privacy"');
    expect(appSource).toContain('path: "/sms-consent"');
    expect(appSource).toContain('path: "/terms"');
  });
});

describe("Legal pages", () => {
  it("renders SMS consent disclosure content", () => {
    render(
      <MemoryRouter>
        <SmsConsent />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "SMS Consent" })).toBeInTheDocument();
    expect(screen.getByText(/Reply STOP to opt out and HELP for help/i)).toBeInTheDocument();
  });

  it("renders privacy policy with SMS non-sharing clause", () => {
    render(
      <MemoryRouter>
        <PrivacyPolicy />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/SMS opt-in data and consent will not be sold or shared with third parties or affiliates for marketing purposes/i),
    ).toBeInTheDocument();
  });
});
