export interface ParsedMention {
  userId: string;
  fullName: string;
  startIndex: number;
  endIndex: number;
}

export function extractMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      fullName: match[1],
      userId: match[2],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
    });
  }

  return mentions;
}

export function renderMentionsAsText(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([a-f0-9-]+\)/g, '@$1');
}

export function highlightMentions(text: string): string {
  return text.replace(
    /@\[([^\]]+)\]\([a-f0-9-]+\)/g,
    '<span class="mention">@$1</span>'
  );
}
