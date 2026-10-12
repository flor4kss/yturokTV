let context, master;
const notes = [0, 7, 12, 7, 3, 10, 15, 10, 5, 12, 17, 12, 3, 7, 10, 7];
export function stopPromoMusic() {
  master?.disconnect(); master = null;
}
export function setPromoMusicVolume(volume) {
  if (master && context) master.gain.setTargetAtTime(volume * .12, context.currentTime, .08);
}
export function startPromoMusic(channel, item, elapsed, volume) {
  stopPromoMusic();
  if (item.kind !== 'promo') return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    context.resume().catch(()=>{});
    master = context.createGain(); master.connect(context.destination);
    const dark = channel.id.includes('edge');
    const root = dark ? 130.81 : channel.category === 'music' ? 196 : 174.61;
    const beat = dark ? .6 : .4;
    const remaining = Math.max(0,item.duration-elapsed);
    master.gain.setValueAtTime(0,context.currentTime);
    master.gain.linearRampToValueAtTime(volume*.12,context.currentTime+.3);
    master.gain.setValueAtTime(volume*.12,context.currentTime+Math.max(.3,remaining-.6));
    master.gain.linearRampToValueAtTime(0,context.currentTime+remaining);
    for(let t=0;t<remaining;t+=beat) {
      const note = Math.floor((elapsed+t)/beat);
      const oscillator=context.createOscillator(), envelope=context.createGain();
      oscillator.type=dark?'sine':'triangle';
      oscillator.frequency.value=root*2**(notes[note%notes.length]/12);
      envelope.gain.setValueAtTime(0,context.currentTime+t);
      envelope.gain.linearRampToValueAtTime(.35,context.currentTime+t+.025);
      envelope.gain.exponentialRampToValueAtTime(.001,context.currentTime+t+beat*.95);
      oscillator.connect(envelope);envelope.connect(master);
      oscillator.start(context.currentTime+t);oscillator.stop(context.currentTime+t+beat);
    }
  } catch { /* Silent playback remains available when Web Audio is unsupported. */ }
}
