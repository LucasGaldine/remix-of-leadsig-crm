import { useState } from "react";
import { Receipt, ChevronRight } from "lucide-react";
import { useJobLineItems } from "@/hooks/useJobLineItems";
import { JobCostsModal } from "./JobCostsModal";

interface JobCostsProps {
  jobId: string;
}

export const JobCosts = ({ jobId }: JobCostsProps) => {
  const { lineItems, isLoading, totalCost } = useJobLineItems(jobId);
  const [modalOpen, setModalOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="card-elevated rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-secondary">
            <Receipt className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Job Costs</p>
            <div className="flex justify-center py-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!lineItems || lineItems.length === 0) {
    return (
      <div className="card-elevated rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-secondary">
            <Receipt className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Job Costs</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              No cost items yet
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Costs will be copied from estimate when approved
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="w-full card-elevated rounded-lg p-4 text-left hover:shadow-md transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-secondary">
            <Receipt className="h-5 w-5 text-secondary-foreground" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Job Costs</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-muted-foreground">
              {lineItems.length} line {lineItems.length === 1 ? 'item' : 'items'}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </button>

      <JobCostsModal jobId={jobId} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
};
