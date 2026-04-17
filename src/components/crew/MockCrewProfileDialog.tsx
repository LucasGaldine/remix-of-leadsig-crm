import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CrewRoleSelect } from "@/components/crew/CrewRoleSelect";
import { crewOnlyRoles } from "@/lib/crewRoles";
import { CREW_DESCRIPTION_MAX_LENGTH } from "@/lib/crewDescription";

interface MockCrewProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isEdit: boolean;
  isSaving: boolean;
  name: string;
  onNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  role: "crew_lead" | "crew_member";
  onRoleChange: (value: "crew_lead" | "crew_member") => void;
  onSave: () => void;
}

export function MockCrewProfileDialog({
  open,
  onOpenChange,
  isEdit,
  isSaving,
  name,
  onNameChange,
  phone,
  onPhoneChange,
  description,
  onDescriptionChange,
  role,
  onRoleChange,
  onSave,
}: MockCrewProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Mock Crew Profile" : "Add Mock Crew Profile"}</DialogTitle>
          <DialogDescription>
            Use mock profiles to assign unsigned crew members to job schedules.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="mock-profile-name">Name</Label>
            <Input
              id="mock-profile-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="e.g. Alex - Seasonal Crew"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mock-profile-phone">Phone (optional)</Label>
            <Input
              id="mock-profile-phone"
              value={phone}
              onChange={(event) => onPhoneChange(event.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mock-profile-description">Short Description (optional)</Label>
            <Textarea
              id="mock-profile-description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value.slice(0, CREW_DESCRIPTION_MAX_LENGTH))}
              placeholder="e.g. Seasonal cleanup and mulch installs"
            />
            <p className="text-right text-xs text-muted-foreground">
              {description.length}/{CREW_DESCRIPTION_MAX_LENGTH}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="mock-profile-role">Role</Label>
            <CrewRoleSelect
              id="mock-profile-role"
              value={role}
              roles={crewOnlyRoles}
              onValueChange={(value) => onRoleChange(value as "crew_lead" | "crew_member")}
            />
          </div>
        </div>
        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button className="flex-1" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={onSave} disabled={!name.trim() || isSaving}>
            {isSaving ? "Saving..." : "Save Profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
