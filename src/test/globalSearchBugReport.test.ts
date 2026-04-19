import { describe, expect, it } from "vitest";

import { filterSearchPages } from "@/lib/globalSearch";

describe("global search bug report entry", () => {
  it("finds report-a-bug from bug-related terms", () => {
    const results = filterSearchPages("bug", "owner");

    expect(results.some((page) => page.path === "/settings?reportBug=1")).toBe(true);
  });

  it("finds company profile from client portal query", () => {
    const results = filterSearchPages("client portal", "owner");

    expect(results.some((page) => page.path === "/settings/company")).toBe(true);
  });

  it("finds skool modal action from skool query", () => {
    const results = filterSearchPages("skool", "owner");

    expect(results.some((page) => page.path === "/?skoolModal=1")).toBe(true);
  });
});
