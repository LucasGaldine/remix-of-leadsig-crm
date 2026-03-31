import * as React from "react";
import { Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea, type TextareaProps } from "@/components/ui/textarea";
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

interface SpeechToTextTextareaProps extends Omit<TextareaProps, "onChange" | "value"> {
  value: string;
  onValueChange: (value: string) => void;
}

export function SpeechToTextTextarea({
  value,
  onValueChange,
  className,
  disabled,
  ...props
}: SpeechToTextTextareaProps) {
  const [isListening, setIsListening] = React.useState(false);
  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const latestValueRef = React.useRef(value);

  latestValueRef.current = value;

  const RecognitionConstructor = React.useMemo(
    () => (typeof window === "undefined" ? undefined : window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );
  const speechSupported = Boolean(RecognitionConstructor);

  const stopListening = React.useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const startListening = React.useCallback(() => {
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

      onValueChange(appendTranscript(latestValueRef.current, transcript));
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
  }, [RecognitionConstructor, onValueChange]);

  React.useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return (
    <div className="relative">
      <Textarea
        {...props}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        className={cn("pr-12 pb-12", className)}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        disabled={disabled || !speechSupported}
        onClick={isListening ? stopListening : startListening}
        aria-label={isListening ? "Stop speech to text" : "Start speech to text"}
        title={speechSupported ? "Speech to text" : "Speech to text is not supported on this device"}
        className="absolute bottom-2 right-2 h-8 w-8 rounded-full border-border bg-background/95 shadow-sm"
      >
        {isListening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}
