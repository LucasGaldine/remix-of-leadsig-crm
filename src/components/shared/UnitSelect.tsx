import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate text-left">
            {selectedLabel || <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
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
              {normalizedOptions.map((option) => {
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
