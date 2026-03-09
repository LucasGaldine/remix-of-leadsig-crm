import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { MobileNav } from "@/components/layout/MobileNav";
import { CustomerCard } from "@/components/customers/CustomerCard";
import { useCustomers } from "@/hooks/useCustomers";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Users } from "lucide-react";

export default function Customers() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const { data: customers = [], isLoading } = useCustomers(search);

  return (
    <div className="min-h-screen bg-surface-sunken pb-24">
      <PageHeader title="Customers" onBack={() => navigate("/")} />

      <main className="px-4 py-4 space-y-4 max-w-[var(--content-max-width)] m-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : customers.length === 0 ? (
          <div className="card-elevated rounded-lg p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">
              {search ? "No customers match your search" : "No customers yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {customers.map((c) => (
              <CustomerCard
                key={c.id}
                customer={c}
                onClick={() => navigate(`/customers/${c.id}`)}
              />
            ))}
          </div>
        )}
      </main>

      <MobileNav />
    </div>
  );
}
