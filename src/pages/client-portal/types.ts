export interface JobData {
  name: string;
  address?: string;
  service_type?: string;
  status: string;
  description?: string;
  created_at: string;
  customer: { name: string; email?: string; phone?: string } | null;
}

export interface JobListItem {
  id: string;
  name: string;
  address?: string;
  service_type?: string;
  status: string;
  created_at: string;
  schedule_start_date?: string;
  schedule_end_date?: string;
}

export interface RecurringJobListItem {
  id: string;
  name: string;
  address?: string;
  service_type?: string;
  frequency: string;
  start_date: string;
  end_date?: string;
  created_at: string;
}

export interface InvoiceListItem {
  id: string;
  lead_id: string;
  job_name: string;
  service_type?: string;
  stripe_invoice_url: string;
  status: string;
  total: number;
  created_at: string;
}

export interface RequiredDocumentListItem {
  id: string;
  job_id: string;
  job_name: string;
  title: string;
}

export interface CustomerData {
  name: string;
  email?: string;
  phone?: string;
}

export interface CompanyData {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  website?:
    | string
    | {
        custom_domain?: string | null;
        slug?: string | null;
        font?: string | null;
        body_font?: string | null;
      }
    | null;
  logo_url?: string;
  portal_color?: string | null;
  portal_text_color?: string | null;
  client_portal_color?: string | null;
  client_portal_text_color?: string | null;
  settings?: {
    client_portal_color?: string | null;
    client_portal_text_color?: string | null;
    website?: {
      font?: string | null;
      body_font?: string | null;
    } | null;
  } | null;
}

export interface ScheduleItem {
  scheduled_date: string;
  scheduled_time_start?: string;
  scheduled_time_end?: string;
  is_completed: boolean;
}

export interface LineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
  is_change_order?: boolean;
  change_order_type?: 'added' | 'edited' | 'deleted';
  change_order_approved?: boolean | null;
  changed_at?: string;
}

export interface EstimateData {
  id?: string;
  job_id?: string | null;
  total: number;
  subtotal: number;
  profit_margin?: number;
  tax_rate: number;
  tax: number;
  discount: number;
  notes?: string;
  status: string;
  updated_at: string;
  line_items: LineItem[];
  original_total?: number | null;
  original_subtotal?: number | null;
  original_tax?: number | null;
  original_discount?: number | null;
  original_notes?: string | null;
  original_line_items?: LineItem[] | null;
  has_pending_changes?: boolean;
  estimate_versions?: Array<{
    id: string;
    name: string;
    subtotal: number;
    tax_rate: number;
    tax: number;
    discount: number;
    total: number;
    profit_margin?: number;
    notes?: string | null;
    line_items: LineItem[];
  }>;
  proposal_settings?: {
    sections?: Record<string, boolean>;
    title?: string | null;
    team_member_ids?: string[];
    highlight_line_item_ids?: string[];
  } | null;
  project_visualization_image_url?: string | null;
  agreement_acceptance?: Record<string, unknown> | null;
  job_document_config_lead_id?: string | null;
  job_document_configs?: Array<{
    id: string;
    lead_id: string;
    template_id: string;
    include_in_job: boolean;
    email_timing: string;
    requires_signature: boolean;
    sort_order: number;
    shared_at?: string | null;
    template: {
      id: string;
      name: string;
      system_key: string | null;
      body: string | null;
    } | null;
  }>;
  job_documents?: Array<{
    id: string;
    lead_id: string;
    template_id: string | null;
    config_id: string | null;
    document_key: string;
    file_name: string;
    file_path: string;
    mime_type: string | null;
    created_at: string;
    url: string;
  }>;
  document_template_merge_fields?: Record<string, unknown> | null;
}

export interface PhotoItem {
  id: string;
  url: string;
  created_at: string;
}

export interface ActivityItem {
  type: string;
  summary?: string;
  created_at: string;
}

export interface InvoiceData {
  stripe_invoice_url: string | null;
  status: string;
}

export interface PortalMetadata {
  customer: CustomerData;
  has_portal: boolean;
}

export interface PortalData {
  job: JobData;
  company: CompanyData;
  schedules: ScheduleItem[];
  estimate_visit_schedules: ScheduleItem[];
  estimate: EstimateData | null;
  invoice: InvoiceData | null;
  job_release?: {
    id: string;
    status: string;
    release_text: string;
    signed_at?: string | null;
    signature_image_url?: string | null;
    requested_at?: string | null;
  } | null;
  is_fully_paid?: boolean;
  photos: { before: PhotoItem[]; after: PhotoItem[] };
  activity: ActivityItem[];
  portal_metadata?: PortalMetadata;
}

export interface ClientPortalData {
  customer: CustomerData;
  company: CompanyData;
  jobs: JobListItem[];
  recurring_jobs: RecurringJobListItem[];
  invoices: InvoiceListItem[];
  required_documents?: RequiredDocumentListItem[];
}
