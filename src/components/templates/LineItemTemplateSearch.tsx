import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface LineItemTemplateSearchItem {
  id: string;
  value: string;
  primary: string;
  secondary?: string;
  rightText?: string;
  onSelect: () => void;
}

interface LineItemTemplateSearchSection {
  heading: string;
  items: LineItemTemplateSearchItem[];
}

interface LineItemTemplateSearchProps {
  placeholder?: string;
  emptyText?: string;
  sections: LineItemTemplateSearchSection[];
  query?: string;
  onQueryChange?: (value: string) => void;
  hideListUntilQuery?: boolean;
}

export function LineItemTemplateSearch({
  placeholder = "Search item labels...",
  emptyText = "No matching labels",
  sections,
  query,
  onQueryChange,
  hideListUntilQuery = false,
}: LineItemTemplateSearchProps) {
  const shouldShowList = !hideListUntilQuery || Boolean(query?.trim());

  return (
    <Command shouldFilter>
      <CommandInput
        placeholder={placeholder}
        value={query}
        onValueChange={onQueryChange}
      />
      {shouldShowList ? (
        <CommandList>
          <CommandEmpty>{emptyText}</CommandEmpty>
          {sections.map((section) => (
            <CommandGroup key={section.heading} heading={section.heading}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.id}
                  value={item.value}
                  onSelect={item.onSelect}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate">{item.primary}</p>
                      {item.secondary ? (
                        <p className="truncate text-xs text-muted-foreground">{item.secondary}</p>
                      ) : null}
                    </div>
                    {item.rightText ? (
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{item.rightText}</span>
                    ) : null}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      ) : null}
    </Command>
  );
}
