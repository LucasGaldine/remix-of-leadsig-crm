import { useState, useRef, useEffect, forwardRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
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
    const [selectedIndex, setSelectedIndex] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (ref && typeof ref === 'function') {
        ref(textareaRef.current);
      } else if (ref) {
        (ref as any).current = textareaRef.current;
      }
    }, [ref]);

    const displayValue = value.replace(/@\[([^\]]+)\]\([a-f0-9-]+\)/g, '@$1');

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newDisplayValue = e.target.value;
      const cursor = e.target.selectionStart;

      const newActualValue = syncActualValue(newDisplayValue, value);
      onChange(newActualValue);
      setCursorPosition(cursor);

      const textBeforeCursor = newDisplayValue.substring(0, cursor);
      const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

      if (lastAtSymbol !== -1) {
        const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);

        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setMentionSearch(textAfterAt);
          setMentionStartPos(lastAtSymbol);
          setShowMentions(true);
          setSelectedIndex(0);
        } else {
          setShowMentions(false);
        }
      } else {
        setShowMentions(false);
      }
    };

    const syncActualValue = (newDisplayValue: string, oldActualValue: string): string => {
      let result = newDisplayValue;
      const oldDisplayValue = oldActualValue.replace(/@\[([^\]]+)\]\([a-f0-9-]+\)/g, '@$1');

      if (newDisplayValue === oldDisplayValue) {
        return oldActualValue;
      }

      const mentions = Array.from(oldActualValue.matchAll(/@\[([^\]]+)\]\(([a-f0-9-]+)\)/g));
      mentions.reverse().forEach((match) => {
        const displayName = `@${match[1]}`;
        const fullMention = match[0];
        const displayIndex = oldDisplayValue.indexOf(displayName);
        if (displayIndex !== -1 && newDisplayValue.substring(displayIndex, displayIndex + displayName.length) === displayName) {
          result = result.substring(0, displayIndex) + fullMention + result.substring(displayIndex + displayName.length);
        }
      });

      return result;
    };

    const insertMention = (member: TeamMember) => {
      const beforeMention = value.substring(0, mentionStartPos);
      const afterCursor = value.substring(cursorPosition);

      const mentionText = `@[${member.full_name}](${member.user_id})`;
      const newValue = beforeMention + mentionText + ' ' + afterCursor;

      onChange(newValue);
      setShowMentions(false);
      setMentionSearch("");

      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = beforeMention.length + mentionText.length + 1;
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    };

    const filteredMembers = teamMembers.filter(member =>
      member.full_name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      member.email.toLowerCase().includes(mentionSearch.toLowerCase())
    );

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showMentions || filteredMembers.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredMembers.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredMembers.length) % filteredMembers.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowMentions(false);
      }
    };

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
          onKeyDown={handleKeyDown}
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
                  {filteredMembers.map((member, index) => (
                    <CommandItem
                      key={member.user_id}
                      onSelect={() => insertMention(member)}
                      className={`cursor-pointer py-3 px-3 hover:bg-accent ${index === selectedIndex ? 'bg-accent' : ''}`}
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
