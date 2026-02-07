import {
  CheckCircle,
  Clock,
  UserCheck,
  Briefcase,
  DollarSign,
  FileText,
  CalendarDays,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export interface DashboardCardConfig {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  variant: "default" | "success" | "warning" | "danger";
  navigateTo: string;
}

export const DASHBOARD_CARDS: DashboardCardConfig[] = [
  {
    id: "leads_pending",
    label: "Leads Pending",
    description: "Leads awaiting your approval",
    icon: CheckCircle,
    variant: "warning",
    navigateTo: "/leads/pending-approval",
  },
  {
    id: "pending_approvals",
    label: "Pending Approvals",
    description: "Estimates sent and awaiting client approval",
    icon: Clock,
    variant: "warning",
    navigateTo: "/payments",
  },
  {
    id: "qualified_leads",
    label: "Qualified Leads",
    description: "Approved leads ready to convert",
    icon: UserCheck,
    variant: "success",
    navigateTo: "/leads",
  },
  {
    id: "active_jobs",
    label: "Active Jobs",
    description: "Total jobs currently in progress",
    icon: Briefcase,
    variant: "default",
    navigateTo: "/jobs",
  },
  {
    id: "todays_jobs",
    label: "Today's Jobs",
    description: "Jobs scheduled for today",
    icon: CalendarDays,
    variant: "default",
    navigateTo: "/schedule",
  },
  {
    id: "revenue_this_month",
    label: "Revenue This Month",
    description: "Total revenue collected this month",
    icon: TrendingUp,
    variant: "success",
    navigateTo: "/payments",
  },
  {
    id: "outstanding_invoices",
    label: "Outstanding Invoices",
    description: "Unpaid invoices needing attention",
    icon: FileText,
    variant: "warning",
    navigateTo: "/payments",
  },
  {
    id: "total_leads",
    label: "Total Leads",
    description: "All leads in your pipeline",
    icon: UserCheck,
    variant: "default",
    navigateTo: "/leads",
  },
  {
    id: "completed_jobs",
    label: "Completed Jobs",
    description: "Jobs finished but not yet invoiced",
    icon: CheckCircle,
    variant: "success",
    navigateTo: "/jobs",
  },
  {
    id: "paid_jobs",
    label: "Paid Jobs",
    description: "Jobs that have been paid",
    icon: DollarSign,
    variant: "success",
    navigateTo: "/jobs",
  },
];

export const DEFAULT_CARD_IDS = ["leads_pending", "pending_approvals", "qualified_leads"];

export function getCardConfig(id: string): DashboardCardConfig | undefined {
  return DASHBOARD_CARDS.find((c) => c.id === id);
}
