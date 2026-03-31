// Payment System Types

export const tapToPayPaymentMethods = ["tap-to-pay"] as const;
export const tapToPayStatuses = [
  "terminal_pending",
  "terminal_processing",
  "completed",
  "failed",
  "canceled",
] as const;
export const stripeTerminalPaymentIntentStatuses = [
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "processing",
  "requires_capture",
  "canceled",
  "succeeded",
] as const;

export interface LineItem {
  id: string;
  name: string;
  description?: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export type EstimateStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'expired';
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue';
export type PaymentMethod = 'card' | 'cash' | 'check' | 'ach' | 'tap-to-pay';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentChannel = 'online' | 'terminal';
export type TapToPayTerminalStatus = typeof tapToPayStatuses[number];
export type StripeTerminalPaymentIntentStatus = typeof stripeTerminalPaymentIntentStatuses[number];
export type TerminalStatusValue = TapToPayTerminalStatus | StripeTerminalPaymentIntentStatus;

export interface Estimate {
  id: string;
  customerId: string;
  customerName: string;
  jobId?: string;
  jobName?: string;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  notes?: string;
  status: EstimateStatus;
  createdAt: string;
  sentAt?: string;
  viewedAt?: string;
  acceptedAt?: string;
  expiresAt?: string;
}

export interface Invoice {
  id: string;
  estimateId?: string;
  customerId: string;
  customerName: string;
  jobId?: string;
  jobName?: string;
  lineItems: LineItem[];
  subtotal: number;
  taxRate: number;
  tax: number;
  discount: number;
  total: number;
  balanceDue: number;
  notes?: string;
  status: InvoiceStatus;
  dueDate: string;
  createdAt: string;
  sentAt?: string;
  paidAt?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId: string;
  customerName: string;
  jobId?: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paymentChannel?: PaymentChannel;
  terminalStatus?: TerminalStatusValue;
  stripeTerminalReaderId?: string;
  stripeTerminalLocationId?: string;
  stripeTerminalPaymentIntentId?: string;
  transactionRef?: string;
  createdAt: string;
  receiptUrl?: string;
}
