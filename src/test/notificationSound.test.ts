import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetNotificationSoundForTests, initializeNotificationSound, playNotificationSound } from "@/lib/notificationSound";

class MockAudioContext {
  currentTime = 1;
  destination = {};
  resume = vi.fn().mockResolvedValue(undefined);
  close = vi.fn().mockResolvedValue(undefined);
  createOscillator = vi.fn(() => ({
    type: "sine",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  }));
  createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }));
}

describe("notificationSound", () => {
  let createdContexts: MockAudioContext[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    __resetNotificationSoundForTests();
    createdContexts = [];
    const AudioContextMock = vi.fn(() => {
      const context = new MockAudioContext();
      createdContexts.push(context);
      return context as unknown as AudioContext;
    });
    (window as Window & { AudioContext?: typeof AudioContext }).AudioContext = AudioContextMock as unknown as typeof AudioContext;
  });

  afterEach(() => {
    __resetNotificationSoundForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("does not play until the user has interacted", async () => {
    initializeNotificationSound();
    playNotificationSound({ key: "toast:1" });
    await Promise.resolve();

    expect(createdContexts).toHaveLength(0);
  });

  it("plays after interaction and suppresses duplicate keys", async () => {
    initializeNotificationSound();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));

    playNotificationSound({ key: "toast:1" });
    await Promise.resolve();

    expect(createdContexts).toHaveLength(1);
    const firstContext = createdContexts[0];
    expect(firstContext.createOscillator).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    playNotificationSound({ key: "toast:1" });
    await Promise.resolve();
    expect(firstContext.createOscillator).toHaveBeenCalledTimes(1);

    playNotificationSound({ key: "toast:2" });
    await Promise.resolve();
    expect(firstContext.createOscillator).toHaveBeenCalledTimes(2);
  });
});
