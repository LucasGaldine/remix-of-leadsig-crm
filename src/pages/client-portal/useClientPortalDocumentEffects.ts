import { useEffect } from "react";

import { loadGoogleBrandFont } from "@/lib/brandFonts";

import type { BrandFontOption } from "@/lib/brandFonts";
import type { CompanyData } from "./types";

const DEFAULT_FAVICON = "/logo.png";

function setDocumentFavicon(href: string) {
  const iconLink = document.querySelector("link[rel='icon']") ?? document.createElement("link");
  iconLink.setAttribute("rel", "icon");
  iconLink.setAttribute("href", href);
  if (!iconLink.parentNode) {
    document.head.appendChild(iconLink);
  }

  const appleTouchIconLink =
    document.querySelector("link[rel='apple-touch-icon']") ?? document.createElement("link");
  appleTouchIconLink.setAttribute("rel", "apple-touch-icon");
  appleTouchIconLink.setAttribute("href", href);
  if (!appleTouchIconLink.parentNode) {
    document.head.appendChild(appleTouchIconLink);
  }
}

export function useClientPortalDocumentEffects(input: {
  activeCompany?: CompanyData;
  portalTabTitle: string;
  headingFontOption?: BrandFontOption;
  bodyFontOption?: BrandFontOption;
}) {
  const { activeCompany, portalTabTitle, headingFontOption, bodyFontOption } = input;

  useEffect(() => {
    const logoUrl = activeCompany?.logo_url ?? DEFAULT_FAVICON;
    setDocumentFavicon(logoUrl || DEFAULT_FAVICON);

    return () => {
      setDocumentFavicon(DEFAULT_FAVICON);
    };
  }, [activeCompany?.logo_url]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = portalTabTitle;

    return () => {
      document.title = previousTitle;
    };
  }, [portalTabTitle]);

  useEffect(() => {
    loadGoogleBrandFont(headingFontOption);
  }, [headingFontOption]);

  useEffect(() => {
    loadGoogleBrandFont(bodyFontOption);
  }, [bodyFontOption]);
}
