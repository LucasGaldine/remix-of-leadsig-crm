export type HighlightSegment = {
  highlighted: boolean;
  brandColored: boolean;
  text: string;
};

const TEXT_STYLE_PATTERN = /(\*\*(.+?)\*\*|\{\{(.+?)\}\})/g;

export function parseHighlightSegments(input: string): HighlightSegment[] {
  if (!input) return [{ highlighted: false, brandColored: false, text: "" }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  input.replace(TEXT_STYLE_PATTERN, (match, _full: string, highlightContent: string, brandContent: string, offset: number) => {
    if (offset > cursor) {
      segments.push({
        highlighted: false,
        brandColored: false,
        text: input.slice(cursor, offset),
      });
    }

    if (highlightContent !== undefined) {
      segments.push({
        highlighted: true,
        brandColored: false,
        text: highlightContent,
      });
    } else {
      segments.push({
        highlighted: false,
        brandColored: true,
        text: brandContent,
      });
    }

    cursor = offset + match.length;
    return match;
  });

  if (cursor < input.length) {
    segments.push({
      highlighted: false,
      brandColored: false,
      text: input.slice(cursor),
    });
  }

  return segments.length > 0 ? segments : [{ highlighted: false, brandColored: false, text: input }];
}
