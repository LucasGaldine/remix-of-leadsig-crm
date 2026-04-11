import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { MainPageQuickActions } from "@/components/layout/MainPageQuickActions";
import { CustomerCard } from "@/components/customers/CustomerCard";
import { useCustomers } from "@/hooks/useCustomers";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Users, User, ArrowUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { sortCustomerItems, type CustomerSortOption } from "@/lib/pageSorting";

export default function Customers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<CustomerSortOption>("name_asc");
  const { data: customers = [], isLoading } = useCustomers(search);
  const sortedCustomers = useMemo(() => sortCustomerItems(customers, sortBy), [customers, sortBy]);
  const sortOptions: Array<{ value: CustomerSortOption; label: string }> = [
    { value: "name_asc", label: "Name A-Z" },
    { value: "name_desc", label: "Name Z-A" },
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
  ];

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Clients" showBack backTo="/" />

      <div className="max-w-[var(--content-max-width)] m-auto p-4">
        <section className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Sort clients">
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {sortOptions.map((option) => (
                    <DropdownMenuItem key={option.value} onSelect={() => setSortBy(option.value)}>
                      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center">
                        {sortBy === option.value ? <Check className="h-4 w-4" /> : null}
                      </span>
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="px-4 pt-5 pb-3 border-t border-border">
            <div className="inline-flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Clients</p>
            </div>
          </div>

          {isLoading ? (
            <div className="px-4 pb-6">
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            </div>
          ) : sortedCustomers.length === 0 ? (
            <div className="px-4 pb-6">
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                {search ? "No customers match your search" : "No customers yet"}
              </div>
            </div>
          ) : (
            <div>
              {sortedCustomers.map((c, index) => (
                <CustomerCard
                  key={c.id}
                  customer={c}
                  onClick={() => navigate(`/customers/${c.id}`)}
                  className={cn(
                    "rounded-none border-0 bg-transparent px-4 py-3 shadow-none hover:bg-accent/40",
                    index > 0 && "relative before:absolute before:left-4 before:right-4 before:top-0 before:h-px before:bg-border",
                  )}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <MainPageQuickActions />

      <MobileNav />
    </div>
  );
}
