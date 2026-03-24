interface ResolveCreateJobAddressInput {
  jobAddress?: string | null;
  customerAddress?: string | null;
}

export function resolveCreateJobAddress({
  jobAddress,
  customerAddress,
}: ResolveCreateJobAddressInput): string | null {
  const normalizedJobAddress = jobAddress?.trim() || "";
  if (normalizedJobAddress) {
    return normalizedJobAddress;
  }

  const normalizedCustomerAddress = customerAddress?.trim() || "";
  if (normalizedCustomerAddress) {
    return normalizedCustomerAddress;
  }

  return null;
}
