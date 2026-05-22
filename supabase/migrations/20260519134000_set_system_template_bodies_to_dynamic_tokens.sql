/*
  # Set system document template bodies to dynamic token versions

  Applies canonical tokenized bodies for the default system templates:
  - job_agreement
  - warranty_agreement
  - job_release
*/

UPDATE public.document_templates
SET
  body = $body$
JOB AGREEMENT

Date: [[current_date]]

Client: [[client_name]]
Project: [[job_name]]
Service Type: [[service_type]]
Project Address: [[job_address]]

Contractor: [[company_name]]
Contact: [[company_email]] | [[company_phone]]

Scope of Work:
[[scope_of_work]]

Pricing Summary:
- Subtotal: [[estimate_subtotal]]
- Tax: [[estimate_tax]]
- Discount: [[estimate_discount]]
- Total: [[estimate_total]]

By signing, the client authorizes [[company_name]] to perform the scope of work above according to agreed pricing and schedule terms.
$body$,
  updated_at = now()
WHERE system_key = 'job_agreement';

UPDATE public.document_templates
SET
  body = $body$
WARRANTY AGREEMENT

Date: [[current_date]]

Client: [[client_name]]
Project: [[job_name]]
Project Address: [[job_address]]

Contractor: [[company_name]]
Contact: [[company_email]] | [[company_phone]]

Covered Scope:
[[scope_of_work]]

This warranty covers defects in workmanship for completed work listed above, subject to normal use and standard exclusions.
$body$,
  updated_at = now()
WHERE system_key = 'warranty_agreement';

UPDATE public.document_templates
SET
  body = $body$
JOB RELEASE AGREEMENT

Date: [[current_date]]

Client: [[client_name]]
Project: [[job_name]]
Project Address: [[job_address]]

Contractor: [[company_name]]
Contact: [[company_email]] | [[company_phone]]

Completed Scope:
[[scope_of_work]]

By signing, the client confirms the listed work is complete and accepted, and that no further claims remain other than any written warranty obligations.
$body$,
  updated_at = now()
WHERE system_key = 'job_release';

