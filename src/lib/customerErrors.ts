const DUPLICATE_KEY_CODE = "23505";
const CUSTOMER_NAME_ADDRESS_UNIQUE_CONSTRAINT = "customers_account_name_address_unique";
const DUPLICATE_CUSTOMER_MESSAGE = "A customer with this name and address already exists.";

interface PostgresErrorLike {
  code?: string;
  constraint?: string;
  message?: string;
}

function asPostgresError(error: unknown): PostgresErrorLike | null {
  if (!error || typeof error !== "object") return null;
  return error as PostgresErrorLike;
}

export function isDuplicateCustomerNameAddressError(error: unknown): boolean {
  const pgError = asPostgresError(error);
  if (!pgError) return false;

  return (
    pgError.code === DUPLICATE_KEY_CODE &&
    (pgError.constraint === CUSTOMER_NAME_ADDRESS_UNIQUE_CONSTRAINT ||
      pgError.message?.includes(CUSTOMER_NAME_ADDRESS_UNIQUE_CONSTRAINT) === true)
  );
}

export function getCustomerWriteErrorMessage(
  error: unknown,
  fallbackMessage = "Failed to create customer",
): string {
  if (isDuplicateCustomerNameAddressError(error)) {
    return DUPLICATE_CUSTOMER_MESSAGE;
  }

  return fallbackMessage;
}
