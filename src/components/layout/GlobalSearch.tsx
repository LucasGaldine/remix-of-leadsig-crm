import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Chrome as Home, Users, User, Hammer, DollarSign, Settings, Calendar, LayoutDashboard, Search, Crown, BookOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { filterSearchPages } from "@/lib/globalSearch";
import type { SearchPage } from "@/lib/globalSearch";

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const { role } = useAuth();

  const filteredPages = useMemo(() => {
    return filterSearchPages(query, role);
  }, [query, role]);

  const renderIcon = (page: SearchPage) => {
    if (page.path === "/customers") {
      return <User className="h-4 w-4" />;
    }

    switch (page.icon) {
      case "home":
        return <Home className="h-4 w-4" />;
      case "users":
        return <Users className="h-4 w-4" />;
      case "user":
        return <User className="h-4 w-4" />;
      case "briefcase":
        return <Hammer className="h-4 w-4" />;
      case "dollar-sign":
        return <DollarSign className="h-4 w-4" />;
      case "calendar":
        return <Calendar className="h-4 w-4" />;
      case "layout-dashboard":
        return <LayoutDashboard className="h-4 w-4" />;
      case "crown":
        return <Crown className="h-4 w-4" />;
      case "book-open":
        return <BookOpen className="h-4 w-4" />;
      case "settings":
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const handleSelect = (path: string) => {
    navigate(
      path === "/tutorial" ||
      path === "/onboarding/source" ||
      path === "/onboarding/profile" ||
      path === "/onboarding/import" ||
      path === "/onboarding/plan"
        ? `${path}?source=search`
        : path,
    );
    onOpenChange(false);
    setQuery("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Search Pages</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Type to search..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {filteredPages.length > 0 ? (
            <div className="py-2">
              {filteredPages.map((page) => (
                <button
                  key={page.path}
                  onClick={() => handleSelect(page.path)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors text-left"
                >
                  <div className="mt-0.5 p-2 rounded-lg bg-secondary text-secondary-foreground">
                    {renderIcon(page)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{page.name}</p>
                    {page.description && (
                      <p className="text-sm text-muted-foreground">{page.description}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">No pages found</p>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <p className="text-sm">Start typing to search...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
