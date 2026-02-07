import { useBlocker } from "react-router-dom";

export function useUnsavedChanges(isDirty: boolean) {
  return useBlocker(
    ({ currentLocation, nextLocation }) =>
      isDirty && currentLocation.pathname !== nextLocation.pathname
  );
}
