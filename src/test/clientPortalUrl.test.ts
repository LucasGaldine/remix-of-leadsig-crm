import { describe, expect, it } from "vitest";

import { buildClientPortalShareUrl, buildClientPortalUrl } from "@/lib/clientPortalUrl";

describe("client portal url helpers", () => {
  it("builds a direct client portal URL", () => {
    expect(buildClientPortalUrl("token_123")).toBe("/client/job?token=token_123");
    expect(buildClientPortalUrl("token_123", "job_789")).toBe("/client/job?token=token_123&jobId=job_789");
  });

  it("builds a share URL that points to the portal preview page", () => {
    expect(buildClientPortalShareUrl("token_123")).toBe("/client-portal-share.html?token=token_123");
    expect(buildClientPortalShareUrl("token_123", "job_789")).toBe(
      "/client-portal-share.html?token=token_123&jobId=job_789",
    );
  });
});
