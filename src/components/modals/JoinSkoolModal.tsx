import { BookOpen, ClipboardList, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface JoinSkoolModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  joinUrl?: string | null;
}

export function JoinSkoolModal({
  open,
  onOpenChange,
  joinUrl = null,
}: JoinSkoolModalProps) {
  const resolvedJoinUrl = joinUrl ?? "https://www.skool.com/elo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader className="items-start text-left sm:text-left">
          <div className="flex items-center gap-3">
            <img
              src="/skool-icon.png"
              alt="Skool logo"
              className="h-9 w-9 rounded-xl"
            />
            <DialogTitle>Join the Skool Community</DialogTitle>
          </div>
          <DialogDescription className="space-y-4 text-left">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">FREE</span>
              <span className="text-base text-foreground">Included with your LeadSig account.</span>
            </div>
            <ul className="space-y-3 py-3">
              <li className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-base font-medium text-foreground">Step-by-step training</span>
              </li>
              <li className="flex items-center gap-3">
                <ClipboardList className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-base font-medium text-foreground">Implementation playbooks</span>
              </li>
              <li className="flex items-center gap-3">
                <Users className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-base font-medium text-foreground">Direct support from other contractors</span>
              </li>
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid w-full grid-cols-2 gap-3">
          <Button size="lg" className="w-full" variant="outline" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button size="lg" className="w-full" asChild>
            <a href={resolvedJoinUrl} target="_blank" rel="noreferrer">
              Join now
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
