/*
  Keep the default job agreement document template out of markdown bullet lists.

  Scope of work is intentionally left as [[scope_of_work]] because the merge
  resolver formats that content separately.
*/

UPDATE public.document_templates
SET
  body = trim($md$
**Date:** [[current_date]]

## Client
**Name:** [[client_name]]
**Project:** [[job_name]]
**Service Type:** [[service_type]]
**Project Address:** [[job_address]]

## Contractor
**Company:** [[company_name]]
**Contact:** [[company_email]] | [[company_phone]]

## Scope of Work
[[scope_of_work]]

## Pricing Summary
**Subtotal:** [[estimate_subtotal]]
**Tax:** [[estimate_tax]]
**Discount:** [[estimate_discount]]
**Total:** [[estimate_total]]

## Default Payment Schedule
**Schedule:** [[default_payment_schedule]]
**Deposit:** [[default_payment_deposit_percentage]]%
**Midpoint:** [[default_payment_midpoint_percentage]]%
**Final Payment:** [[default_payment_final_percentage]]%

By signing, the client authorizes **[[company_name]]** to perform the scope of work above according to agreed pricing and schedule terms.
$md$),
  updated_at = now()
WHERE system_key = 'job_agreement'
  AND body LIKE '%[[scope_of_work]]%'
  AND (
    body LIKE '%- **Name:** [[client_name]]%'
    OR body LIKE '%- **Subtotal:** [[estimate_subtotal]]%'
    OR body LIKE '%- Subtotal: [[estimate_subtotal]]%'
  );
