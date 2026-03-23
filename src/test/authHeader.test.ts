import { describe, expect, it } from "vitest";

import {
  decodeJwtPayload,
  extractBearerToken,
} from "../../supabase/functions/_shared/auth-header";

describe("extractBearerToken", () => {
  it("extracts tokens from standard bearer headers", () => {
    expect(extractBearerToken("Bearer token-123")).toBe("token-123");
  });

  it("extracts tokens from lowercase bearer headers", () => {
    expect(extractBearerToken("bearer token-456")).toBe("token-456");
  });

  it("returns null for invalid auth headers", () => {
    expect(extractBearerToken("token-789")).toBeNull();
    expect(extractBearerToken(null)).toBeNull();
  });
});

describe("decodeJwtPayload", () => {
  it("returns the decoded payload for a jwt-like string", () => {
    const payload = {
      sub: "user_123",
      role: "authenticated",
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const token = `header.${encodedPayload}.signature`;

    expect(decodeJwtPayload(token)).toEqual(payload);
  });

  it("returns null for malformed tokens", () => {
    expect(decodeJwtPayload("not-a-jwt")).toBeNull();
  });
});
