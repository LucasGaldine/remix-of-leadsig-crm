import { useState, useRef, useEffect, forwardRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AtSign, User } from "lucide-react";

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

    const getInitials = (name: string) => {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    };

    return (
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          rows={rows}
        />
        {showMentions && (
          <div className="absolute z-50 mt-1 w-80 rounded-lg border bg-popover shadow-lg">
            <div className="p-3 border-b bg-muted/50">
              <div className="flex items-center gap-2 text-sm font-medium">
                <AtSign className="h-4 w-4 text-muted-foreground" />
                <span>Mention someone</span>
              </div>
              {mentionSearch && (
                <p className="text-xs text-muted-foreground mt-1">
                  Searching for "{mentionSearch}"
                </p>
              )}
            </div>
            <Command className="border-0">
              <CommandList className="max-h-64">
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No team members found</p>
                </CommandEmpty>
                <CommandGroup>
                  {filteredMembers.map((member) => (
                    <CommandItem
                      key={member.user_id}
                      onSelect={() => insertMention(member)}
                      className="cursor-pointer py-3 px-3 hover:bg-accent"
                    >
                      <div className="flex items-center gap-3 w-full">
                        <Avatar className="h-10 w-10 border-2 border-background">
                          <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                        </div>
                        <AtSign className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </div>
    );
  }
);

MentionInput.displayName = "MentionInput";
