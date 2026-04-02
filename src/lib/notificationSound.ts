const MIN_SOUND_INTERVAL_MS = 300;
const RECENT_EVENT_TTL_MS = 1500;

type NotificationSoundOptions = {
  key?: string;
};

type BrowserAudioContext = typeof AudioContext;

let hasUserInteracted = false;
let interactionListenersBound = false;
let lastSoundAt = 0;
let sharedAudioContext: AudioContext | null = null;
const recentEventKeys = new Map<string, number>();

function getAudioContextCtor(): BrowserAudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  const ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: BrowserAudioContext }).webkitAudioContext;
  return ctor ?? null;
}

function pruneRecentEventKeys(now: number) {
  for (const [key, timestamp] of recentEventKeys.entries()) {
    if (now - timestamp > RECENT_EVENT_TTL_MS) {
      recentEventKeys.delete(key);
    }
  }
}

function ensureAudioContext(): AudioContext | null {
  if (sharedAudioContext) {
    return sharedAudioContext;
  }

  const AudioContextCtor = getAudioContextCtor();
  if (!AudioContextCtor) {
    return null;
  }

  sharedAudioContext = new AudioContextCtor();
  return sharedAudioContext;
}

function playBeep(context: AudioContext) {
  const now = context.currentTime;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);

  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(0.035, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  oscillator.start(now);
  oscillator.stop(now + 0.12);
}

export function initializeNotificationSound() {
  if (typeof window === "undefined" || interactionListenersBound) {
    return;
  }

  interactionListenersBound = true;
  const unlock = () => {
    hasUserInteracted = true;
  };

  window.addEventListener("pointerdown", unlock, { capture: true, passive: true });
  window.addEventListener("keydown", unlock, { capture: true, passive: true });
  window.addEventListener("touchstart", unlock, { capture: true, passive: true });
}

export function playNotificationSound(options: NotificationSoundOptions = {}) {
  if (typeof window === "undefined") {
    return;
  }

  initializeNotificationSound();

  const now = Date.now();
  pruneRecentEventKeys(now);

  if (options.key && recentEventKeys.has(options.key)) {
    return;
  }

  if (now - lastSoundAt < MIN_SOUND_INTERVAL_MS) {
    if (options.key) {
      recentEventKeys.set(options.key, now);
    }
    return;
  }

  if (!hasUserInteracted) {
    return;
  }

  const context = ensureAudioContext();
  if (!context) {
    return;
  }

  lastSoundAt = now;
  if (options.key) {
    recentEventKeys.set(options.key, now);
  }

  void context
    .resume()
    .then(() => {
      playBeep(context);
    })
    .catch(() => {
      // Swallow browser autoplay/security failures.
    });
}

export function __resetNotificationSoundForTests() {
  hasUserInteracted = false;
  interactionListenersBound = false;
  lastSoundAt = 0;
  recentEventKeys.clear();

  if (sharedAudioContext) {
    void sharedAudioContext.close().catch(() => {});
    sharedAudioContext = null;
  }
}
