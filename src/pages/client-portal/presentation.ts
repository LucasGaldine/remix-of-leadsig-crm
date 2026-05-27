import type { CSSProperties } from "react";

import {
  darkenHexColor,
  hexToRgba,
  normalizeClientPortalColor,
  normalizeClientPortalTextColor,
} from "@/lib/clientPortalTheme";

import type { CompanyData } from "./types";
import { resolveCompanyWebsite } from "./utils";

export interface ClientPortalPalette {
  portalColor: string;
  portalColorDark: string;
  portalTextColor: string;
}

export interface CompanyContactDisplay {
  website: string | null;
  hasContactInfo: boolean;
}

export function resolveClientPortalPalette(company: CompanyData): ClientPortalPalette {
  const portalColor = normalizeClientPortalColor(
    company.portal_color ?? company.client_portal_color ?? company.settings?.client_portal_color,
  );
  const portalTextColor = normalizeClientPortalTextColor(
    company.portal_text_color ?? company.client_portal_text_color ?? company.settings?.client_portal_text_color,
  );

  return {
    portalColor,
    portalColorDark: darkenHexColor(portalColor, 0.16),
    portalTextColor,
  };
}

export function buildClientPortalThemeStyle(input: {
  palette: ClientPortalPalette;
  headingFontCss?: string;
  bodyFontCss?: string;
}): CSSProperties {
  const { palette, headingFontCss, bodyFontCss } = input;

  return {
    "--client-portal-color": palette.portalColor,
    "--client-portal-color-dark": palette.portalColorDark,
    "--client-portal-text-color": palette.portalTextColor,
    "--client-portal-text-muted": hexToRgba(palette.portalTextColor, 0.72),
    "--client-portal-text-subtle": hexToRgba(palette.portalTextColor, 0.56),
    "--client-portal-heading-font": headingFontCss,
    "--client-portal-body-font": bodyFontCss,
  } as CSSProperties;
}

export function resolveCompanyContactDisplay(company: CompanyData): CompanyContactDisplay {
  const website = resolveCompanyWebsite(company);

  return {
    website,
    hasContactInfo: Boolean(
      company.company_phone || company.company_email || company.company_address || website,
    ),
  };
}

export function getPortalTextColorWithOpacity(color: string, opacity: number): string {
  return hexToRgba(color, opacity);
}
