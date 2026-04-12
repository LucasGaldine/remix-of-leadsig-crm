type CustomerEditFields = {
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  customer_address: string;
  customer_city: string;
};

type JobWithCustomer = {
  customer?: {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
};

const nullableTrimmed = (value: string) => value.trim() || null;

export function applyCustomerContactToJob(job: JobWithCustomer, edits: CustomerEditFields): JobWithCustomer {
  if (!job || !job.customer) {
    return job;
  }

  return {
    ...job,
    customer: {
      ...job.customer,
      name: nullableTrimmed(edits.customer_name),
      phone: nullableTrimmed(edits.customer_phone),
      email: nullableTrimmed(edits.customer_email),
      address: nullableTrimmed(edits.customer_address),
      city: nullableTrimmed(edits.customer_city),
    },
  };
}
