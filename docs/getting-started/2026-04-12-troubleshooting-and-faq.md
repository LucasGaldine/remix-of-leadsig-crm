# Troubleshooting & FAQ

## Overview

This guide answers the most common questions users run into when using LeadSig. If something isn't working as expected, start here before reaching out to support.

---

## Leads & Customers

**Why isn't my new lead showing up in the leads list?**
Check that you're not filtering by a status that excludes new leads. Open `/leads` and clear any active filters (status, source, date range). If you created the lead from a form integration, give it a moment — webhook deliveries can take up to 30 seconds.

**Why was a lead automatically moved to a different status?**
LeadSig can automatically update lead statuses based on automation rules you've configured. Go to **Settings → Auto-Responses & Lead Automations** to review any active rules that may be triggering status changes.

**A customer's contact info is showing as outdated. Where do I update it?**
Customer profiles are managed under `/customers`. Open the customer record and edit their details there. Changes will reflect across all linked leads, jobs, and invoices.

---

## Jobs & Scheduling

**A job isn't appearing on the schedule calendar.**
Jobs only appear on the schedule if they have a date and time assigned. Open the job and confirm the scheduled date is set. Also check that you're viewing the correct date range on the calendar.

**A crew member can't see a job assigned to them.**
Crew members only see jobs they're explicitly assigned to. Verify the assignment under the job's crew section. Also confirm the crew member is logging in with the correct account — each user has their own login.

**Why is a job showing the wrong status?**
Job statuses can update automatically when linked estimates are approved or invoices are paid. If the status looks wrong, check the job's linked records for recent activity.

---

## Estimates & Invoices

**My estimate was sent but the client says they didn't receive it.**
First, confirm the email address on file is correct under the customer record. Then check **Settings → Notifications** to make sure outbound estimate emails are enabled. If the address is correct, ask the client to check their spam folder.

**A client can't view their estimate or invoice link.**
Estimate and invoice links use the Client Portal. If the link isn't working, check that Client Portal access is enabled under **Settings → Integrations**. The link also expires if the estimate has been voided or the invoice has been cancelled.

**Why can't I edit an invoice after it was sent?**
Once an invoice is sent or has a payment recorded, editing is restricted to protect payment records. If you need to make a change, you can void the invoice and create a new one, or add a note to the record.

---

## Messaging

**Messages I send aren't being delivered.**
Go to **Settings → Integrations** and verify your messaging integration (e.g., SMS provider) is connected and the credentials are valid. If the integration was recently reconnected, send a test message to confirm it's working.

**I'm not receiving new message notifications.**
Check **Settings → Notifications** to confirm in-app and/or email notifications for new messages are turned on for your account. Also verify your browser has permission to send notifications if you rely on desktop alerts.

---

## Payments & Billing

**A payment was made but the invoice still shows as unpaid.**
Payment status updates depend on your Stripe integration. Go to **Settings → Integrations** and confirm Stripe is connected. If Stripe is connected and the invoice is still unpaid, check the Stripe dashboard for the transaction — it may have failed or been disputed.

**I can't process a payment — the button is disabled.**
Payments can only be processed on invoices that are in a "sent" or "overdue" state. If the invoice is still a draft, send it first. Also confirm your Stripe account is fully set up and not in restricted mode.

---

## Roles & Permissions

**A team member can't access a page they should be able to see.**
Access is controlled by roles. Confirm the team member has the correct role assigned under **Settings → Team & Roles**. The permission hierarchy is: `owner → admin → sales → crew_lead → crew_member`. Crew members have a separate dashboard at `/crew` and don't have access to the main app pages.

**I accidentally gave someone the wrong role. How do I fix it?**
Go to **Settings → Team & Roles**, find the team member, and update their role. Changes take effect on their next page load or login.

---

## Integrations & API

**My integration stopped working after I changed my API key.**
When you rotate an API key, you must update it in LeadSig as well. Go to **Settings → API Keys** or **Settings → Integrations**, remove the old key, and enter the new one.

**A webhook I set up isn't triggering.**
Verify the endpoint URL is correct and publicly accessible. Check that the webhook secret (if required) matches what your receiving server expects. Test the connection from the integration settings page if that option is available.

---

## Still Need Help?

If your issue isn't covered here:

1. Check the relevant section in the [Getting Started docs](./2026-04-12-main-pages-overview-and-actions.md).
2. Reproduce the issue with the exact URL, record ID, and what you expected vs. what happened.
3. Reach out to your account owner or admin — they can escalate with full context if needed.
