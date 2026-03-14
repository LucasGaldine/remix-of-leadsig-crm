import { useState, useRef, useEffect, forwardRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  teamMembers: TeamMember[];
}

export const MentionInput = forwardRef<HTMLTextAreaElement, MentionInputProps>(
  ({ value, onChange, placeholder, rows = 3, teamMembers }, ref) => {
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [cursorPosition, setCursorPosition] = useState(0);
    const [mentionStartPos, setMentionStartPos] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (ref && typeof ref === 'function') {
        ref(textareaRef.current);
      } else if (ref) {
        (ref as any).current = textareaRef.current;
      }
    }, [ref]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      const cursor = e.target.selectionStart;

      onChange(newValue);
      setCursorPosition(cursor);

      const textBeforeCursor = newValue.substring(0, cursor);
      const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

      if (lastAtSymbol !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);

        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setMentionSearch(textAfterAt);
          setMentionStartPos(lastAtSymbol);
          setShowMentions(true);
        } else {
          setShowMentions(false);
        }
      } else {
        setShowMentions(false);
      }
    };

    const insertMention = (member: TeamMember) => {
      const beforeMention = value.substring(0, mentionStartPos);
      const afterCursor = value.substring(cursorPosition);

      const mentionText = `@[${member.full_name}](${member.user_id})`;
      const newValue = beforeMention + mentionText + afterCursor;

      onChange(newValue);
      setShowMentions(false);
      setMentionSearch("");

      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + mentionText.length;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    };

    const filteredMembers = teamMembers.filter(member =>
      member.full_name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      member.email.toLowerCase().includes(mentionSearch.toLowerCase())
    );

    const displayValue = value.replace(/@\[([^\]]+)\]\([a-f0-9-]+\)/g, '@$1');

    return (
      <Popover open={showMentions} onOpenChange={setShowMentions}>
        <PopoverTrigger asChild>
          <Textarea
            ref={textareaRef}
            value={displayValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            rows={rows}
            className="font-mono"
          />
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-64"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command>
            <CommandList>
              <CommandEmpty>No team members found.</CommandEmpty>
              <CommandGroup>
                {filteredMembers.map((member) => (
                  <CommandItem
                    key={member.user_id}
                    onSelect={() => insertMention(member)}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{member.full_name}</span>
                      <span className="text-xs text-muted-foreground">{member.email}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }
);

MentionInput.displayName = "MentionInput";
