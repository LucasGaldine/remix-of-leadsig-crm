import type { BrandFontOption } from "@/lib/brandFonts";

import type {
  ClientPortalData,
  InvoiceListItem,
  JobListItem,
  RequiredDocumentListItem,
  PortalData,
  RecurringJobListItem,
} from "./types";

export type PageState = "loading" | "loaded" | "error";
export type ViewMode = "job-list" | "job-detail";

export interface PortalApiConfig {
  apiUrl: string;
  apiHeaders: Record<string, string>;
}

export interface ClientPortalController {
  token: string | null;
  jobId: string | null;
  pageState: PageState;
  viewMode: ViewMode;
  data: PortalData | null;
  customerData: ClientPortalData | null;
  errorMessage: string;
  reviewCardDismissed: boolean;
  customerName: string;
  portalTabTitle: string;
  customerJobs: JobListItem[];
  customerRecurringJobs: RecurringJobListItem[];
  customerInvoices: InvoiceListItem[];
  requiredDocuments: RequiredDocumentListItem[];
  currentProjects: JobListItem[];
  pastProjects: JobListItem[];
  headingFontOption: BrandFontOption | undefined;
  bodyFontOption: BrandFontOption | undefined;
  activeCompany: ClientPortalData["company"] | PortalData["company"] | undefined;
  apiConfig: PortalApiConfig;
  fetchData: () => Promise<void>;
  handleSelectJob: (selectedJobId: string) => void;
  handleBackToList: () => void;
  dismissReviewCard: () => void;
}

export interface ClientPortalListViewProps {
  customerData: ClientPortalData;
  customerJobs: JobListItem[];
  customerRecurringJobs: RecurringJobListItem[];
  customerInvoices: InvoiceListItem[];
  requiredDocuments: RequiredDocumentListItem[];
  currentProjects: JobListItem[];
  pastProjects: JobListItem[];
  headingFontOption: BrandFontOption | undefined;
  bodyFontOption: BrandFontOption | undefined;
  onSelectJob: (selectedJobId: string) => void;
}

export interface ClientPortalDetailViewProps {
  data: PortalData;
  customerData: ClientPortalData | null;
  token: string;
  jobId: string | null;
  apiConfig: PortalApiConfig;
  headingFontOption: BrandFontOption | undefined;
  bodyFontOption: BrandFontOption | undefined;
  reviewCardDismissed: boolean;
  onDismissReviewCard: () => void;
  onBackToList: () => void;
  onRefresh: () => Promise<void>;
}
