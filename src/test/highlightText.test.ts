import { describe, expect, it } from "vitest";

import { parseHighlightSegments } from "@/lib/highlightText";

describe("parseHighlightSegments", () => {
  it("splits plain text and highlighted text segments", () => {
    expect(parseHighlightSegments("Hello **LeadSig** team")).toEqual([
      { highlighted: false, brandColored: false, text: "Hello " },
      { highlighted: true, brandColored: false, text: "LeadSig" },
      { highlighted: false, brandColored: false, text: " team" },
    ]);
  });

  it("splits plain text and brand-colored segments", () => {
    expect(parseHighlightSegments("Hello {{LeadSig}} team")).toEqual([
      { highlighted: false, brandColored: false, text: "Hello " },
      { highlighted: false, brandColored: true, text: "LeadSig" },
      { highlighted: false, brandColored: false, text: " team" },
    ]);
  });

  it("returns plain text when markers are incomplete", () => {
    expect(parseHighlightSegments("Hello **LeadSig team")).toEqual([
      { highlighted: false, brandColored: false, text: "Hello **LeadSig team" },
    ]);
  });

  it("supports mixed marker styles in one string", () => {
    expect(parseHighlightSegments("**Hi** {{there}}")).toEqual([
      { highlighted: true, brandColored: false, text: "Hi" },
      { highlighted: false, brandColored: false, text: " " },
      { highlighted: false, brandColored: true, text: "there" },
    ]);
  });
});
