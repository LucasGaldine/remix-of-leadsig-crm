import { describe, expect, it } from "vitest";

import {
  extractMentions,
  parseMentionsForDisplay,
  parseMentionsToHTML,
  renderMentionsAsText,
} from "@/lib/mentionParser";

describe("mentionParser", () => {
  const mockMentionText = "@[Kevin Mock](mock:64d771ff-950e-47d9-a5c5-ddab4b2ecbdf)";

  it("parses mention ids that include non-UUID prefixes", () => {
    expect(extractMentions(mockMentionText)).toEqual([
      {
        fullName: "Kevin Mock",
        userId: "mock:64d771ff-950e-47d9-a5c5-ddab4b2ecbdf",
        startIndex: 0,
        endIndex: mockMentionText.length,
      },
    ]);

    expect(parseMentionsForDisplay(mockMentionText)).toEqual([
      {
        type: "mention",
        content: "Kevin Mock",
        userId: "mock:64d771ff-950e-47d9-a5c5-ddab4b2ecbdf",
      },
    ]);

    expect(renderMentionsAsText(mockMentionText)).toBe("@Kevin Mock");
    expect(parseMentionsToHTML(mockMentionText)).toBe(
      '<span class="font-semibold text-primary">@Kevin Mock</span>',
    );
  });
});
