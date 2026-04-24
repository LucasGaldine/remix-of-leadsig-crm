export type GoogleEmailProvider = "google";

export type GoogleEmailConnectionState = {
  isConnected: boolean;
  connectedEmail: string | null;
  provider: GoogleEmailProvider | null;
};

export function normalizeGoogleEmailConnectionRow(row: Record<string, unknown> | null): GoogleEmailConnectionState {
  if (!row) {
    return { isConnected: false, connectedEmail: null, provider: null };
  }

  const provider = row.provider === "google" ? "google" : null;
  const connectedEmail = typeof row.connected_email === "string" && row.connected_email.trim()
    ? row.connected_email.trim()
    : null;
  const refreshToken = typeof row.refresh_token === "string" && row.refresh_token.trim()
    ? row.refresh_token.trim()
    : null;

  if (!provider || !connectedEmail || !refreshToken) {
    return { isConnected: false, connectedEmail: null, provider: null };
  }

  return { isConnected: true, connectedEmail, provider };
}
