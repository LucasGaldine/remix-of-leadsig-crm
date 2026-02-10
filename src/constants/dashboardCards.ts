import {
  Inbox,
  Clock,
  Target,
  Hammer,
  CalendarDays,
  TrendingUp,
  FileWarning,
  Users,
  CircleCheckBig,
  BadgeDollarSign,
  ClipboardList,
  UserX,
  AlertTriangle,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

export interface DashboardCardConfig {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  navigateTo: string;
}

export const DASHBOARD_CARDS: DashboardCardConfig[] = [
  {
    id: "leads_pending",
    label: "Leads Pending",
    description: "Leads awaiting your approval",
    icon: Inbox,
    navigateTo: "/leads/pending-approval",
  },
  {
    id: "pending_approvals",
    label: "Pending Approvals",
    description: "Estimates sent and awaiting client approval",
    icon: Clock,
    navigateTo: "/payments",
  },
  {
    id: "qualified_leads",
    label: "Qualified Leads",
    description: "Approved leads ready to convert",
    icon: Target,
    navigateTo: "/leads",
  },
  {
    id: "active_jobs",
    label: "Active Jobs",
    description: "Jobs currently in progress",
    icon: Hammer,
    navigateTo: "/jobs",
  },
  {
    id: "todays_jobs",
    label: "Today's Jobs",
    description: "Jobs scheduled for today",
    icon: CalendarDays,
    navigateTo: "/schedule",
  },
  {
    id: "total_jobs",
    label: "Total Jobs",
    description: "All jobs across all statuses",
    icon: ClipboardList,
    navigateTo: "/jobs",
  },
  {
    id: "revenue_this_month",
    label: "Revenue This Month",
    description: "Total revenue collected this month",
    icon: TrendingUp,
    navigateTo: "/payments",
  },
  {
    id: "outstanding_invoices",
    label: "Outstanding Invoices",
    description: "Unpaid invoices needing attention",
    icon: FileWarning,
    navigateTo: "/payments",
  },
  {
    id: "total_leads",
    label: "Total Leads",
    description: "All leads in your pipeline",
    icon: Users,
    navigateTo: "/leads",
  },
  {
    id: "completed_jobs",
    label: "Completed Jobs",
    description: "Jobs finished but not yet invoiced",
    icon: CircleCheckBig,
    navigateTo: "/jobs",
  },
  {
    id: "paid_jobs",
    label: "Paid Jobs",
    description: "Jobs that have been paid",
    icon: BadgeDollarSign,
    navigateTo: "/jobs",
  },
  {
    id: "unassigned_jobs",
    label: "Unassigned Jobs",
    description: "Scheduled jobs with no crew assigned",
    icon: UserX,
    navigateTo: "/jobs",
  },
  {
    id: "overdue_jobs",
    label: "Overdue Jobs",
    description: "Jobs past their last scheduled date",
    icon: AlertTriangle,
    navigateTo: "/jobs",
  },
  {
    id: "estimates_needs_review",
    label: "Estimates to Review",
    description: "Estimate visits completed, awaiting your review",
    icon: ClipboardCheck,
    navigateTo: "/payments",
  },
];

export const DEFAULT_CARD_IDS = ["leads_pending", "pending_approvals", "qualified_leads"];

export function getCardConfig(id: string): DashboardCardConfig | undefined {
  return DASHBOARD_CARDS.find((c) => c.id === id);
}

export interface DashboardSectionConfig {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const DASHBOARD_SECTIONS: DashboardSectionConfig[] = [
  {
    id: "awaiting_approval",
    label: "Awaiting Approval",
    description: "Estimates sent and awaiting client approval",
    icon: Clock,
  },
  {
    id: "todays_jobs",
    label: "Today's Jobs",
    description: "Jobs scheduled for today",
    icon: CalendarDays,
  },
  {
    id: "qualified_leads",
    label: "Qualified Leads",
    description: "Approved leads ready to convert",
    icon: Target,
  },
];

export const DEFAULT_SECTION_IDS = ["awaiting_approval", "todays_jobs", "qualified_leads"];
