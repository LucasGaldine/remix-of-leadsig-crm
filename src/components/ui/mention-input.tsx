import { useState, useRef, useEffect, forwardRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AtSign, Mic, Square, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SpeechRecognitionResultLike = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionResultLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g;

function appendTranscript(existingValue: string, transcript: string) {
  const trimmedTranscript = transcript.trim();

  if (!trimmedTranscript) {
    return existingValue;
  }

  if (!existingValue.trim()) {
    return trimmedTranscript;
  }

  return `${existingValue.trimEnd()} ${trimmedTranscript}`;
}

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
  textareaClassName?: string;
}

export const MentionInput = forwardRef<HTMLTextAreaElement, MentionInputProps>(
  ({ value, onChange, placeholder, rows = 3, teamMembers, textareaClassName }, ref) => {
    const [showMentions, setShowMentions] = useState(false);
    const [mentionSearch, setMentionSearch] = useState("");
    const [cursorPosition, setCursorPosition] = useState(0);
    const [mentionStartPos, setMentionStartPos] = useState(0);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isListening, setIsListening] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const latestValueRef = useRef(value);

    latestValueRef.current = value;

    useEffect(() => {
      if (ref && typeof ref === 'function') {
        ref(textareaRef.current);
      } else if (ref) {
        (ref as any).current = textareaRef.current;
      }
    }, [ref]);

    useEffect(() => {
      return () => {
        recognitionRef.current?.stop();
      };
    }, []);

    const displayValue = value.replace(MENTION_REGEX, "@$1");
    const RecognitionConstructor =
      typeof window === "undefined" ? undefined : window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechSupported = Boolean(RecognitionConstructor);

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
      const oldDisplayValue = oldActualValue.replace(MENTION_REGEX, "@$1");

      if (newDisplayValue === oldDisplayValue) {
        return oldActualValue;
      }

      const mentions = Array.from(oldActualValue.matchAll(MENTION_REGEX));
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

    const stopListening = () => {
      recognitionRef.current?.stop();
      setIsListening(false);
    };

    const startListening = () => {
      if (!RecognitionConstructor) {
        return;
      }

      const recognition = new RecognitionConstructor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .flatMap((result) => Array.from(result))
          .map((result) => result.transcript)
          .join(" ")
          .trim();

        if (!transcript) {
          return;
        }

        onChange(appendTranscript(latestValueRef.current, transcript));
      };
      recognition.onend = () => {
        recognitionRef.current = null;
        setIsListening(false);
      };
      recognition.onerror = () => {
        recognitionRef.current = null;
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      recognition.start();
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
          className={cn("pr-12 pb-12", textareaClassName)}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!speechSupported}
          onClick={isListening ? stopListening : startListening}
          aria-label={isListening ? "Stop speech to text" : "Start speech to text"}
          title={speechSupported ? "Speech to text" : "Speech to text is not supported on this device"}
          className="absolute bottom-2 right-2 h-8 w-8 rounded-full border-border bg-background/95 shadow-sm"
        >
          {isListening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        </Button>
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
