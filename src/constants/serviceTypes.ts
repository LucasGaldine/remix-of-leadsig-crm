export const SERVICE_TYPES = [
  "Pavers / Patio",
  "Concrete",
  "Sod / Lawn",
  "Deck",
  "Fencing",
  "Retaining Wall",
  "Grading",
  "Landscaping",
  "Hardscaping",
  "Other",
] as const;

export type ServiceType = typeof SERVICE_TYPES[number];

