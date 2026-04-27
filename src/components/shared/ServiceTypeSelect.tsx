import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

const EDIT_SERVICE_TYPES_VALUE = "__edit_service_types__";

interface ServiceTypeSelectProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function ServiceTypeSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select service type",
  className,
}: ServiceTypeSelectProps) {
  const navigate = useNavigate();

  const handleValueChange = (nextValue: string) => {
    if (nextValue === EDIT_SERVICE_TYPES_VALUE) {
      navigate("/settings/pricing-rules");
      return;
    }

    onValueChange(nextValue);
  };

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((type) => (
          <SelectItem key={type} value={type}>
            {type}
          </SelectItem>
        ))}
        <SelectItem value={EDIT_SERVICE_TYPES_VALUE} className="mt-1 border-t border-border pt-2 text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Edit service types
          </span>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
