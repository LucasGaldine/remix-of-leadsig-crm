export const formatCurrency = (
  value: string | number,
  options?: {
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
) => {
  if (value === null || value === undefined || value === "") return "";

  const numericValue =
    typeof value === "number"
      ? value
      : Number(value.toString().replace(/\D/g, ""));

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: options?.currency ?? "USD",
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(numericValue);
};
