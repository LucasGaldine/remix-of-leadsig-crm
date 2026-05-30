import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { getBrandFontOption } from "@/lib/brandFonts";

import type { ClientPortalController, PageState, ViewMode } from "./internalTypes";
import type { ClientPortalData, PortalData } from "./types";
import { isPastProjectStatus } from "./utils";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function resolveWebsiteThemeConfig(company: ClientPortalData["company"] | PortalData["company"] | undefined): {
  font?: string | null;
  body_font?: string | null;
} {
  const settings = asRecord(company?.settings);
  const settingsWebsite = asRecord(settings?.website);
  const companyWebsite = asRecord(company?.website);

  return {
    font:
      (typeof settingsWebsite?.font === "string" ? settingsWebsite.font : null) ??
      (typeof companyWebsite?.font === "string" ? companyWebsite.font : null),
    body_font:
      (typeof settingsWebsite?.body_font === "string" ? settingsWebsite.body_font : null) ??
      (typeof companyWebsite?.body_font === "string" ? companyWebsite.body_font : null),
  };
}

function isListResponse(result: unknown): result is ClientPortalData {
  return Boolean(
    result &&
      typeof result === "object" &&
      "jobs" in (result as Record<string, unknown>) &&
      (result as Record<string, unknown>).jobs !== undefined,
  );
}

export function useClientPortalController(): ClientPortalController {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get("token");
  const jobId = searchParams.get("jobId");

  const [pageState, setPageState] = useState<PageState>("loading");
  const [viewMode, setViewMode] = useState<ViewMode>("job-detail");
  const [data, setData] = useState<PortalData | null>(null);
  const [customerData, setCustomerData] = useState<ClientPortalData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reviewCardDismissed, setReviewCardDismissed] = useState(false);

  const apiConfig = useMemo(
    () => ({
      apiUrl: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/job-client-portal`,
      apiHeaders: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
    }),
    [],
  );

  const fetchData = useCallback(async () => {
    if (!token) {
      setErrorMessage("No share token provided. Please check the link you were sent.");
      setPageState("error");
      return;
    }

    setPageState("loading");

    try {
      const url = jobId
        ? `${apiConfig.apiUrl}?token=${token}&jobId=${jobId}`
        : `${apiConfig.apiUrl}?token=${token}`;

      const response = await fetch(url, {
        cache: "no-store",
        headers: apiConfig.apiHeaders,
      });

      if (!response.ok) {
        const result = await response.json();
        setErrorMessage(result.error || "Could not load data.");
        setPageState("error");
        return;
      }

      const result = await response.json();

      if (isListResponse(result)) {
        setCustomerData(result);
        setData(null);
        setViewMode("job-list");
      } else {
        setData(result as PortalData);
        setViewMode("job-detail");
      }

      setPageState("loaded");
    } catch {
      setErrorMessage("Unable to connect. Please try again later.");
      setPageState("error");
    }
  }, [apiConfig.apiHeaders, apiConfig.apiUrl, jobId, token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSelectJob = useCallback(
    (selectedJobId: string) => {
      if (!token) return;
      setReviewCardDismissed(false);
      setSearchParams({ token, jobId: selectedJobId });
    },
    [setSearchParams, token],
  );

  const handleBackToList = useCallback(() => {
    if (!token) return;
    setReviewCardDismissed(false);
    setSearchParams({ token });
  }, [setSearchParams, token]);

  const dismissReviewCard = useCallback(() => {
    setReviewCardDismissed(true);
  }, []);

  const customerName =
    customerData?.customer?.name?.trim() ||
    data?.job?.customer?.name?.trim() ||
    data?.portal_metadata?.customer?.name?.trim() ||
    "";
  const portalTabTitle = customerName ? `${customerName} | Client Portal` : "Client Portal";
  const activeCompany = customerData?.company ?? data?.company;
  const websiteThemeConfig = resolveWebsiteThemeConfig(activeCompany);

  const customerJobs = Array.isArray(customerData?.jobs) ? customerData.jobs : [];
  const customerRecurringJobs = Array.isArray(customerData?.recurring_jobs)
    ? customerData.recurring_jobs
    : [];
  const customerInvoices = Array.isArray(customerData?.invoices) ? customerData.invoices : [];
  const requiredDocuments = Array.isArray(customerData?.required_documents)
    ? customerData.required_documents
    : [];

  const headingFontOption = getBrandFontOption(websiteThemeConfig.font);
  const bodyFontOption = getBrandFontOption(websiteThemeConfig.body_font);

  const currentProjects = customerJobs.filter((job) => !isPastProjectStatus(job.status));
  const pastProjects = customerJobs.filter((job) => isPastProjectStatus(job.status));

  return {
    token,
    jobId,
    pageState,
    viewMode,
    data,
    customerData,
    errorMessage,
    reviewCardDismissed,
    customerName,
    portalTabTitle,
    customerJobs,
    customerRecurringJobs,
    customerInvoices,
    requiredDocuments,
    currentProjects,
    pastProjects,
    headingFontOption,
    bodyFontOption,
    activeCompany,
    apiConfig,
    fetchData,
    handleSelectJob,
    handleBackToList,
    dismissReviewCard,
  };
}
