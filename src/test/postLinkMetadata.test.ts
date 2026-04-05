import { describe, expect, it } from "vitest";

import {
  normalizeInteractionMetadataWithPostLink,
  resolvePostLinkLabel,
} from "../../supabase/functions/_shared/post-links";

describe("normalizeInteractionMetadataWithPostLink", () => {
  it("captures post url and normalized platform from top-level automation fields", () => {
    const metadata = normalizeInteractionMetadataWithPostLink({
      postUrl: " https://www.linkedin.com/posts/abc123 ",
      platform: "linkedin",
    }, undefined, "Message body", "Posted update");

    expect(metadata).toEqual({
      post_url: "https://www.linkedin.com/posts/abc123",
      platform: "LinkedIn",
    });
  });

  it("falls back to urls found in body text when explicit fields are missing", () => {
    const metadata = normalizeInteractionMetadataWithPostLink(
      {},
      {},
      "Check the live post: https://facebook.com/example/posts/1",
      null,
    );

    expect(metadata).toEqual({
      post_url: "https://facebook.com/example/posts/1",
      platform: "Facebook",
    });
  });
});

describe("resolvePostLinkLabel", () => {
  it("returns platform-specific call-to-action text", () => {
    expect(resolvePostLinkLabel({ platform: "LinkedIn" })).toBe("View on LinkedIn");
  });

  it("falls back to generic text when platform is unavailable", () => {
    expect(resolvePostLinkLabel({})).toBe("View Post");
  });
});
