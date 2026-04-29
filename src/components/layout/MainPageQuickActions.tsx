import { useState } from "react";
import { Hammer, UserPlus } from "lucide-react";
import { FloatingActionButton } from "@/components/layout/FloatingActionButton";
import { AddLeadDialog } from "@/components/leads/AddLeadDialog";
import { CreateJobDialog } from "@/components/jobs/CreateJobDialog";

interface MainPageQuickActionsProps {
  onLeadCreated?: (leadId: string) => void;
  onJobCreated?: (jobId: string) => void;
  show?: boolean;
}

export function MainPageQuickActions({ onLeadCreated, onJobCreated, show = true }: MainPageQuickActionsProps) {
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [addJobOpen, setAddJobOpen] = useState(false);

  if (!show) return null;

  return (
    <>
      <FloatingActionButton
        actions={[
          {
            icon: <UserPlus className="h-5 w-5" />,
            label: "Add Lead",
            onClick: () => setAddLeadOpen(true),
          },
          {
            icon: <Hammer className="h-5 w-5" />,
            label: "Add Job",
            onClick: () => setAddJobOpen(true),
            primary: true,
          },
        ]}
      />

      {addLeadOpen && (
        <AddLeadDialog
          open={addLeadOpen}
          onOpenChange={setAddLeadOpen}
          onLeadCreated={onLeadCreated}
        />
      )}

      {addJobOpen && (
        <CreateJobDialog
          open={addJobOpen}
          onOpenChange={setAddJobOpen}
          onJobCreated={onJobCreated}
        />
      )}
    </>
  );
}
