# Integrations & API Keys

LeadSig connects to external platforms to pull in leads, accept payments, and automate workflows. This guide walks through each integration — what it does, how to set it up, and how to keep it healthy over time.

---

## Stripe (Payments)

**What it does:** Connects your own Stripe account to LeadSig so you can collect credit card payments on invoices, issue refunds, and view payment history — all without LeadSig holding your funds.

**Required plan:** Basic or higher. The Stripe settings page will prompt you to upgrade if you're on the free plan.

**Who can configure it:** `owner` only.

### Setup steps

1. Go to **Settings → Stripe Payments** (`/settings/stripe`).
2. Tap **Connect Your Stripe Account**.
3. You'll be redirected to Stripe's hosted onboarding flow. Sign in to an existing Stripe account or create a new one.
4. Complete Stripe's identity, banking, and tax verification steps. Stripe may require personal information, a bank account for payouts, and a government-issued ID depending on your country.
5. After finishing, Stripe redirects you back to LeadSig. The status card should now show **Connected**.

### Connection statuses

| Status | Meaning |
|---|---|
| **Connected** | Fully active. Payments and invoices are live. |
| **Pending** | Stripe is still reviewing your account. No action needed yet. |
| **Action Required** | Stripe needs more information. The card will list the specific items. Tap **Open Stripe Dashboard** to complete them. |
| **Not Connected** | No Stripe account linked. Payments and invoices are disabled. |

### Keeping it healthy

- Use **Refresh Status** after completing Stripe requirements to pull the latest state.
- Periodically open the Stripe Dashboard to confirm payouts are flowing to your bank.
- If you need to switch Stripe accounts, **Disconnect** first, then reconnect with the new account.

### Disconnecting

Tap **Disconnect** on the Stripe settings page. You'll be asked to confirm. After disconnecting, invoice creation and payment collection are disabled until you reconnect.

---

## Lead Sources

**What it does:** Connects lead generation platforms so new leads flow into LeadSig automatically — no manual copying required. Supported platforms: **Facebook/Meta**, **Google**, **Angi**, **Yelp**, and **Thumbtack**.

**Required plan:** Basic or higher.

**Who can configure it:** `owner` only.

Navigate to **Settings → Lead Sources** (`/settings/lead-sources`).

---

### Facebook / Meta Leads

Facebook uses OAuth to authorize LeadSig to read leads from your Meta Lead Forms.

**Setup steps:**

1. Open Lead Sources and tap **Connect** next to Facebook Leads.
2. A Facebook login popup will appear. Log in as the Facebook user who manages your Business Page.
3. Grant the requested permissions (access to lead forms and pages).
4. Select the Facebook Page tied to your lead forms.
5. Once connected, any new submission on your Meta Lead Forms will appear in LeadSig automatically.

**Notes:**
- You must be an admin of the Facebook Page you're connecting.
- If you run ads from a Business Manager account, make sure the Page is linked to that Business Manager.
- Token expiry: Facebook OAuth tokens expire periodically. If leads stop syncing, reconnect by disconnecting and going through the flow again.

---

### Google Leads

Google leads come in via an email relay. LeadSig provides a unique inbound email address — you configure Google to forward lead notifications to that address.

**Setup steps:**

1. Open Lead Sources and tap **Connect** next to Google Leads.
2. LeadSig generates a unique inbound relay email address for your account (shown in the connection panel).
3. Copy that email address.
4. In **Google Business Profile** (or Google Ads, depending on your setup), go to lead notification settings and add the LeadSig relay address as a notification recipient.
5. Send a test lead to confirm it arrives in LeadSig.

**Notes:**
- Google does not have a direct API integration — the relay email is the supported method.
- The relay address is unique to your account; don't share it publicly.

---

### Angi, Yelp, Thumbtack

These platforms also use the email relay method.

**Setup steps:**

1. Open Lead Sources and tap **Connect** next to the platform.
2. Copy the inbound relay email address provided.
3. In that platform's account settings, configure new lead notification emails to forward to the LeadSig relay address.
4. Send a test lead or trigger a test notification to verify it arrives.

**Notes:**
- Yelp and Thumbtack send email notifications for new inquiries — the relay captures these and creates a lead in LeadSig.
- Angi sends lead emails in a format LeadSig can parse. If Angi changes their email format, leads may stop parsing correctly — check the connection status if you notice a gap.

---

## API Keys

**What it does:** Generates secret keys that let external tools — Zapier, Make, custom scripts, AI calling systems, or any HTTP client — push leads and events into LeadSig programmatically.

**Who can configure it:** `owner` and `admin`.

Navigate to **Settings → Lead Automations** (`/settings/lead-automations`) or **Settings → API Keys** (`/settings/api-keys`).

### Creating a key

1. Tap **New Key**.
2. Give the key a descriptive name that identifies the integration (e.g., `Zapier – Google Ads`, `AI Calling Bot`).
3. Tap **Create Key**.
4. **Copy the key immediately.** It is shown only once and cannot be recovered. Store it in a password manager or secrets vault.

Keys use the prefix format `lsig_` and are hashed on storage — LeadSig cannot display the full key again after creation.

### Using a key

Include the key in the `x-leadsig-api-key` header on every request:

```
x-leadsig-api-key: lsig_your_key_here
```

### Available endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/functions/v1/leads-inbound` | Create a new lead from an external source |
| `POST` | `/functions/v1/leads-interactions/:leadId` | Add a timeline event to an existing lead |
| `PATCH` | `/functions/v1/leads-status/:leadId` | Update a lead's status |
| `POST` | `/functions/v1/leads-log-message` | Log an inbound or outbound message to a client timeline |

### Managing keys

- **Activate / Deactivate:** Toggle a key on or off without deleting it. Useful for temporarily disabling an integration.
- **Revoke:** Permanently deletes the key. Any integration using it will stop working immediately. Create a new key and update the integration before revoking the old one.
- **One key per integration:** Use a separate key for each external system so you can revoke one without affecting others.

---

## Lead Automations & Webhooks

**What it does:** Exposes webhook endpoints that let external automation tools (Zapier, Make, AI bots, call intake systems) interact with leads and client timelines in real time.

Navigate to **Settings → Lead Automations** (`/settings/lead-automations`).

### Messaging Bot Webhook

Lets SMS or chat bots log messages directly to a client's activity timeline.

**Endpoint:** `POST /functions/v1/leads-log-message`  
**Auth header:** `x-leadsig-api-key: <your-api-key>`

Use this when you have an AI calling or SMS tool that handles conversations — every inbound and outbound message can be written back to the lead's timeline in LeadSig so your team has full context.

### Inbound Lead Webhook

For any automation platform (Zapier, Make, custom scripts) that needs to create leads directly.

**Endpoint:** `POST /functions/v1/leads-inbound`  
**Auth header:** `x-leadsig-api-key: <your-api-key>`

Copy the endpoint URL from the Lead Automations page and paste it into your automation tool as the webhook destination.

---

## Troubleshooting

| Problem | Steps |
|---|---|
| Stripe shows "Action Required" | Open the Stripe Dashboard (link on the settings page), complete the listed requirements, then tap **Refresh Status** |
| Facebook leads stopped syncing | Facebook tokens expire — disconnect and reconnect. Re-select your Page during the flow |
| Google / Angi / Yelp leads not arriving | Confirm the relay email is still set as a notification recipient in that platform's settings. Send a manual test notification |
| API calls returning 401 | Key may be inactive or revoked. Check the key's status on the API Keys page and create a new one if needed |
| API calls returning 403 | Verify your account has the required plan for the endpoint you're calling |

For anything not covered here, see [Troubleshooting & FAQ](./2026-04-12-troubleshooting-and-faq.md) or contact support at support@leadsig.ai.

---

## Role & Access Summary

| Integration | Who can set up | Who can use |
|---|---|---|
| Stripe | `owner` | All roles (via invoices/payments) |
| Lead Sources | `owner` | Automatic — leads flow to all users |
| API Keys | `owner`, `admin` | Any system with the key |
| Lead Automations | `owner`, `admin` | Any system with the key |
