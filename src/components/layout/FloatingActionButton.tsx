import { useEffect, useState } from "react";
import { Plus, X, UserPlus, FileText, Briefcase, Package, DollarSign, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocation, useNavigate } from "react-router-dom";

export interface FABAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
}

interface FloatingActionButtonProps {
  actions: FABAction[];
  className?: string;
}

export function FloatingActionButton({ actions, className }: FloatingActionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const positionClasses =
    "right-4 md:right-6 bottom-[calc(5.5rem+env(safe-area-inset-bottom)+0.75rem)] md:bottom-6";

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

  if (actions.length === 0) return null;

  // Single action - just show the primary button
  if (actions.length === 1) {
    const action = actions[0];
    return (
      <button
        onClick={action.onClick}
        className={cn(
          "fixed z-[40] h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg",
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
          "fixed z-[40] flex flex-col items-end gap-3",
          positionClasses,
          className
        )}
      >
        {actions.map((action, index) => (
          <button
            key={action.label}
            onClick={() => {
              action.onClick();
              setIsOpen(false);
            }}
            aria-hidden={!isOpen}
            tabIndex={isOpen ? 0 : -1}
            className={cn(
              "flex items-center gap-3 pl-4 pr-3 py-3 rounded-full shadow-lg",
              "transition-[opacity,transform] duration-200 ease-out will-change-transform",
              isOpen
                ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
                : "opacity-0 translate-y-2 scale-95 pointer-events-none",
              action.primary 
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground border border-border"
            )}
            style={{
              transitionDelay: isOpen ? `${index * 40}ms` : "0ms",
            }}
          >
            <span className="text-sm font-medium whitespace-nowrap">{action.label}</span>
            <div className="h-10 w-10 rounded-full bg-secondary/20 flex items-center justify-center">
              {action.icon}
            </div>
          </button>
        ))}

        {/* Main FAB button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg",
            "flex items-center justify-center",
            "hover:bg-primary/90 active:scale-95 transition-[transform,background-color] duration-300 ease-out"
          )}
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
        >
          <span className="relative h-6 w-6">
            <Plus
              className={cn(
                "absolute inset-0 h-6 w-6 transition-all duration-200 ease-out",
                isOpen ? "opacity-0 rotate-90 scale-75" : "opacity-100 rotate-0 scale-100"
              )}
            />
            <X
              className={cn(
                "absolute inset-0 h-6 w-6 transition-all duration-200 ease-out",
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
