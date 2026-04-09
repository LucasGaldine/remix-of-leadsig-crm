import { AppRole } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ownerManageableRoles, roleBadgeColors, roleLabels } from "@/lib/crewRoles";

interface CrewRoleSelectProps {
  id?: string;
  value: AppRole | "";
  onValueChange: (value: AppRole) => void;
  placeholder?: string;
  roles?: AppRole[];
}

export function CrewRoleSelect({
  id,
  value,
  onValueChange,
  placeholder = "Select a role",
  roles = ownerManageableRoles,
}: CrewRoleSelectProps) {
  return (
    <Select value={value} onValueChange={(nextValue) => onValueChange(nextValue as AppRole)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role} value={role}>
            <div className="flex items-center gap-2">
              <Badge className={`${roleBadgeColors[role]} text-white`}>
                {roleLabels[role]}
              </Badge>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
