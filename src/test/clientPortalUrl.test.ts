import { afterEach, describe, expect, it, vi } from "vitest";

import { buildClientPortalShareUrl, buildClientPortalUrl } from "@/lib/clientPortalUrl";

describe("client portal url helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a direct client portal URL", () => {
    expect(buildClientPortalUrl("token_123")).toBe("/client/job?token=token_123");
    expect(buildClientPortalUrl("token_123", "job_789")).toBe("/client/job?token=token_123&jobId=job_789");
  });

  it("builds a share URL that points to the app site URL when configured", () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    expect(buildClientPortalShareUrl("token_123")).toBe(
      "https://app.example.com/client/job?token=token_123",
    );
    expect(buildClientPortalShareUrl("token_123", "job_789")).toBe(
      "https://app.example.com/client/job?token=token_123&jobId=job_789",
    );
  });

  it("falls back to current browser origin when site URL is not configured", () => {
    vi.stubEnv("VITE_SITE_URL", "");
    expect(buildClientPortalShareUrl("token_123")).toBe("http://localhost:3000/client/job?token=token_123");
    expect(buildClientPortalShareUrl("token_123", "job_789")).toBe(
      "http://localhost:3000/client/job?token=token_123&jobId=job_789",
    );
  });

  it("prefers custom domain when provided", () => {
    vi.stubEnv("VITE_SITE_URL", "https://app.example.com");
    expect(
      buildClientPortalShareUrl("token_123", { customDomain: "www.acme.com" }),
    ).toBe("https://www.acme.com/client/job?token=token_123");
    expect(
      buildClientPortalShareUrl("token_123", { customDomain: "https://portal.acme.com", jobId: "job_789" }),
    ).toBe("https://portal.acme.com/client/job?token=token_123&jobId=job_789");
  });
});
