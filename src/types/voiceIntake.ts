export type VoiceEntityType = "lead" | "job" | "estimate";

export interface VoiceFollowUpQuestion {
  field: string;
  label: string;
  question: string;
}

export interface VoiceLeadParsedData {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerCity?: string;
  serviceType?: string;
  estimatedBudget?: number;
  source?: string;
  notes?: string;
}

export interface VoiceJobParsedData {
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  jobName?: string;
  serviceType?: string;
  jobAddress?: string;
  description?: string;
}

export interface VoiceEstimateLineItemParsedData {
  name?: string;
  description?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
}

export interface VoiceEstimateParsedData {
  jobName?: string;
  notes?: string;
  expiresAt?: string;
  taxRate?: number;
  discount?: number;
  lineItems?: VoiceEstimateLineItemParsedData[];
}

export interface VoiceIntakeParserResponse {
  entityType: VoiceEntityType;
  parsed: VoiceLeadParsedData | VoiceJobParsedData | VoiceEstimateParsedData;
  missingFields: string[];
  followUpQuestions: VoiceFollowUpQuestion[];
}
