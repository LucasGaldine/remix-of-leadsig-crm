import { describe, expect, it } from "vitest";

import { ADMIN_APP_HOSTNAME, buildAdminAppUrl, isAdminAppHostname } from "@/lib/adminDomain";

describe("adminDomain", () => {
  it("matches the configured admin hostname", () => {
    expect(isAdminAppHostname("admin.leadsig.ai")).toBe(true);
    expect(isAdminAppHostname("ADMIN.LEADSIG.AI")).toBe(true);
    expect(isAdminAppHostname(` ${ADMIN_APP_HOSTNAME} `)).toBe(true);
  });

  it("rejects non-admin hosts", () => {
    expect(isAdminAppHostname("app.leadsig.ai")).toBe(false);
    expect(isAdminAppHostname("leadsig.ai")).toBe(false);
  });

  it("builds admin domain URLs with normalized segments", () => {
    expect(buildAdminAppUrl("admin", "foo=1", "section")).toBe(
      "https://admin.leadsig.ai/admin?foo=1#section"
    );

    expect(buildAdminAppUrl("/admin", "?foo=1", "#section")).toBe(
      "https://admin.leadsig.ai/admin?foo=1#section"
    );
  });
});
