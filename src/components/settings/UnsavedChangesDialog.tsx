import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Blocker } from "react-router-dom";

interface UnsavedChangesDialogProps {
  blocker: Blocker;
  onSaveAndLeave?: () => Promise<boolean | void> | boolean | void;
}

export function UnsavedChangesDialog({ blocker, onSaveAndLeave }: UnsavedChangesDialogProps) {
  const [isSavingAndLeaving, setIsSavingAndLeaving] = useState(false);

  useEffect(() => {
    if (blocker.state !== "blocked") {
      setIsSavingAndLeaving(false);
    }
  }, [blocker.state]);

  if (blocker.state !== "blocked") return null;

  const handleSaveAndLeave = async () => {
    if (!onSaveAndLeave || isSavingAndLeaving) return;
    setIsSavingAndLeaving(true);
    try {
      const result = await onSaveAndLeave();
      if (result === false) return;
      blocker.proceed?.();
    } finally {
      setIsSavingAndLeaving(false);
    }
  };

  return (
    <AlertDialog open onOpenChange={() => !isSavingAndLeaving && blocker.reset?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes that will be lost if you leave this page.
            Are you sure you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()} disabled={isSavingAndLeaving}>
            Go Back to Page
          </AlertDialogCancel>
          <Button variant="outline" onClick={() => blocker.proceed?.()} disabled={isSavingAndLeaving}>
            Leave Without Saving
          </Button>
          <AlertDialogAction onClick={handleSaveAndLeave} disabled={!onSaveAndLeave || isSavingAndLeaving}>
            {isSavingAndLeaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save and Leave"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
