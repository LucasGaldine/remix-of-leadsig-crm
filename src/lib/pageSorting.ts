export type LeadSortOption = "newest" | "oldest" | "name_asc" | "name_desc" | "value_desc" | "value_asc";
export type JobSortOption = "newest" | "oldest" | "scheduled_soonest" | "scheduled_latest" | "name_asc" | "name_desc";
export type EstimateSortOption = "newest" | "oldest" | "total_desc" | "total_asc" | "customer_asc" | "customer_desc";
export type InvoiceSortOption = "newest" | "oldest" | "amount_desc" | "amount_asc" | "customer_asc" | "customer_desc";
export type PaymentSortOption = "newest" | "oldest" | "amount_desc" | "amount_asc" | "customer_asc" | "customer_desc";
export type CustomerSortOption = "newest" | "oldest" | "name_asc" | "name_desc";

type LeadSortItem = {
  name?: string | null;
  estimatedBudget?: number | null;
  createdAtRaw?: string | null;
};

type JobSortItem = {
  name?: string | null;
  created_at?: string | null;
  scheduled_date?: string | null;
  last_scheduled_date?: string | null;
};

type EstimateSortItem = {
  created_at?: string | null;
  total?: number | string | null;
  customer?: { name?: string | null } | null;
};

type InvoiceSortItem = {
  created_at?: string | null;
  total?: number | string | null;
  customer?: { name?: string | null } | null;
};

type PaymentSortItem = {
  created_at?: string | null;
  amount?: number | string | null;
  customer?: { name?: string | null } | null;
};

type CustomerSortItem = {
  created_at?: string | null;
  name?: string | null;
};

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

function toTimestamp(value?: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compareText(a?: string | null, b?: string | null): number {
  return collator.compare((a || "").trim(), (b || "").trim());
}

function toNumber(value?: number | string | null): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function sortLeadItems<T extends LeadSortItem>(items: T[], sortBy: LeadSortOption): T[] {
  const next = [...items];
  next.sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return toTimestamp(a.createdAtRaw) - toTimestamp(b.createdAtRaw);
      case "name_asc":
        return compareText(a.name, b.name);
      case "name_desc":
        return compareText(b.name, a.name);
      case "value_desc":
        return toNumber(b.estimatedBudget) - toNumber(a.estimatedBudget);
      case "value_asc":
        return toNumber(a.estimatedBudget) - toNumber(b.estimatedBudget);
      case "newest":
      default:
        return toTimestamp(b.createdAtRaw) - toTimestamp(a.createdAtRaw);
    }
  });
  return next;
}

export function sortJobItems<T extends JobSortItem>(items: T[], sortBy: JobSortOption): T[] {
  const next = [...items];
  next.sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return toTimestamp(a.created_at) - toTimestamp(b.created_at);
      case "name_asc":
        return compareText(a.name, b.name);
      case "name_desc":
        return compareText(b.name, a.name);
      case "scheduled_soonest": {
        const aDate = toTimestamp(a.scheduled_date);
        const bDate = toTimestamp(b.scheduled_date);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return aDate - bDate;
      }
      case "scheduled_latest": {
        const aDate = toTimestamp(a.last_scheduled_date || a.scheduled_date);
        const bDate = toTimestamp(b.last_scheduled_date || b.scheduled_date);
        if (!aDate && !bDate) return 0;
        if (!aDate) return 1;
        if (!bDate) return -1;
        return bDate - aDate;
      }
      case "newest":
      default:
        return toTimestamp(b.created_at) - toTimestamp(a.created_at);
    }
  });
  return next;
}

export function sortEstimateItems<T extends EstimateSortItem>(items: T[], sortBy: EstimateSortOption): T[] {
  const next = [...items];
  next.sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return toTimestamp(a.created_at) - toTimestamp(b.created_at);
      case "total_desc":
        return toNumber(b.total) - toNumber(a.total);
      case "total_asc":
        return toNumber(a.total) - toNumber(b.total);
      case "customer_asc":
      case "customer_desc": {
        const aName = (a.customer?.name || "").trim();
        const bName = (b.customer?.name || "").trim();
        if (!aName && !bName) return 0;
        if (!aName) return 1;
        if (!bName) return -1;
        return sortBy === "customer_asc" ? compareText(aName, bName) : compareText(bName, aName);
      }
      case "newest":
      default:
        return toTimestamp(b.created_at) - toTimestamp(a.created_at);
    }
  });
  return next;
}

export function sortInvoiceItems<T extends InvoiceSortItem>(items: T[], sortBy: InvoiceSortOption): T[] {
  const next = [...items];
  next.sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return toTimestamp(a.created_at) - toTimestamp(b.created_at);
      case "amount_desc":
        return toNumber(b.total) - toNumber(a.total);
      case "amount_asc":
        return toNumber(a.total) - toNumber(b.total);
      case "customer_asc":
      case "customer_desc": {
        const aName = (a.customer?.name || "").trim();
        const bName = (b.customer?.name || "").trim();
        if (!aName && !bName) return 0;
        if (!aName) return 1;
        if (!bName) return -1;
        return sortBy === "customer_asc" ? compareText(aName, bName) : compareText(bName, aName);
      }
      case "newest":
      default:
        return toTimestamp(b.created_at) - toTimestamp(a.created_at);
    }
  });
  return next;
}

export function sortPaymentItems<T extends PaymentSortItem>(items: T[], sortBy: PaymentSortOption): T[] {
  const next = [...items];
  next.sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return toTimestamp(a.created_at) - toTimestamp(b.created_at);
      case "amount_desc":
        return toNumber(b.amount) - toNumber(a.amount);
      case "amount_asc":
        return toNumber(a.amount) - toNumber(b.amount);
      case "customer_asc":
      case "customer_desc": {
        const aName = (a.customer?.name || "").trim();
        const bName = (b.customer?.name || "").trim();
        if (!aName && !bName) return 0;
        if (!aName) return 1;
        if (!bName) return -1;
        return sortBy === "customer_asc" ? compareText(aName, bName) : compareText(bName, aName);
      }
      case "newest":
      default:
        return toTimestamp(b.created_at) - toTimestamp(a.created_at);
    }
  });
  return next;
}

export function sortCustomerItems<T extends CustomerSortItem>(items: T[], sortBy: CustomerSortOption): T[] {
  const next = [...items];
  next.sort((a, b) => {
    switch (sortBy) {
      case "oldest":
        return toTimestamp(a.created_at) - toTimestamp(b.created_at);
      case "name_asc":
        return compareText(a.name, b.name);
      case "name_desc":
        return compareText(b.name, a.name);
      case "newest":
      default:
        return toTimestamp(b.created_at) - toTimestamp(a.created_at);
    }
  });
  return next;
}
