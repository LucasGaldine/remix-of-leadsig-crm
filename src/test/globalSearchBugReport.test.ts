import { describe, expect, it } from "vitest";

import { filterSearchPages } from "@/lib/globalSearch";

describe("global search bug report entry", () => {
  it("finds report-a-bug from bug-related terms", () => {
    const results = filterSearchPages("bug", "owner");

    expect(results.some((page) => page.path === "/settings?reportBug=1")).toBe(true);
  });
});
