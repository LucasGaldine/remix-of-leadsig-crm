import { useState } from "react";
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

  if (actions.length === 0) return null;

  // Single action - just show the primary button
  if (actions.length === 1) {
    const action = actions[0];
    return (
      <button
        onClick={action.onClick}
        className={cn(
          "fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg",
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
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action buttons */}
      <div className={cn(
        "fixed bottom-20 right-4 z-50 flex flex-col-reverse items-end gap-3",
        className
      )}>
        {isOpen && actions.map((action, index) => (
          <button
            key={index}
            onClick={() => {
              action.onClick();
              setIsOpen(false);
            }}
            className={cn(
              "flex items-center gap-3 pl-4 pr-3 py-3 rounded-full shadow-lg",
              "animate-in fade-in slide-in-from-bottom-2 duration-200",
              action.primary 
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground border border-border"
            )}
            style={{ animationDelay: `${index * 50}ms` }}
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
            "hover:bg-primary/90 active:scale-95 transition-all",
            isOpen && "rotate-45"
          )}
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
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
