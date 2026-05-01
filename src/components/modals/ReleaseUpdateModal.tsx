import { Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getReleaseUpdateActionLabel, type ReleaseUpdate } from "@/lib/releaseUpdates";

interface ReleaseUpdateModalProps {
  open: boolean;
  update: ReleaseUpdate | null;
  onLater: () => void;
  onMarkAsRead: () => void;
}

export function ReleaseUpdateModal({ open, update, onLater, onMarkAsRead }: ReleaseUpdateModalProps) {
  if (!update) return null;

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onLater()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="items-start text-left sm:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5" />
            Product Update
          </div>
          <DialogTitle className="mt-2 text-xl">{update.title}</DialogTitle>
          <DialogDescription className="space-y-3 text-left">
            <p>
              Version {update.version} • Released {update.released_at}
            </p>
            <p className="text-foreground">{update.description}</p>
            <ul className="space-y-2 pt-1">
              {update.highlights.map((highlight) => (
                <li key={highlight} className="flex items-start gap-2 text-foreground">
                  <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          <Button size="lg" variant="outline" className="w-full" onClick={onLater}>
            Later
          </Button>
          {update.cta_href ? (
            <Button size="lg" className="w-full" asChild>
              <a href={update.cta_href} onClick={onMarkAsRead}>
                {getReleaseUpdateActionLabel(update)}
              </a>
            </Button>
          ) : (
            <Button size="lg" className="w-full" onClick={onMarkAsRead}>
              {getReleaseUpdateActionLabel(update)}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
