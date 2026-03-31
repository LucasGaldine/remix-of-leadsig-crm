import { describe, expect, it } from "vitest";
import {
  isMainPagePath,
  shouldAnimateMainPageTransition,
} from "@/lib/pageTransition";

describe("page transition routing", () => {
  it("treats top-level nav destinations as main pages", () => {
    expect(isMainPagePath("/")).toBe(true);
    expect(isMainPagePath("/leads")).toBe(true);
    expect(isMainPagePath("/jobs")).toBe(true);
    expect(isMainPagePath("/schedule")).toBe(true);
    expect(isMainPagePath("/payments")).toBe(true);
    expect(isMainPagePath("/settings")).toBe(true);
  });

  it("does not treat detail and utility routes as main pages", () => {
    expect(isMainPagePath("/leads/123")).toBe(false);
    expect(isMainPagePath("/payments/invoices/new")).toBe(false);
    expect(isMainPagePath("/auth")).toBe(false);
  });

  it("animates only when navigating from one main page to another", () => {
    expect(shouldAnimateMainPageTransition("/leads", "/")).toBe(true);
    expect(shouldAnimateMainPageTransition("/jobs", "/leads")).toBe(true);
    expect(shouldAnimateMainPageTransition("/leads/123", "/leads")).toBe(false);
    expect(shouldAnimateMainPageTransition("/auth", "/settings")).toBe(false);
    expect(shouldAnimateMainPageTransition("/settings", null)).toBe(false);
  });
});
