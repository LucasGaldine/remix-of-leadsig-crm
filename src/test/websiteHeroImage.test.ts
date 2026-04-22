import { describe, expect, it } from "vitest";

import {
  getWebsiteAboutImageStoragePath,
  getWebsiteHeroImageStoragePath,
  getWebsiteServiceImageStoragePath,
  getWebsiteHeroImageValidationError,
  WEBSITE_HERO_IMAGE_MAX_FILE_SIZE,
} from "@/lib/websiteHeroImage";

describe("websiteHeroImage", () => {
  it("rejects non-image files", () => {
    const file = new File(["abc"], "notes.txt", { type: "text/plain" });
    expect(getWebsiteHeroImageValidationError(file)).toBe("Please upload an image file");
  });

  it("rejects oversized images", () => {
    const large = new File([new Uint8Array(WEBSITE_HERO_IMAGE_MAX_FILE_SIZE + 1)], "hero.jpg", {
      type: "image/jpeg",
    });
    expect(getWebsiteHeroImageValidationError(large)).toBe("Hero image must be 5MB or smaller");
  });

  it("accepts valid images", () => {
    const file = new File(["abc"], "hero.png", { type: "image/png" });
    expect(getWebsiteHeroImageValidationError(file)).toBeNull();
  });

  it("builds hero image storage path", () => {
    expect(getWebsiteHeroImageStoragePath("acct_123", 1700000000000, "png")).toBe(
      "website/acct_123/hero-1700000000000.png",
    );
  });

  it("builds service image storage path", () => {
    expect(getWebsiteServiceImageStoragePath("acct_123", "Window Cleaning", 1700000000000, "webp")).toBe(
      "website/acct_123/services/window-cleaning-1700000000000.webp",
    );
  });

  it("builds about before/after image storage path", () => {
    expect(getWebsiteAboutImageStoragePath("acct_123", "before", 1700000000000, "png")).toBe(
      "website/acct_123/about/before-1700000000000.png",
    );
    expect(getWebsiteAboutImageStoragePath("acct_123", "after", 1700000000000, "png")).toBe(
      "website/acct_123/about/after-1700000000000.png",
    );
  });
});
