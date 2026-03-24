import { describe, expect, it } from "vitest";

import {
  COMPANY_LOGO_MAX_FILE_SIZE,
  getCompanyLogoStoragePath,
  getCompanyLogoValidationError,
} from "@/lib/companyLogo";

describe("company logo validation", () => {
  it("rejects files larger than 2 MB", () => {
    const file = new File(["a"], "logo.png", { type: "image/png" });
    Object.defineProperty(file, "size", { value: COMPANY_LOGO_MAX_FILE_SIZE + 1 });

    expect(getCompanyLogoValidationError(file, { width: 1200, height: 400 })).toBe(
      "Logo image must be 2MB or smaller",
    );
  });

  it("rejects unsupported aspect ratios", () => {
    const file = new File(["a"], "logo.png", { type: "image/png" });

    expect(getCompanyLogoValidationError(file, { width: 500, height: 900 })).toBe(
      "Logo must be between 1:1 and 4:1",
    );
    expect(getCompanyLogoValidationError(file, { width: 2000, height: 300 })).toBe(
      "Logo must be between 1:1 and 4:1",
    );
  });

  it("accepts supported logo files", () => {
    const file = new File(["a"], "logo.png", { type: "image/png" });

    expect(getCompanyLogoValidationError(file, { width: 1200, height: 400 })).toBeNull();
  });

  it("uses the allowed avatars folder for company logo uploads", () => {
    expect(getCompanyLogoStoragePath("acct_1", 1234567890, "png")).toBe(
      "avatars/acct_1-company-logo-1234567890.png",
    );
  });
});
