import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  const touchStartYRef = useRef<number | null>(null);
  const isTouchDraggingRef = useRef(false);

  const selectedLabel = useMemo(
    () => options.find((option) => option === value) || "",
    [options, value],
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
          <CommandInput placeholder="Search service types..." />
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
              {options.map((option) => {
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
