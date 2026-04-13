# Getting Started: Customers

## Overview

The Customers area is your central record for every client your business has worked with or is currently serving. Each customer profile stores contact details, service address, notes, and a full history of linked jobs, estimates, and invoices — giving you and your team everything needed to pick up where you left off, without hunting through other records.

---

## Navigating to Customers

Go to **Clients** from the main navigation. The directory lists all customers in your account. Use the search bar to filter by name, and the sort button to order by:

- **Name A–Z / Z–A** — alphabetical
- **Newest / Oldest first** — by date added

Tap any customer card to open their full profile.

---

## Adding a Customer

There are two ways to add customers: manually one at a time, or in bulk via CSV import.

### Add manually

Open the **Add Customer** action from the Clients page. Fill in:

| Field | Required |
|---|---|
| Name | Yes |
| Phone | No |
| Email | No |
| Address | No |
| City | No |

Only name is required to save a record. You can fill in the rest later, but completing contact and address details upfront saves friction when creating jobs or sending documents.

### Import from CSV

If you're migrating from another system or have a spreadsheet of clients, use **Import from CSV** inside the Add Customer dialog.

**How it works:**

1. **Upload** — Drag and drop or browse to select a `.csv` file (max 5MB). The file must have a header row.
2. **Map columns** — LeadSig reads your column headers and auto-maps them to customer fields where it can (e.g., a column called "phone number" maps to Phone automatically). Review each column and assign it to: Name, Email, Phone, Address, or City — or mark it as "Skip column" to ignore it.
   - **Name is required** — you must map at least one column to Name before importing.
   - You can map multiple columns to the same field (e.g., "First Name" and "Last Name" both mapped to Name — they'll be combined with a space).
3. **Import** — LeadSig processes each row and skips duplicates intelligently using `findOrCreateCustomer`. Rows with a missing name are skipped and reported as errors.
4. **Review results** — After import, you'll see a count of successful imports and any rows that were skipped, with error details per row.

---

## Customer Profile

Opening a customer takes you to their detail view, which has two main sections: the contact card at the top and tabbed history below.

### Contact Card

Displays the customer's name, phone, email, and address. From here you can take quick actions directly:

- **Call** — opens a phone call to the customer's number
- **Text** — opens an SMS to the customer's number
- **Navigate** — opens Google Maps directions to the customer's address

The card also shows the total number of jobs linked to this customer.

### Tabs: Jobs, Estimates, Invoices

Switch between three tabs to see the customer's full history:

- **Jobs** — all jobs linked to this customer, with service type, status badge, and relative date. Tap any job to open it.
- **Estimates** — all estimates for this customer, with total amount and status (Draft, Sent, Approved). Tap to open the estimate.
- **Invoices** — all invoices for this customer, with total, linked job name, date, and status (Pending, Paid). Tap to open the invoice.

### Notes

If the customer has notes saved on their profile, they appear below the tabs in a dedicated card. Notes are plain text and visible to anyone with access to the customer record.

---

## Client Portal Link

Each customer can be given a **Client Portal** — a private link that lets them view their own jobs, estimates, and invoices without logging in.

To generate a portal link:

1. Open the customer's profile.
2. Tap **Client Portal** in the top-right of the contact card.
3. LeadSig generates a unique, secure token for this customer and displays the shareable URL.
4. Copy the link, or send it directly via **Email** or **Text** from the share dialog.

The portal link is persistent — generating it again returns the same URL. The customer can use it anytime to check their job status or review documents you've sent them.

> See [Client Portal & Sharing](./2026-04-12-client-portal-and-sharing.md) for a full walkthrough of what clients see.

---

## Editing and Deleting Customers

From inside a customer profile, tap the **⋮ menu** next to the customer's name to access:

- **Edit Customer** — update name, phone, email, address, or city.
- **Delete Customer** — permanently removes the customer and all associated jobs, estimates, invoices, and data. This action cannot be undone. A confirmation dialog is shown before deletion proceeds.

---

## Roles and Permissions

- `owner`, `admin`, and `sales` users can create, edit, import, and delete customer records.
- `crew_lead` and `crew_member` roles access customer context through their assigned jobs — they do not manage the customer directory directly.

---

## Best Practices

**Search before creating.** Before adding a new customer, search by phone number or email to make sure they don't already exist. Duplicate records cause split job history and reporting problems.

**Fill in contact details early.** Even if you don't have all the details at first contact, add what you know. A customer with no phone or address makes it harder to send estimates, dispatch crews, or generate directions later.

**Keep canonical data in profile fields — not notes.** If a customer gives you a new phone number, update the Phone field. Don't leave it in a note. Notes are for context, not contact info.

**Use the portal link proactively.** Send the client portal link when you start a job, not just at invoice time. Clients who can self-serve their job status ask fewer questions and feel more informed.
