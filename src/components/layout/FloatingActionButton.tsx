import { useEffect, useRef, useState } from "react";
import { Plus, Wrench, X, UserPlus, FileText, Briefcase, Package, DollarSign, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export interface FABAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  group?: string;
}

interface FloatingActionButtonProps {
  actions: FABAction[];
  className?: string;
  triggerIcon?: "plus" | "wrench";
}

export function FloatingActionButton({
  actions,
  className,
  triggerIcon = "plus",
}: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [actionsOffsetX, setActionsOffsetX] = useState(0);
  const [actionsOffsetY, setActionsOffsetY] = useState(0);
  const [actionsMaxHeight, setActionsMaxHeight] = useState<number | null>(null);
  const actionsStackRef = useRef<HTMLDivElement | null>(null);
  const fabButtonRef = useRef<HTMLButtonElement | null>(null);
  const positionClasses =
    "right-4 md:right-6 bottom-[calc(4.5rem+env(safe-area-inset-bottom)+2.5rem)] md:bottom-6";
  const groupedActions = actions.reduce<Array<{ id: string; actions: Array<FABAction & { key: string }> }>>(
    (groups, action, index) => {
      const groupId = action.group || "default";
      const existingGroup = groups.find((group) => group.id === groupId);
      const keyedAction = { ...action, key: `${groupId}-${action.label}-${index}` };

      if (existingGroup) {
        existingGroup.actions.push(keyedAction);
      } else {
        groups.push({ id: groupId, actions: [keyedAction] });
      }

      return groups;
    },
    [],
  );

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setActionsOffsetX(0);
      setActionsOffsetY(0);
      setActionsMaxHeight(null);
      return;
    }

    const measureAndPosition = () => {
      const menuEl = actionsStackRef.current;
      if (!menuEl) return;

      const edgePadding = 8;
      const fabWidth = 64;
      const fabGap = 8;
      const rect = menuEl.getBoundingClientRect();
      const fabRect = fabButtonRef.current?.getBoundingClientRect() ?? null;
      const viewport = window.visualViewport;
      const viewportLeft = (viewport?.offsetLeft ?? 0) + edgePadding;
      const viewportTop = (viewport?.offsetTop ?? 0) + edgePadding;
      const viewportRight =
        (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - edgePadding;
      const viewportBottom =
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - edgePadding;

      let nextX = actionsOffsetX;
      let nextY = actionsOffsetY;
      let nextMaxHeight: number | null = null;

      const overflowRight = rect.right - viewportRight;
      if (overflowRight > 0) {
        nextX -= overflowRight;
        // If it overflows right, move at least to the left of the FAB "X" button.
        nextX = Math.min(nextX, -(fabWidth + fabGap));
      }

      const overflowLeft = viewportLeft - rect.left;
      if (overflowLeft > 0) {
        nextX += overflowLeft;
      }

      const overflowTop = viewportTop - rect.top;
      if (overflowTop > 0) {
        nextY += overflowTop;
      }

      const overflowBottom = rect.bottom - viewportBottom;
      if (overflowBottom > 0) {
        nextY -= overflowBottom;
      }

      // Keep a clear non-overlapping zone above the FAB close button.
      if (fabRect) {
        const minGapFromFab = 12;
        const projectedBottom = rect.bottom + (nextY - actionsOffsetY);
        const maxMenuBottom = fabRect.top - minGapFromFab;
        if (projectedBottom > maxMenuBottom) {
          nextY -= projectedBottom - maxMenuBottom;
        }
      }

      const availableHeight = Math.max(120, Math.floor(viewportBottom - viewportTop));
      if (rect.height > availableHeight) {
        nextMaxHeight = availableHeight;
      }

      if (nextX !== actionsOffsetX) {
        setActionsOffsetX(nextX);
      }
      if (nextY !== actionsOffsetY) {
        setActionsOffsetY(nextY);
      }
      if (nextMaxHeight !== actionsMaxHeight) {
        setActionsMaxHeight(nextMaxHeight);
      }
    };

    const raf = window.requestAnimationFrame(measureAndPosition);
    const timeoutShort = window.setTimeout(measureAndPosition, 60);
    const timeoutLong = window.setTimeout(measureAndPosition, 220);
    window.addEventListener("resize", measureAndPosition);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            measureAndPosition();
          })
        : null;
    if (resizeObserver && actionsStackRef.current) {
      resizeObserver.observe(actionsStackRef.current);
    }

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(timeoutShort);
      window.clearTimeout(timeoutLong);
      window.removeEventListener("resize", measureAndPosition);
      resizeObserver?.disconnect();
    };
  }, [isOpen, groupedActions.length, actionsOffsetX, actionsOffsetY, actionsMaxHeight]);

  if (actions.length === 0) return null;

  // Single action - just show the primary button
  if (actions.length === 1) {
    const action = actions[0];
    return (
      <button
        onClick={action.onClick}
        className={cn(
          "fixed z-[40] h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-lg",
          positionClasses,
          "flex items-center justify-center",
          "hover:bg-primary/90 active:scale-95 transition-all",
          className
        )}
        aria-label={action.label}
      >
        {action.icon}
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-[35] bg-background/80 backdrop-blur-sm transition-opacity duration-200",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsOpen(false)}
        aria-hidden={!isOpen}
      />

      {/* Action buttons */}
      <div
        className={cn(
          "fixed z-[40] flex flex-col items-end pointer-events-none",
          positionClasses,
          className
        )}
      >
        <div
          ref={actionsStackRef}
          className={cn(
            "flex flex-col gap-16 md:gap-16",
            actionsMaxHeight ? "overflow-y-auto pr-1" : "overflow-visible",
          )}
          style={{
            transform:
              actionsOffsetX !== 0 || actionsOffsetY !== 0
                ? `translate(${actionsOffsetX}px, ${actionsOffsetY}px)`
                : undefined,
            maxHeight: actionsMaxHeight ?? undefined,
          }}
        >
          {groupedActions.map((group, groupIndex) => (
            <div
              key={group.id}
              aria-hidden={!isOpen}
              className={cn(
                "flex flex-col gap-2",
                "w-[60vw] max-w-[22rem] min-w-[11rem] md:w-auto",
                "transition-[opacity,transform] duration-200 ease-out will-change-transform",
                isOpen
                  ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                  : "opacity-0 translate-y-2 scale-95 pointer-events-none",
              )}
              style={{
                transitionDelay: isOpen ? `${groupIndex * 55}ms` : "0ms",
              }}
            >
              {group.actions.map((action) => (
                <Button
                  key={action.key}
                  onClick={() => {
                    if (action.disabled) return;
                    action.onClick();
                    setIsOpen(false);
                  }}
                  disabled={action.disabled}
                  variant="secondary"
                  size="lg"
                  tabIndex={isOpen ? 0 : -1}
                  className="w-full justify-start gap-3"
                >
                  {action.icon}
                  <span>{action.label}</span>
                </Button>
              ))}
            </div>
          ))}
        </div>

        {/* Main FAB button */}
        <button
          ref={fabButtonRef}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "mt-3 md:mt-0",
            "h-16 w-16 rounded-full bg-primary text-primary-foreground shadow-lg pointer-events-auto",
            "flex items-center justify-center",
            "hover:bg-primary/90 active:scale-95 transition-[transform,background-color] duration-300 ease-out"
          )}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
        >
          <span className="relative h-7 w-7">
            {triggerIcon === "wrench" ? (
              <Wrench
                className={cn(
                  "absolute inset-0 h-7 w-7 transition-all duration-200 ease-out",
                  isOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
                )}
              />
            ) : (
              <Plus
                className={cn(
                  "absolute inset-0 h-7 w-7 transition-all duration-200 ease-out",
                  isOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
                )}
              />
            )}
            <X
              className={cn(
                "absolute inset-0 h-7 w-7 transition-all duration-200 ease-out",
                isOpen ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-75"
              )}
            />
          </span>
        </button>
      </div>
    </>
  );
}

// Pre-configured FAB for different pages
export function useContextualFAB() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const getActions = (handlers: {
    onAddLead?: () => void;
    onAddJob?: () => void;
    onAddEstimate?: () => void;
    onAddInvoice?: () => void;
    onAddMaterialList?: () => void;
    onAddSupplyOrder?: () => void;
  }): FABAction[] => {
    // Leads page
    if (path === "/leads") {
      return [
        {
          icon: <UserPlus className="h-5 w-5" />,
          label: "Add Lead",
          onClick: handlers.onAddLead || (() => {}),
          primary: true,
        },
      ];
    }

    // Jobs page
    if (path === "/jobs") {
      return [
        {
          icon: <Briefcase className="h-5 w-5" />,
          label: "Create Job",
          onClick: handlers.onAddJob || (() => {}),
          primary: true,
        },
      ];
    }

    // Payments page
    if (path === "/payments") {
      return [
        {
          icon: <FileText className="h-5 w-5" />,
          label: "New Estimate",
          onClick: handlers.onAddEstimate || (() => navigate("/payments/estimates/new")),
        },
        {
          icon: <DollarSign className="h-5 w-5" />,
          label: "New Invoice",
          onClick: handlers.onAddInvoice || (() => navigate("/payments/invoices/new")),
          primary: true,
        },
      ];
    }

    // Materials page
    if (path === "/materials") {
      return [
        {
          icon: <Package className="h-5 w-5" />,
          label: "New Material List",
          onClick: handlers.onAddMaterialList || (() => navigate("/materials/lists/new")),
        },
        {
          icon: <Truck className="h-5 w-5" />,
          label: "New Supply Order",
          onClick: handlers.onAddSupplyOrder || (() => navigate("/materials/orders/new")),
          primary: true,
        },
      ];
    }

    return [];
  };

  return { getActions };
}
