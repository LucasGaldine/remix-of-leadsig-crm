export type OnboardingSlideSceneId =
  | "lead-storage-management"
  | "job-tracking-scheduling"
  | "before-photos"
  | "team-setup"
  | "ad-integrations"
  | "branded-website-client-portal"
  | "sms-email-notifications"
  | "automations-auto-replies"
  | "crm-recap-premium-preview";

export interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  sceneId: OnboardingSlideSceneId;
  planAvailabilityLabel: "Free" | "Essentials+" | "Premium";
  successCheckText: string;
}

export const onboardingSlides: OnboardingSlide[] = [
  {
    id: "lead-storage-management",
    title: "Lead Storage & Management",
    description: "Capture, organize, and move leads through a clear pipeline.",
    bullets: [
      "Keep every inbound lead in one place with visible status and ownership.",
      "Use status changes to guide handoffs from outreach to qualification.",
      "Treat this as the source of truth for what needs follow-up next.",
    ],
    sceneId: "lead-storage-management",
    planAvailabilityLabel: "Free",
    successCheckText: "Lead moved from New to Qualified.",
  },
  {
    id: "job-tracking-scheduling",
    title: "Job Tracking and Scheduling",
    description: "Turn approved work into scheduled jobs with clear execution status.",
    bullets: [
      "Create jobs with ownership, due date, and current progress at a glance.",
      "Place jobs on the calendar to eliminate scheduling guesswork.",
      "Use status updates to keep office and field teams aligned.",
    ],
    sceneId: "job-tracking-scheduling",
    planAvailabilityLabel: "Free",
    successCheckText: "Job assigned and scheduled date set.",
  },
  {
    id: "before-photos",
    title: "Before Photos on Leads",
    description: "Attach visual context before work starts.",
    bullets: [
      "Store before-condition photos directly on the lead record.",
      "Give your team better prep context before quoting or dispatch.",
      "Keep visual proof tied to the customer history.",
    ],
    sceneId: "before-photos",
    planAvailabilityLabel: "Essentials+",
    successCheckText: "Before photo attached to lead.",
  },
  {
    id: "team-setup",
    title: "Team Setup",
    description: "Invite users, assign roles, and make responsibilities clear.",
    bullets: [
      "Send invites from one place and onboard teammates quickly.",
      "Assign roles so people see the right tools for their work.",
      "Keep accountability clean with explicit ownership by user.",
    ],
    sceneId: "team-setup",
    planAvailabilityLabel: "Essentials+",
    successCheckText: "User invited and role assigned.",
  },
  {
    id: "ad-integrations",
    title: "Ad Account Integrations",
    description: "Connect lead sources and verify inbound flow.",
    bullets: [
      "Link ad platforms so leads arrive without manual entry.",
      "Confirm connection status and run a quick ingestion check.",
      "Monitor source health from integrations settings.",
    ],
    sceneId: "ad-integrations",
    planAvailabilityLabel: "Essentials+",
    successCheckText: "At least one ad source connected.",
  },
  {
    id: "branded-website-client-portal",
    title: "Branded Website & Client Portal",
    description: "Present customer-facing pages with your brand and shareable links.",
    bullets: [
      "Apply logo and colors so client-facing touchpoints match your brand.",
      "Generate a clean portal experience for job updates and trust.",
      "Share links confidently knowing the client view is ready.",
    ],
    sceneId: "branded-website-client-portal",
    planAvailabilityLabel: "Essentials+",
    successCheckText: "Portal branding updated and link ready to share.",
  },
  {
    id: "sms-email-notifications",
    title: "SMS & Email Notifications",
    description: "Route alerts to the right people at the right time.",
    bullets: [
      "Choose channels and event alerts by role and urgency.",
      "Use quiet hours and digests to reduce noise without missing priority events.",
      "Send a test alert to validate your setup.",
    ],
    sceneId: "sms-email-notifications",
    planAvailabilityLabel: "Essentials+",
    successCheckText: "SMS and email alerts configured.",
  },
  {
    id: "automations-auto-replies",
    title: "Automations & Auto-Replies",
    description: "Create consistent follow-up with trigger-based workflows.",
    bullets: [
      "Use triggers to send instant acknowledgements and internal alerts.",
      "Standardize response speed across your team.",
      "Turn on one automation and confirm it fires correctly.",
    ],
    sceneId: "automations-auto-replies",
    planAvailabilityLabel: "Essentials+",
    successCheckText: "One automation enabled and active.",
  },
  {
    id: "crm-recap-premium-preview",
    title: "CRM Recap + Premium Preview",
    description: "Review your core setup and preview premium growth support.",
    bullets: [
      "Confirm your main CRM systems are configured end to end.",
      "Use this checklist as your launch-ready baseline.",
      "Preview premium outcomes for coaching and growth services.",
    ],
    sceneId: "crm-recap-premium-preview",
    planAvailabilityLabel: "Premium",
    successCheckText: "Core CRM setup checklist completed.",
  },
];
