import { describe, expect, it } from "vitest";

import {
  darkenHexColor,
  DEFAULT_CLIENT_PORTAL_COLOR,
  normalizeClientPortalColor,
} from "@/lib/clientPortalTheme";

describe("clientPortalTheme", () => {
  it("normalizes valid hex colors and expands short values", () => {
    expect(normalizeClientPortalColor("#1E3A8A")).toBe("#1e3a8a");
    expect(normalizeClientPortalColor("#abc")).toBe("#aabbcc");
  });

  it("falls back to default for invalid values", () => {
    expect(normalizeClientPortalColor("not-a-color")).toBe(DEFAULT_CLIENT_PORTAL_COLOR);
    expect(normalizeClientPortalColor("")).toBe(DEFAULT_CLIENT_PORTAL_COLOR);
    expect(normalizeClientPortalColor(null)).toBe(DEFAULT_CLIENT_PORTAL_COLOR);
  });

  it("returns a darker hex color", () => {
    expect(darkenHexColor("#808080", 0.25)).toBe("#606060");
  });
});
