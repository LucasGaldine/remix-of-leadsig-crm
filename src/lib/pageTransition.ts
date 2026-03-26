const MAIN_PAGE_PATHS = new Set([
  "/",
  "/leads",
  "/jobs",
  "/schedule",
  "/payments",
  "/settings",
  "/crew",
]);

function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isMainPagePath(pathname: string): boolean {
  return MAIN_PAGE_PATHS.has(normalizePath(pathname));
}

export function shouldAnimateMainPageTransition(
  currentPath: string,
  previousPath: string | null,
): boolean {
  if (!previousPath) {
    return false;
  }

  const normalizedCurrent = normalizePath(currentPath);
  const normalizedPrevious = normalizePath(previousPath);

  if (normalizedCurrent === normalizedPrevious) {
    return false;
  }

  return isMainPagePath(normalizedCurrent) && isMainPagePath(normalizedPrevious);
}
