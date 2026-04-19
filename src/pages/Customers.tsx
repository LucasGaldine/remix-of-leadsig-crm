import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { MainPageQuickActions } from "@/components/layout/MainPageQuickActions";
import { CustomerCard } from "@/components/customers/CustomerCard";
import { useCustomers } from "@/hooks/useCustomers";
import { Input } from "@/components/ui/input";
import { Search, Users, User, ArrowUpDown, Check } from "lucide-react";
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
  const totalCustomers = customers.length;
  const sortOptions: Array<{ value: CustomerSortOption; label: string }> = [
    { value: "name_asc", label: "Name A-Z" },
    { value: "name_desc", label: "Name Z-A" },
    { value: "newest", label: "Newest first" },
    { value: "oldest", label: "Oldest first" },
  ];

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader
        title="Clients"
        subtitle={`${totalCustomers} total`}
        hideTitle
      />

      <div className="max-w-[var(--content-max-width)] m-auto p-4">
        <section className="-mx-4 md:mx-0">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-stretch gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-14 rounded-full border-border bg-card px-5 pl-14 text-base text-foreground shadow-sm placeholder:text-muted-foreground"
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Sort clients"
                    className="h-14 w-14 shrink-0 rounded-full border-border bg-card shadow-sm hover:bg-card"
                  >
                    <ArrowUpDown className="!h-5 !w-5 !text-muted-foreground" />
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

          <div className="hidden px-4 pt-5 pb-3 md:block">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Clients</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden md:rounded-2xl md:border md:border-border md:bg-card md:shadow-sm">
            {isLoading ? (
              <div className="px-4 pb-6">
                <div className="flex items-center justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
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
                      index > 0 && "md:relative md:before:absolute md:before:left-4 md:before:right-4 md:before:top-0 md:before:h-px md:before:bg-border",
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </div>

      <MainPageQuickActions />

      <MobileNav />
    </div>
  );
}
