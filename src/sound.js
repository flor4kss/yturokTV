let context;
export function feedback(kind = "tap") {
  if (localStorage.getItem("yturok_sounds") === "false") return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === "suspended") context.resume();
    const now = context.currentTime;
    const notes =
      kind === "channel"
        ? [440, 660]
        : kind === "favorite"
          ? [660, 880]
          : [520];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + index * 0.04);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.018, now + index * 0.04 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.04 + 0.12);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now + index * 0.04);
      oscillator.stop(now + index * 0.04 + 0.14);
    });
  } catch {
    /* Devices without Web Audio keep all controls usable. */
  }
}
