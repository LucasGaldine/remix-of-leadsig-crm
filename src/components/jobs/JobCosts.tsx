import { useEffect, useState } from "react";
import { useJobLineItems } from "@/hooks/useJobLineItems";
import { JobCostsModal } from "./JobCostsModal";
import { ChevronsDown } from "lucide-react";

interface JobCostsProps {
  jobId: string;
  grouped?: boolean;
  openSignal?: number;
  addSignal?: number;
  onEstimateApproved?: () => void | Promise<void>;
}

export const JobCosts = ({
  jobId,
  grouped = false,
  openSignal = 0,
  addSignal = 0,
  onEstimateApproved,
}: JobCostsProps) => {
  const { lineItems, isLoading, totalCost } = useJobLineItems(jobId);
  const [modalOpen, setModalOpen] = useState(false);
  const [startInAddMode, setStartInAddMode] = useState(false);
  const shellClassName = grouped
    ? "p-0 text-foreground"
    : "rounded-2xl border border-border bg-card p-5 text-foreground shadow-sm";
  const hasLineItems = (lineItems?.length ?? 0) > 0;

  useEffect(() => {
    if (openSignal <= 0) return;
    setStartInAddMode(false);
    setModalOpen(true);
  }, [openSignal]);

  useEffect(() => {
    if (addSignal <= 0) return;
    setStartInAddMode(true);
    setModalOpen(true);
  }, [addSignal]);

  if (isLoading) {
    return (
      <div className={shellClassName}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Costs</p>
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Pending
          </span>
        </div>
        <div className="mt-2 flex items-start gap-3">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Loading costs</p>
            <div className="flex py-2">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className={`w-full text-left cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[hsl(var(--status-confirmed))] ${grouped ? "" : "hover:shadow-md hover:scale-[1.01]"} ${shellClassName}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2 items-center">
            <ChevronsDown className="w-3 h-3"/>
          <p className="text-xs uppercase text-muted-foreground tracking-wide">Costs</p>
          </div>
          <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {hasLineItems ? "View" : "Pending"}
          </span>
        </div>
        <div className={`mt-2 ${hasLineItems ? "mb-2" : ""} flex items-start gap-3`}>
          <div className="flex-1">
            {hasLineItems ? (
              <>
                <p className="text-xl font-semibold leading-tight text-foreground">
                  -${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {lineItems.length} line {lineItems.length === 1 ? "item" : "items"}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">No cost items yet</p>
                <p className="text-xs text-muted-foreground mt-2">
                  Costs will be copied from estimate when approved
                </p>
              </>
            )}
          </div>
        </div>
      </button>

      <JobCostsModal
        jobId={jobId}
        onEstimateApproved={onEstimateApproved}
        open={modalOpen}
        onOpenChange={(nextOpen) => {
          setModalOpen(nextOpen);
          if (!nextOpen) {
            setStartInAddMode(false);
          }
        }}
        startInAddMode={startInAddMode}
      />
    </>
  );
};
