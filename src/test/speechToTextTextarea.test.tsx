import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SpeechToTextTextarea } from "@/components/ui/speech-to-text-textarea";

const { startMock, stopMock } = vi.hoisted(() => ({
  startMock: vi.fn(),
  stopMock: vi.fn(),
}));

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "en-US";
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  start = startMock;
  stop = stopMock;
}

describe("SpeechToTextTextarea", () => {
  beforeEach(() => {
    startMock.mockReset();
    stopMock.mockReset();
    // @ts-expect-error test shim
    window.webkitSpeechRecognition = MockSpeechRecognition;
  });

  it("renders a microphone button and appends speech results to the textarea value", async () => {
    const handleChange = vi.fn();

    render(
      <SpeechToTextTextarea
        id="description"
        value="Existing note"
        onValueChange={handleChange}
        placeholder="Description"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Start speech to text/i }));

    expect(startMock).toHaveBeenCalledTimes(1);

    const instance = startMock.mock.instances[0] as MockSpeechRecognition;
    instance.onresult?.({
      results: [
        [{ transcript: "added by voice" }],
      ],
    });

    await waitFor(() => {
      expect(handleChange).toHaveBeenCalledWith("Existing note added by voice");
    });
  });
});
