update public.document_templates
set body = trim($md$
**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Service Type:** [[service_type]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Scope of Work
[[scope_of_work]]

## Pricing Summary
- **Subtotal:** [[estimate_subtotal]]
- **Tax:** [[estimate_tax]]
- **Discount:** [[estimate_discount]]
- **Total:** [[estimate_total]]

By signing, the client authorizes **[[company_name]]** to perform the scope of work above according to agreed pricing and schedule terms.
$md$),
updated_at = now()
where system_key = 'job_agreement';

update public.document_templates
set body = trim($md$
**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Covered Scope
[[scope_of_work]]

This warranty covers defects in workmanship for completed work listed above, subject to normal use and standard exclusions.
$md$),
updated_at = now()
where system_key = 'warranty_agreement';

update public.document_templates
set body = trim($md$
**Date:** [[current_date]]

## Client
- **Name:** [[client_name]]
- **Project:** [[job_name]]
- **Project Address:** [[job_address]]

## Contractor
- **Company:** [[company_name]]
- **Contact:** [[company_email]] | [[company_phone]]

## Completed Scope
[[scope_of_work]]

By signing, the client confirms the listed work is complete and accepted, and that no further claims remain other than any written warranty obligations.
$md$),
updated_at = now()
where system_key = 'job_release';
