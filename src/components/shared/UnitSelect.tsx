import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type UnitOption = {
  value: string;
  label: string;
};

interface UnitSelectProps {
  id?: string;
  value: string;
  options: UnitOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

export function UnitSelect({
  id,
  value,
  options,
  onValueChange,
  placeholder = "Select unit",
  searchPlaceholder = "Search units...",
  emptyText = "No units found.",
  className,
  disabled = false,
}: UnitSelectProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const touchStartYRef = useRef<number | null>(null);
  const isTouchDraggingRef = useRef(false);

  const normalizedOptions = useMemo(() => {
    const seen = new Set<string>();
    const withCurrent = options.some((option) => option.value === value)
      ? options
      : value
        ? [...options, { value, label: value }]
        : options;

    return withCurrent.filter((option) => {
      if (seen.has(option.value)) return false;
      seen.add(option.value);
      return true;
    });
  }, [options, value]);

  const selectedLabel = useMemo(
    () => normalizedOptions.find((option) => option.value === value)?.label ?? "",
    [normalizedOptions, value],
  );
  const filteredOptions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return normalizedOptions;
    return normalizedOptions.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(query));
  }, [normalizedOptions, searchQuery]);

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
            disabled={disabled}
            value={open ? searchQuery : selectedLabel}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              if (!open) setOpen(true);
            }}
            placeholder={open ? searchPlaceholder : placeholder}
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
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filteredOptions.map((option) => {
                const isSelected = value === option.value;
                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => {
                      if (isTouchDraggingRef.current) return;
                      onValueChange(option.value);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    {option.label}
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
