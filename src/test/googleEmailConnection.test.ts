import { describe, expect, it } from "vitest";

import { normalizeGoogleEmailConnectionRow } from "@/lib/googleEmailConnection";

describe("normalizeGoogleEmailConnectionRow", () => {
  it("returns a disconnected state for missing rows", () => {
    expect(normalizeGoogleEmailConnectionRow(null)).toEqual({
      isConnected: false,
      connectedEmail: null,
      provider: null,
    });
  });

  it("normalizes a connected Google sender row", () => {
    expect(
      normalizeGoogleEmailConnectionRow({
        provider: "google",
        connected_email: "owner@example.com",
        access_token: "access",
        refresh_token: "refresh",
      }),
    ).toEqual({
      isConnected: true,
      connectedEmail: "owner@example.com",
      provider: "google",
    });
  });

  it("treats rows without a refresh token as disconnected", () => {
    expect(
      normalizeGoogleEmailConnectionRow({
        provider: "google",
        connected_email: "owner@example.com",
        access_token: "access",
      }),
    ).toEqual({
      isConnected: false,
      connectedEmail: null,
      provider: null,
    });
  });
});
