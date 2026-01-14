// Payment System Types

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
  transactionRef?: string;
  createdAt: string;
  receiptUrl?: string;
}
