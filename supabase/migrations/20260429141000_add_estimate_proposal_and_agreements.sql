-- Proposal presentation + agreement requirements for estimates
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS proposal_settings jsonb NOT NULL DEFAULT jsonb_build_object(
    'sections', jsonb_build_object(
      'cover_page', true,
      'scope_of_work', true,
      'meet_your_team', true,
      'materials', true,
      'project_visualization', true,
      'pricing_options', true,
      'agreements_and_signatures', true
    ),
    'title', null,
    'team_member_ids', '[]'::jsonb,
    'highlight_line_item_ids', '[]'::jsonb
  ),
  ADD COLUMN IF NOT EXISTS project_visualization_image_url text,
  ADD COLUMN IF NOT EXISTS agreement_templates jsonb NOT NULL DEFAULT jsonb_build_object(
    'job_release_agreement', 'By approving this estimate, you authorize release of work, materials, and scheduling per the agreed scope.',
    'job_agreement', 'By approving this estimate, you agree to the project scope, pricing, payment terms, and execution plan.',
    'warranty_agreement', 'By approving this estimate, you acknowledge and accept the warranty terms provided by the contractor.'
  ),
  ADD COLUMN IF NOT EXISTS agreement_acceptance jsonb;
