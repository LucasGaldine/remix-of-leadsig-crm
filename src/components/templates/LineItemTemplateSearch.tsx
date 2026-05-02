import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { ReactNode } from "react";

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
  headingRight?: ReactNode;
  items: LineItemTemplateSearchItem[];
  emptyContent?: ReactNode;
  emptyAction?: {
    id: string;
    value: string;
    content: ReactNode;
    onSelect: () => void;
  };
}

interface LineItemTemplateSearchProps {
  placeholder?: string;
  emptyText?: string;
  sections: LineItemTemplateSearchSection[];
  query?: string;
  onQueryChange?: (value: string) => void;
  hideListUntilQuery?: boolean;
  listClassName?: string;
}

export function LineItemTemplateSearch({
  placeholder = "Search item labels...",
  emptyText = "No matching labels",
  sections,
  query,
  onQueryChange,
  hideListUntilQuery = false,
  listClassName,
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
        <CommandList className={listClassName}>
          <CommandEmpty>{emptyText}</CommandEmpty>
          {sections.map((section) => (
            <CommandGroup
              key={section.heading}
              heading={(
                <div className="flex w-full items-center justify-between gap-2">
                  <span>{section.heading}</span>
                  {section.headingRight ? (
                    <span
                      className="pointer-events-auto"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {section.headingRight}
                    </span>
                  ) : null}
                </div>
              )}
            >
              {section.items.length > 0 ? (
                section.items.map((item) => (
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
                ))
              ) : section.emptyContent ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  {section.emptyContent}
                </div>
              ) : section.emptyAction ? (
                <CommandItem
                  key={section.emptyAction.id}
                  value={section.emptyAction.value}
                  onSelect={section.emptyAction.onSelect}
                >
                  <div className="w-full text-xs text-muted-foreground">
                    {section.emptyAction.content}
                  </div>
                </CommandItem>
              ) : null}
            </CommandGroup>
          ))}
        </CommandList>
      ) : null}
    </Command>
  );
}
