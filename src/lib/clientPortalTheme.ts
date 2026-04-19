export const DEFAULT_CLIENT_PORTAL_COLOR = "#334155";
export const DEFAULT_CLIENT_PORTAL_TEXT_COLOR = "#ffffff";

function normalizeHexColor(value: string | null | undefined, fallbackColor: string): string {
  if (!value) return fallbackColor;
  const normalized = value.trim().toLowerCase();

  if (/^#[\da-f]{6}$/.test(normalized)) {
    return normalized;
  }

  const shortHexMatch = normalized.match(/^#([\da-f]{3})$/);
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return fallbackColor;
}

export function normalizeClientPortalColor(value: string | null | undefined): string {
  return normalizeHexColor(value, DEFAULT_CLIENT_PORTAL_COLOR);
}

export function normalizeClientPortalTextColor(value: string | null | undefined): string {
  return normalizeHexColor(value, DEFAULT_CLIENT_PORTAL_TEXT_COLOR);
}

export function hexToRgba(hexColor: string, alpha = 1): string {
  const normalized = normalizeClientPortalTextColor(hexColor);
  const clampedAlpha = Math.min(Math.max(alpha, 0), 1);
  const hex = normalized.replace("#", "");

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${clampedAlpha})`;
}

export function darkenHexColor(hexColor: string, amount = 0.12): string {
  const normalized = normalizeClientPortalColor(hexColor);
  const clampedAmount = Math.min(Math.max(amount, 0), 1);
  const hex = normalized.replace("#", "");

  const r = Number.parseInt(hex.slice(0, 2), 16);
  const g = Number.parseInt(hex.slice(2, 4), 16);
  const b = Number.parseInt(hex.slice(4, 6), 16);

  const nextR = Math.round(r * (1 - clampedAmount));
  const nextG = Math.round(g * (1 - clampedAmount));
  const nextB = Math.round(b * (1 - clampedAmount));

  const toHex = (value: number) => value.toString(16).padStart(2, "0");
  return `#${toHex(nextR)}${toHex(nextG)}${toHex(nextB)}`;
}
