interface BuildDefaultJobNameInput {
  customerName: string;
  serviceType?: string | null;
  isEstimateVisit?: boolean;
}

export function buildDefaultJobName({
  customerName,
  serviceType,
  isEstimateVisit = false,
}: BuildDefaultJobNameInput): string {
  const trimmedCustomerName = customerName.trim();
  const trimmedServiceType = serviceType?.trim();

  const baseName = trimmedServiceType
    ? `${trimmedCustomerName}, ${trimmedServiceType} Job`
    : `${trimmedCustomerName} Job`;

  return isEstimateVisit ? `${baseName} Estimate Visit` : baseName;
}
