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
import type { Blocker } from "react-router-dom";

interface UnsavedChangesDialogProps {
  blocker: Blocker;
}

export function UnsavedChangesDialog({ blocker }: UnsavedChangesDialogProps) {
  if (blocker.state !== "blocked") return null;

  return (
    <AlertDialog open onOpenChange={() => blocker.reset?.()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved changes that will be lost if you leave this page.
            Are you sure you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => blocker.reset?.()}>
            Stay on Page
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => blocker.proceed?.()}>
            Leave Without Saving
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
