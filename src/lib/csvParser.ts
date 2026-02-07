export interface ParsedCSV {
  headers: string[];
  rows: string[][];
}

export function parseCSV(text: string): ParsedCSV {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}

export const LEAD_FIELDS = [
  { key: "name", label: "Name", required: true },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "address", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "service_type", label: "Service Type" },
  { key: "source", label: "Source" },
  { key: "notes", label: "Notes" },
  { key: "estimated_value", label: "Budget" },
] as const;

export type LeadFieldKey = (typeof LEAD_FIELDS)[number]["key"];

export type ColumnMapping = Record<string, LeadFieldKey | "">;

export function autoMapColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const aliases: Record<string, LeadFieldKey> = {
    name: "name",
    "full name": "name",
    "customer name": "name",
    "client name": "name",
    "contact name": "name",
    first_name: "name",
    firstname: "name",
    "first name": "name",
    last_name: "name",
    lastname: "name",
    "last name": "name",
    surname: "name",
    email: "email",
    "email address": "email",
    phone: "phone",
    "phone number": "phone",
    telephone: "phone",
    mobile: "phone",
    cell: "phone",
    address: "address",
    "street address": "address",
    street: "address",
    city: "city",
    town: "city",
    state: "state",
    province: "state",
    region: "state",
    service_type: "service_type",
    "service type": "service_type",
    service: "service_type",
    type: "service_type",
    source: "source",
    "lead source": "source",
    notes: "notes",
    note: "notes",
    comments: "notes",
    comment: "notes",
    description: "notes",
    estimated_value: "estimated_value",
    "estimated value": "estimated_value",
    budget: "estimated_value",
    value: "estimated_value",
    amount: "estimated_value",
    price: "estimated_value",
  };

  const COMBINABLE_FIELDS: Set<LeadFieldKey> = new Set(["name", "address", "notes"]);
  const usedFields = new Set<LeadFieldKey>();

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    const match = aliases[normalized];
    if (match && (!usedFields.has(match) || COMBINABLE_FIELDS.has(match))) {
      mapping[header] = match;
      usedFields.add(match);
    } else {
      mapping[header] = "";
    }
  }

  return mapping;
}
