interface EstimateLike {
  status?: string | null;
  total?: number | string | null;
  versions?: Array<{ total?: number | string | null } | null> | null;
}

export function getEstimateCardTotal(estimate: EstimateLike | null | undefined): number {
  const isAcceptedEstimate = String(estimate?.status || "") === "accepted";
  const estimateVersionTotals = (estimate?.versions || [])
    .map((version) => Number(version?.total))
    .filter((value): value is number => Number.isFinite(value));

  if (isAcceptedEstimate) {
    return Number(estimate?.total || 0);
  }

  if (estimateVersionTotals.length > 0) {
    return Math.min(...estimateVersionTotals);
  }

  return Number(estimate?.total || 0);
}
