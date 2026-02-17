export type SoundType =
  | "click"
  | "success"
  | "cancel"
  | "navigate"
  | "notify"
  | "error"
  | "toggle";

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  volume: number,
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  endFrequency?: number,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime);
  if (endFrequency) {
    osc.frequency.linearRampToValueAtTime(endFrequency, ctx.currentTime + duration);
  }
  gain.gain.setValueAtTime(volume * 0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + duration);
}

const soundDefs: Record<SoundType, (ctx: AudioContext, vol: number) => void> = {
  click(ctx, vol) {
    playTone(ctx, vol, 800, 0.03, "square");
  },

  success(ctx, vol) {
    playTone(ctx, vol, 520, 0.08, "sine", 780);
    setTimeout(() => playTone(ctx, vol * 0.7, 780, 0.06, "sine"), 60);
  },

  cancel(ctx, vol) {
    playTone(ctx, vol, 400, 0.08, "sine", 280);
  },

  navigate(ctx, vol) {
    playTone(ctx, vol * 0.6, 600, 0.05, "sine", 700);
  },

  notify(ctx, vol) {
    playTone(ctx, vol, 880, 0.08, "sine");
    setTimeout(() => playTone(ctx, vol * 0.8, 1100, 0.1, "sine"), 80);
  },

  error(ctx, vol) {
    playTone(ctx, vol, 200, 0.12, "sawtooth", 160);
  },

  toggle(ctx, vol) {
    playTone(ctx, vol * 0.5, 1000, 0.02, "square");
  },
};

export function playSound(type: SoundType, volume: number = 0.3): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    soundDefs[type](ctx, volume);
  } catch {
    // ignore audio errors silently
  }
}
