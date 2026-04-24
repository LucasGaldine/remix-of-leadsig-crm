# Getting Started: Settings - Company Profile

## Overview

Company Profile settings define the business identity shown across estimates, invoices, and customer-facing communication. This is also where you configure the visual theme of your client portal and manage the team invite code.

## What This Area Is For

Use this settings area to:

- Set the legal/business display name shown on all documents.
- Maintain company contact details: email, phone, address, billing email, and website.
- Upload and manage your company logo (appears on estimates, invoices, and the client portal).
- Customize the client portal's brand color and text color.
- Access and share the company invite code for onboarding new team members.

## Sections

### Team

Contains the **Company Invite Code** — a read-only code that new team members enter during signup to join your company. Use the copy button to share it. The code cannot be changed manually.

### Business Information

All fields in this section appear on estimates, invoices, and customer-facing communication.

| Field | Required | Notes |
|---|---|---|
| Company Logo | No | PNG, JPG, SVG, or WebP. Max 5 MB. Aspect ratio must be between 1:1 and 4:1. |
| Company Name | **Yes** | Displayed on all documents and the client portal header. |
| Company Email | No | General contact email shown to clients. |
| Company Phone | No | Displayed on invoices and estimates. |
| Business Address | No | Multi-line. Shown on invoices and estimates. |
| Billing Email | No | Separate email for receiving billing-related notifications. Useful if billing goes to a different inbox than general contact. |
| Website | No | URL displayed on client-facing documents. |

#### Logo Upload Details

- Accepted formats: PNG, JPG/JPEG, SVG, WebP
- Maximum file size: 5 MB
- Aspect ratio: between 1:1 (square) and 4:1 (wide banner). Taller or narrower images are rejected.
- The logo is previewed immediately after selection, before saving. Clicking "Replace Logo" lets you swap it out.
- The logo is not uploaded to storage until you save — the preview uses a temporary local object URL.

### Client Portal Branding

Controls the color theme of your public-facing client portal (the page customers see to track jobs and pay invoices).

| Setting | Description |
|---|---|
| Portal Color | Background/accent color for the portal header and action buttons. Set via color picker or hex input (e.g. `#1e3a8a`). |
| Portal Text Color | Text color used on top of the portal color (e.g. white `#ffffff` or dark `#0f172a`). |

Both fields accept hex values directly. Invalid hex values are automatically reset to the system default on blur:
- Default portal color: `#334155`
- Default text color: `#0f172a`

A **live preview** of the client portal header and a sample "Pay Invoice" button updates in real time as you adjust colors, so you can validate readability and contrast before saving.

## Core Workflow

1. Navigate to `/settings/company`.
2. Share the Company Invite Code with any new team members who need to join your account.
3. Fill in or verify all Business Information fields. Company Name is required before saving.
4. Upload a logo if you haven't already — this appears on all PDFs and the client portal.
5. Adjust Portal Color and Portal Text Color. Use the live preview to confirm the colors are readable.
6. Click **Save** in the sticky action bar at the bottom. If you navigate away with unsaved changes, you'll be prompted to save or discard.

## Unsaved Changes Guard

If you edit any field and attempt to navigate away, a dialog will appear asking whether to save or discard changes. This prevents accidental data loss.

## Key Actions and Navigation

- `Company Profile Settings`: `/settings/company`
- `Profile Settings (personal account)`: `/settings/profile`
- `Team management`: `/settings/crew` — for managing roles and permissions after team members join
- `Preview branding in documents`: review estimate/invoice views in [Estimates](./2026-04-12-estimates.md) and [Invoices & Payments](./2026-04-12-invoices-and-payments.md)

## Role and Permission Notes

- Only `owner` and `admin` roles should update company profile settings. These settings affect all client-facing documents.
- The Company Invite Code is visible to anyone who can access this settings page — keep it treated as semi-private.
- Non-admin roles (`sales`, `crew_lead`, `crew_member`) do not need access to this page.

## Common Mistakes and Best Practices

| Mistake | Best Practice |
|---|---|
| Leaving company name, phone, or address blank | Complete all Business Information fields before sending any documents to clients. Incomplete data looks unprofessional on invoices and estimates. |
| Uploading a low-quality or incorrectly sized logo | Use a clear, high-resolution image in PNG or SVG format. SVG scales perfectly at any size. Aspect ratio must be 1:1 to 4:1. |
| Choosing a portal color with poor contrast against the text color | Use the live preview to verify that button labels and header text are legible. A dark background (`#1e3a8a`) pairs well with white text (`#ffffff`). |
| Setting a billing email and forgetting to monitor it | Billing notifications go only to the billing email if set — make sure it's actively monitored or set to the same as company email. |
| Not updating the profile after a business move or phone change | Audit this page when any contact info changes. Old data on invoices can cause client confusion. |
| Sharing the invite code publicly | Treat the invite code like a password. Anyone with the code can join your company account during signup. |
