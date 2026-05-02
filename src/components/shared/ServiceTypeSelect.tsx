import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ServiceTypeSelectProps {
  id?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function ServiceTypeSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder = "Select service type",
  className,
}: ServiceTypeSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const touchStartYRef = useRef<number | null>(null);
  const isTouchDraggingRef = useRef(false);

  const selectedLabel = useMemo(
    () => options.find((option) => option === value) || "",
    [options, value],
  );
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return options;
    return options.filter((option) => option.toLowerCase().includes(query));
  }, [options, searchQuery]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setSearchQuery("");
        }
      }}
      modal
    >
      <PopoverTrigger asChild>
        <div className={cn("relative w-full", className)}>
          <Input
            id={id}
            role="combobox"
            aria-expanded={open}
            value={open ? searchQuery : selectedLabel}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              if (!open) setOpen(true);
            }}
            placeholder={open ? "Search service types..." : placeholder}
            className="pr-10"
          />
          <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList
            className="max-h-[9.5rem] overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch] md:max-h-[300px]"
            onTouchStart={(event) => {
              touchStartYRef.current = event.touches[0]?.clientY ?? null;
              isTouchDraggingRef.current = false;
            }}
            onTouchMove={(event) => {
              const startY = touchStartYRef.current;
              const currentY = event.touches[0]?.clientY;
              if (startY == null || currentY == null) return;
              if (Math.abs(currentY - startY) > 8) {
                isTouchDraggingRef.current = true;
              }
            }}
            onTouchEnd={() => {
              touchStartYRef.current = null;
              requestAnimationFrame(() => {
                isTouchDraggingRef.current = false;
              });
            }}
          >
            <CommandEmpty>No service types found.</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => {
                const isSelected = value === option;
                return (
                  <CommandItem
                    key={option}
                    value={option}
                    onSelect={() => {
                      if (isTouchDraggingRef.current) return;
                      onValueChange(option);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    {option}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
