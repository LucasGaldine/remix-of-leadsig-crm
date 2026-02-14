import { useState, useEffect, useRef } from "react";
import { Search, UserPlus, Check, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCustomers, type Customer, type CreateCustomerInput } from "@/hooks/useCustomers";
import { cn } from "@/lib/utils";

interface ClientSelectorProps {
  selectedCustomer: Customer | null;
  onSelect: (customer: Customer | null) => void;
  newClientData: CreateCustomerInput;
  onNewClientDataChange: (data: CreateCustomerInput) => void;
  mode: "existing" | "new";
  onModeChange: (mode: "existing" | "new") => void;
}

export function ClientSelector({
  selectedCustomer,
  onSelect,
  newClientData,
  onNewClientDataChange,
  mode,
  onModeChange,
}: ClientSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const { data: customers = [], isLoading } = useCustomers(searchQuery);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCustomer = (customer: Customer) => {
    onSelect(customer);
    setSearchQuery("");
    setShowResults(false);
    onModeChange("existing");
  };

  const handleSwitchToNew = () => {
    onSelect(null);
    setShowResults(false);
    onModeChange("new");
  };

  const handleSwitchToExisting = () => {
    onModeChange("existing");
    onNewClientDataChange({ name: "", email: "", phone: "", address: "", city: "" });
  };

  if (mode === "existing" && selectedCustomer) {
    return (
      <div className="space-y-3">
        <Label className="text-sm font-medium">Client</Label>
        <div className="flex items-center gap-3 p-3 rounded-lg border border-emerald-200 bg-emerald-50">
          <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm text-foreground truncate">{selectedCustomer.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {[selectedCustomer.phone, selectedCustomer.email, selectedCustomer.city]
                .filter(Boolean)
                .join(" -- ") || "No contact info"}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
            onClick={() => {
              onSelect(null);
              setSearchQuery("");
            }}
          >
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Client</Label>
        {mode === "new" ? (
          <button
            type="button"
            onClick={handleSwitchToExisting}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
          >
            Select existing client
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSwitchToNew}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-800 transition-colors flex items-center gap-1"
          >
            <UserPlus className="h-3 w-3" />
            New client
          </button>
        )}
      </div>

      {mode === "existing" ? (
        <div ref={containerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              placeholder="Search clients by name, email, or phone..."
              className="pl-9"
            />
          </div>

          {showResults && (
            <div className="absolute z-50 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-56 overflow-y-auto">
              {isLoading ? (
                <div className="p-3 text-center text-sm text-muted-foreground">Searching...</div>
              ) : customers.length > 0 ? (
                <>
                  {customers.map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => handleSelectCustomer(customer)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
                    >
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{customer.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[customer.phone, customer.email].filter(Boolean).join(" -- ") || "No contact info"}
                        </p>
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-border">
                    <button
                      type="button"
                      onClick={handleSwitchToNew}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-emerald-700 font-medium hover:bg-accent transition-colors"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create new client
                    </button>
                  </div>
                </>
              ) : (
                <div className="p-3">
                  <p className="text-sm text-muted-foreground text-center mb-2">
                    {searchQuery ? "No clients found" : "Type to search clients"}
                  </p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        onNewClientDataChange({ ...newClientData, name: searchQuery });
                        handleSwitchToNew();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 text-sm text-emerald-700 font-medium hover:bg-accent rounded transition-colors"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create "{searchQuery}" as new client
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <NewClientForm data={newClientData} onChange={onNewClientDataChange} />
      )}
    </div>
  );
}

function NewClientForm({
  data,
  onChange,
}: {
  data: CreateCustomerInput;
  onChange: (data: CreateCustomerInput) => void;
}) {
  return (
    <div className="space-y-3 p-3 rounded-lg border border-dashed border-border bg-muted/30">
      <div>
        <Label htmlFor="clientName" className="text-xs text-muted-foreground">
          Name *
        </Label>
        <Input
          id="clientName"
          value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })}
          placeholder="John Smith"
          className="mt-1"
          autoFocus
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="clientPhone" className="text-xs text-muted-foreground">
            Phone
          </Label>
          <Input
            id="clientPhone"
            type="tel"
            value={data.phone || ""}
            onChange={(e) => onChange({ ...data, phone: e.target.value })}
            placeholder="(555) 123-4567"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="clientEmail" className="text-xs text-muted-foreground">
            Email
          </Label>
          <Input
            id="clientEmail"
            type="email"
            value={data.email || ""}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
            placeholder="john@email.com"
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="clientAddress" className="text-xs text-muted-foreground">
            Address
          </Label>
          <Input
            id="clientAddress"
            value={data.address || ""}
            onChange={(e) => onChange({ ...data, address: e.target.value })}
            placeholder="123 Main St"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="clientCity" className="text-xs text-muted-foreground">
            City
          </Label>
          <Input
            id="clientCity"
            value={data.city || ""}
            onChange={(e) => onChange({ ...data, city: e.target.value })}
            placeholder="Austin"
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}
