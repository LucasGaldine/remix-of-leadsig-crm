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

export function parseMentionsForDisplay(text: string): Array<{ type: 'text' | 'mention'; content: string; userId?: string }> {
  const parts: Array<{ type: 'text' | 'mention'; content: string; userId?: string }> = [];
  const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
    }
    parts.push({ type: 'mention', content: match[1], userId: match[2] });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', content: text.substring(lastIndex) });
  }

  return parts;
}
