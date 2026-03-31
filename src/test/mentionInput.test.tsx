import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MentionInput } from "@/components/ui/mention-input";

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

describe("MentionInput", () => {
  beforeEach(() => {
    startMock.mockReset();
    stopMock.mockReset();
    // @ts-expect-error test shim
    window.webkitSpeechRecognition = MockSpeechRecognition;
  });

  it("renders a microphone button and appends speech results to the note body", async () => {
    const handleChange = vi.fn();

    render(
      <MentionInput
        value="Existing note"
        onChange={handleChange}
        placeholder="Add a note"
        teamMembers={[]}
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
