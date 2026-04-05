import { useMemo, useState } from "react";
import { WandSparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpeechToTextTextarea } from "@/components/ui/speech-to-text-textarea";
import { cn } from "@/lib/utils";
import { callVoiceIntakeParser } from "@/lib/voiceIntake";
import type {
  VoiceEntityType,
  VoiceEstimateParsedData,
  VoiceFollowUpQuestion,
  VoiceJobParsedData,
  VoiceLeadParsedData,
} from "@/types/voiceIntake";

interface VoiceIntakePanelProps {
  entityType: VoiceEntityType;
  title: string;
  description: string;
  transcriptPlaceholder: string;
  variant?: "default" | "plain";
  onApply: (parsed: VoiceLeadParsedData | VoiceJobParsedData | VoiceEstimateParsedData) => void;
}

export function VoiceIntakePanel({
  entityType,
  title,
  description,
  transcriptPlaceholder,
  variant = "default",
  onApply,
}: VoiceIntakePanelProps) {
  const [transcript, setTranscript] = useState("");
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, string>>({});
  const [followUpQuestions, setFollowUpQuestions] = useState<VoiceFollowUpQuestion[]>([]);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [latestParsed, setLatestParsed] = useState<VoiceLeadParsedData | VoiceJobParsedData | VoiceEstimateParsedData | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  const hasAllRequiredAnswers = useMemo(
    () => followUpQuestions.every((question) => (followUpAnswers[question.field] || "").trim().length > 0),
    [followUpAnswers, followUpQuestions],
  );

  const parseTranscript = async (includeFollowUps: boolean) => {
    if (!transcript.trim()) {
      toast.error("Record or type your intake details first.");
      return;
    }

    setIsParsing(true);

    try {
      const response = await callVoiceIntakeParser(
        entityType,
        transcript,
        includeFollowUps ? followUpAnswers : undefined,
      );

      setLatestParsed(response.parsed);
      setMissingFields(response.missingFields);
      setFollowUpQuestions(response.followUpQuestions);

      if (response.missingFields.length > 0) {
        toast.info("I need a few follow-up details before applying this intake.");
        return;
      }

      onApply(response.parsed);
      toast.success("Voice intake applied.");
    } catch (error) {
      console.error("Voice intake parser error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to parse voice intake");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div
      className={cn(
        "space-y-3",
        variant === "default" && "rounded-lg border border-border bg-muted/20 p-3",
      )}
    >
      <div className="space-y-1">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <WandSparkles className="h-4 w-4 text-primary" />
          {title}
        </h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      <SpeechToTextTextarea
        value={transcript}
        onValueChange={setTranscript}
        placeholder={transcriptPlaceholder}
        rows={3}
      />

      {followUpQuestions.length > 0 && (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Follow-up Questions
          </p>
          {followUpQuestions.map((question) => (
            <div key={question.field} className="space-y-1.5">
              <Label htmlFor={`voice-followup-${question.field}`} className="text-xs">
                {question.label}
              </Label>
              <p className="text-xs text-muted-foreground">{question.question}</p>
              <Input
                id={`voice-followup-${question.field}`}
                value={followUpAnswers[question.field] || ""}
                onChange={(event) => {
                  const value = event.target.value;
                  setFollowUpAnswers((current) => ({
                    ...current,
                    [question.field]: value,
                  }));
                }}
                placeholder={`Enter ${question.label.toLowerCase()}`}
              />
            </div>
          ))}
        </div>
      )}

      {missingFields.length > 0 && (
        <p className="text-xs text-amber-700">
          Required before save: {missingFields.join(", ")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void parseTranscript(false)}
          disabled={isParsing}
        >
          {isParsing ? "Analyzing..." : "Parse Voice Intake"}
        </Button>

        {followUpQuestions.length > 0 && (
          <Button
            type="button"
            size="sm"
            onClick={() => void parseTranscript(true)}
            disabled={isParsing || !hasAllRequiredAnswers}
          >
            Apply Follow-ups
          </Button>
        )}

        {latestParsed && missingFields.length === 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onApply(latestParsed)}
          >
            Reapply Parsed Values
          </Button>
        )}
      </div>
    </div>
  );
}
