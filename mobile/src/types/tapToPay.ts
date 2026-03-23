export type TapToPayRoute = "tap-to-pay";

export interface TapToPaySessionParams {
  invoiceId?: string;
  paymentIntentId?: string;
  sessionId?: string;
  customerId?: string;
  amount?: number;
}

export interface ParsedTapToPayLink {
  route: TapToPayRoute;
  rawUrl: string;
  invoiceId?: string;
  paymentIntentId?: string;
  sessionId?: string;
  customerId?: string;
  amount?: number;
}

function normalizeRoute(url: URL): string {
  const hostRoute = url.host.trim();
  if (hostRoute.length > 0) {
    return hostRoute;
  }

  return url.pathname.replace(/^\/+/, "");
}

function parseOptionalNumber(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseTapToPayLink(url: string): ParsedTapToPayLink | null {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== "leadsig:") {
    return null;
  }

  if (normalizeRoute(parsedUrl) !== "tap-to-pay") {
    return null;
  }

  return {
    route: "tap-to-pay",
    rawUrl: url,
    invoiceId: parsedUrl.searchParams.get("invoiceId") ?? undefined,
    paymentIntentId: parsedUrl.searchParams.get("paymentIntentId") ?? undefined,
    sessionId: parsedUrl.searchParams.get("sessionId") ?? undefined,
    customerId: parsedUrl.searchParams.get("customerId") ?? undefined,
    amount: parseOptionalNumber(parsedUrl.searchParams.get("amount")),
  };
}

export interface TapToPayHomeViewModel {
  handoff: ParsedTapToPayLink | null;
  deviceReady: boolean;
}
