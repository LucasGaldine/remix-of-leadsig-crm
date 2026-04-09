import { AppRole } from "@/hooks/useAuth";

export const roleLabels: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  sales: "Sales",
  crew_lead: "Crew Lead",
  crew_member: "Crew Member",
};

export const roleBadgeColors: Record<AppRole, string> = {
  owner: "bg-purple-500",
  admin: "bg-blue-500",
  sales: "bg-green-500",
  crew_lead: "bg-orange-500",
  crew_member: "bg-gray-500",
};

export const ownerManageableRoles: AppRole[] = [
  "owner",
  "admin",
  "sales",
  "crew_lead",
  "crew_member",
];

export const crewOnlyRoles: AppRole[] = ["crew_lead", "crew_member"];
