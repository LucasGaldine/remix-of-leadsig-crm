export interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  bullets: string[];
  media: {
    src: string;
    type: "image" | "video";
  };
}

export const onboardingSlides: OnboardingSlide[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Your home base for what needs attention first.",
    bullets: [
      "Quick stats give you an instant read on pipeline, jobs, and revenue.",
      "Priority sections surface leads, approvals, and work that need action.",
      "Use it as your starting point each day to decide what to tackle next.",
    ],
    media: {
      src: "/Onboarding/dashboard.png",
      type: "image",
    },
  },
  {
    id: "lead-to-job",
    title: "Lead To Job",
    description: "This is where incoming leads start moving into active work.",
    bullets: [
      "The yellow Pending label marks leads that came in from your integrations.",
      "Review those leads, qualify them, and move the right ones into jobs.",
      "This keeps new inbound opportunities separate from work already in progress.",
    ],
    media: {
      src: "/Onboarding/lead_to_job.mov",
      type: "video",
    },
  },
  {
    id: "unassigned-job",
    title: "Unassigned Job",
    description: "This label flags work that still needs an owner.",
    bullets: [
      "Unassigned means no crew member or team lead has been attached to the job yet.",
      "Use it as a quick signal that scheduling is not fully locked in.",
      "Assigning the job helps your team know who is responsible before the work starts.",
    ],
    media: {
      src: "/Onboarding/unassigned_jobs.mov",
      type: "video",
    },
  },
  {
    id: "need-invoice-job",
    title: "Need Invoice Job",
    description: "This label points to work that is finished but not billed.",
    bullets: [
      "Need Invoice means the job is ready for billing follow-up.",
      "It helps you catch completed work before revenue slips through the cracks.",
      "Use this status to create and send the invoice as the next step.",
    ],
    media: {
      src: "/Onboarding/need_invoice_job.mov",
      type: "video",
    },
  },
  {
    id: "client-portal",
    title: "Client Portal",
    description: "A shareable job view built for your customer.",
    bullets: [
      "Share this link directly with the client so they can track progress.",
      "The portal gives them a clean view of scheduling, updates, photos, and activity.",
      "It reduces back-and-forth by keeping job information in one place.",
    ],
    media: {
      src: "/Onboarding/client_portal.mov",
      type: "video",
    },
  },
  {
    id: "calendar",
    title: "Calendar",
    description: "Your scheduling view for upcoming work.",
    bullets: [
      "Use the calendar to see when jobs are planned across the team.",
      "It helps you manage workload, timing, and appointment visibility in one place.",
      "This page is best for checking the day, week, and job timing at a glance.",
    ],
    media: {
      src: "/Onboarding/calendar.png",
      type: "image",
    },
  },
  {
    id: "payment",
    title: "Payment",
    description: "The billing area for estimates, invoices, and collected payments.",
    bullets: [
      "The page is laid out so you can move between estimates, invoices, and payment records.",
      "Use it to track what has been sent, what is outstanding, and what is already paid.",
      "It acts as the central place for revenue follow-up and payment history.",
    ],
    media: {
      src: "/Onboarding/payment.png",
      type: "image",
    },
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "The setup area for connected lead sources and external tools.",
    bullets: [
      "This is where you connect and manage your integrations.",
      "Use it to control where leads come from and how they enter LeadSig.",
      "If a source needs to be connected, updated, or reviewed, start here.",
    ],
    media: {
      src: "/Onboarding/integrations.png",
      type: "image",
    },
  },
];
