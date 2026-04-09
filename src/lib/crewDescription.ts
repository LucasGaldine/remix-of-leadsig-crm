export const CREW_DESCRIPTION_MAX_LENGTH = 160;

export function normalizeCrewDescription(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.slice(0, CREW_DESCRIPTION_MAX_LENGTH);
}
