import { afterEach, describe, expect, it, vi } from "vitest";

import { buildWebsitePublicUrl } from "@/lib/websiteUrl";

describe("website url helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds account site URL using configured site URL", () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    expect(buildWebsitePublicUrl("acct_123")).toBe("https://app.example.com/site/acct_123");
  });

  it("falls back to current browser origin when site URL is not configured", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    expect(buildWebsitePublicUrl("acct_123")).toBe("http://localhost:3000/site/acct_123");
  });

  it("prefers custom domain when provided", () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    expect(buildWebsitePublicUrl("acct_123", { customDomain: "www.acme.com" })).toBe("https://www.acme.com/");
    expect(buildWebsitePublicUrl("acct_123", { customDomain: "https://acme.com" })).toBe("https://acme.com/");
  });
});
