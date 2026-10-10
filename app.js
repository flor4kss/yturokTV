import { DEFAULT_CHANNELS } from './channels.js';

// Application State
const state = {
  channels: DEFAULT_CHANNELS,
  currentChannelIndex: 0,
  isMuted: false,
  volume: 80,
  crtEnabled: true,
  currentShow: null,
  hlsInstance: null,
  audioCtx: null,
  isTVStarted: false,
  activeEpgChannelId: null,
  activeEpgDayOffset: 0,
  mouseTimer: null,
  currentStreamUrl: null,
  serverTimeDeltaMs: 0,
  isTimeSynced: false
};

// Global Atomic Time Synchronization Engine (NTP-over-HTTP)
// Guarantees all viewers in any city/device watch the exact same frame simultaneously
async function syncAtomicTime() {
  const t0 = performance.now();

  // 1. Try local server endpoint if running with Python backend
  try {
    const res = await fetch('/api/time?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data && data.timestamp) {
        const rtt = performance.now() - t0;
        const serverUtcMs = (data.timestamp * 1000) + (rtt / 2);
        state.serverTimeDeltaMs = serverUtcMs - Date.now();
        state.isTimeSynced = true;
        console.log(`[Atomic Sync] Backend API delta: ${state.serverTimeDeltaMs.toFixed(0)}ms (RTT: ${rtt.toFixed(1)}ms)`);
        updateSyncBadgeDOM();
        return;
      }
    }
  } catch (e) {}

  // 2. Try same-origin HTTP Date header (works on GitHub Pages / CDN with 0 extra requests)
  try {
    const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
    const rtt = performance.now() - t0;
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverUtcMs = new Date(dateHeader).getTime() + (rtt / 2);
      state.serverTimeDeltaMs = serverUtcMs - Date.now();
      state.isTimeSynced = true;
      console.log(`[Atomic Sync] GitHub Pages Date header delta: ${state.serverTimeDeltaMs.toFixed(0)}ms (RTT: ${rtt.toFixed(1)}ms)`);
      updateSyncBadgeDOM();
      return;
    }
  } catch (e) {}

  // 3. Fallback to public atomic time service (timeapi.io)
  try {
    const res = await fetch('https://timeapi.io/api/time/current/zone?timeZone=UTC');
    if (res.ok) {
      const data = await res.json();
      if (data && data.dateTime) {
        const serverUtcMs = new Date(data.dateTime + 'Z').getTime();
        state.serverTimeDeltaMs = serverUtcMs - Date.now();
        state.isTimeSynced = true;
        console.log(`[Atomic Sync] Public timeapi.io delta: ${state.serverTimeDeltaMs.toFixed(0)}ms`);
        updateSyncBadgeDOM();
        return;
      }
    }
  } catch (e) {}

  state.serverTimeDeltaMs = 0;
  updateSyncBadgeDOM();
}

function getSyncedTimestamp() {
  return Date.now() + (state.serverTimeDeltaMs || 0);
}

function updateSyncBadgeDOM() {
  const badge = document.getElementById('sync-indicator-badge');
  if (badge) {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> СИНХРОН (ЕКБ • UTC+5)`;
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  }
}

// Fetch live schedule from Backend API with local fallback
async function loadScheduleFromBackend() {
  try {
    const res = await fetch('/api/schedule?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length >= 4) {
        state.channels = data;
      }
    }
  } catch (e) {
    console.log("Using local default schedule:", e);
    state.channels = DEFAULT_CHANNELS;
  }
}

// Web Audio API Synthesizer for Mechanical Rotary Click and Static
function playChannelSwitchAudio() {
  try {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
    const ctx = state.audioCtx;

    // Rotary click tone
    const osc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.08);
    clickGain.gain.setValueAtTime(0.25, ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(clickGain);
    clickGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);

    // Static burst
    const bufferSize = ctx.sampleRate * 0.12;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1100;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.1, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
  } catch (err) {
    console.warn("Audio error:", err);
  }
}

// Lo-Fi Synth tone for 2x2 retro bumpers
function playBumperAmbientTone() {
  try {
    if (!state.audioCtx || state.isMuted) return;
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch (e) {}
}

// Calculate current Time of Day block label (Anchored to Sverdlovsk Time UTC+5 / ЕКБ)
function getTimeOfDayBlock() {
  const yektDate = new Date(getSyncedTimestamp() + (5 * 3600 * 1000));
  const hour = yektDate.getUTCHours();
  if (hour >= 6 && hour < 12) return { label: "☀️ УТРЕННИЙ БЛОК (ЕКБ)", id: "morning" };
  if (hour >= 12 && hour < 18) return { label: "🌤️ ДНЕВНОЙ МАРАФОН (ЕКБ)", id: "day" };
  if (hour >= 18 && hour < 23) return { label: "🌆 ВЕЧЕРНИЙ ПРАЙМ (ЕКБ)", id: "evening" };
  return { label: "🌙 НОЧНОЙ ADULT SWIM (ЕКБ)", id: "night" };
}

// Deterministic Broadcast Timeline Math (Synchronized worldwide down to millisecond)
function calculateBroadcastPosition(channel, dayOffset = 0) {
  const schedule = channel.schedule;
  if (!schedule || schedule.length === 0) {
    return {
      currentItem: {
        title: "Профилактика канала",
        episode: "Эфир временно приостановлен",
        duration: 3600,
        type: "placeholder",
        description: "Добавьте серии в этот канал через Конструктор!",
        poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400"
      },
      elapsed: 0,
      nextItem: null,
      progressPercent: 0
    };
  }

  const totalDuration = schedule.reduce((sum, item) => sum + (item.duration || 1400), 0);
  const now = Math.floor(getSyncedTimestamp() / 1000) + (dayOffset * 86400);
  let offset = now % totalDuration;

  let currentItem = schedule[0];
  let elapsed = 0;
  let currentIndex = 0;

  for (let i = 0; i < schedule.length; i++) {
    const item = schedule[i];
    const dur = item.duration || 1400;
    if (offset < dur) {
      currentItem = item;
      elapsed = offset;
      currentIndex = i;
      break;
    }
    offset -= dur;
  }

  const nextIndex = (currentIndex + 1) % schedule.length;
  const nextItem = schedule[nextIndex];
  const progressPercent = Math.min(100, Math.floor((elapsed / (currentItem.duration || 1400)) * 100));

  return { currentItem, elapsed, nextItem, progressPercent };
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Update Dynamic Ambilight Color
function updateAmbilight(colorHex) {
  const rgb = hexToRgb(colorHex || "#06b6d4");
  document.documentElement.style.setProperty('--channel-primary', colorHex || '#06b6d4');
  document.documentElement.style.setProperty('--channel-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
  document.documentElement.style.setProperty('--channel-glow-soft', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.18)`);
  document.documentElement.style.setProperty('--channel-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`);
}

function hexToRgb(hex) {
  hex = (hex || '#06b6d4').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// Play Current Channel (Guaranteed 100% Reliable Stream Switching)
function playCurrentChannel(withGlitch = true) {
  const channel = state.channels[state.currentChannelIndex];
  if (!channel) return;

  const { currentItem, elapsed, nextItem, progressPercent } = calculateBroadcastPosition(channel);
  state.currentShow = currentItem;

  // Sound & Static noise glitch
  if (withGlitch) {
    playChannelSwitchAudio();
    const staticScreen = document.getElementById('static-screen');
    staticScreen.classList.remove('hidden');
    setTimeout(() => {
      staticScreen.classList.add('hidden');
    }, 240);
  }

  // Update Ambilight
  updateAmbilight(channel.color);

  // Update DOM Labels
  updateChannelInfoDOM(channel, currentItem, elapsed, nextItem, progressPercent);

  // Trigger OSD
  showOSDBanner(channel, currentItem, nextItem);

  const hlsVideo = document.getElementById('hls-player');
  const bumperScreen = document.getElementById('bumper-screen');

  // Handle Stream Types
  if (currentItem.type === 'bumper') {
    // 1. NATIVE 2x2 RETRO BUMPER
    hlsVideo.pause();
    hlsVideo.classList.add('hidden');
    bumperScreen.classList.remove('hidden');

    document.getElementById('bumper-logo').textContent = channel.logo || "[2x2]";
    document.getElementById('bumper-text').textContent = currentItem.bumperText || "Вы смотрите 2х2. Не переключайтесь.";
    playBumperAmbientTone();

  } else if (currentItem.type === 'video') {
    // 2. DIRECT MP4 VIDEO (Ну, погоди! и классика)
    bumperScreen.classList.add('hidden');
    hlsVideo.classList.remove('hidden');

    // Destroy HLS instance if it was active
    if (state.hlsInstance) {
      state.hlsInstance.destroy();
      state.hlsInstance = null;
    }

    const isNewUrl = (state.currentStreamUrl !== currentItem.url);
    state.currentStreamUrl = currentItem.url;

    if (isNewUrl || !hlsVideo.src || hlsVideo.src !== currentItem.url) {
      hlsVideo.src = currentItem.url;
      hlsVideo.muted = state.isTVStarted ? state.isMuted : true;
      hlsVideo.volume = state.volume / 100;

      const applySeek = () => {
        if (elapsed > 0 && hlsVideo.duration && elapsed < hlsVideo.duration) {
          try { hlsVideo.currentTime = elapsed; } catch (e) {}
        }
      };
      hlsVideo.addEventListener('loadedmetadata', applySeek, { once: true });
      if (hlsVideo.readyState >= 1) {
        applySeek();
      }

      hlsVideo.play().catch(e => console.log("Play waiting interaction:", e));
    } else {
      if (Math.abs(hlsVideo.currentTime - elapsed) > 3) {
        try { hlsVideo.currentTime = elapsed; } catch (e) {}
      }
      if (hlsVideo.paused) {
        hlsVideo.play().catch(() => {});
      }
    }

  } else if (currentItem.type === 'hls' || currentItem.url) {
    // 3. LIVE ANILIBRIA HLS STREAM (.m3u8)
    bumperScreen.classList.add('hidden');
    hlsVideo.classList.remove('hidden');

    const isNewUrl = (state.currentStreamUrl !== currentItem.url);
    state.currentStreamUrl = currentItem.url;

    // Reset native src attribute so HLS MediaSource works reliably
    if (hlsVideo.getAttribute('src')) {
      hlsVideo.removeAttribute('src');
      hlsVideo.load();
    }

    if (Hls.isSupported()) {
      if (isNewUrl || !state.hlsInstance) {
        if (state.hlsInstance) {
          state.hlsInstance.destroy();
        }
        const hls = new Hls({
          maxBufferLength: 30,
          enableWorker: true
        });
        state.hlsInstance = hls;
        hls.loadSource(currentItem.url);
        hls.attachMedia(hlsVideo);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          try {
            if (elapsed > 0) hlsVideo.currentTime = elapsed;
          } catch (e) {}
          hlsVideo.muted = state.isTVStarted ? state.isMuted : true;
          hlsVideo.volume = state.volume / 100;
          hlsVideo.play().catch(e => console.log("HLS play waiting interaction:", e));
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                hls.recoverMediaError();
                break;
              default:
                hls.destroy();
                break;
            }
          }
        });
      } else {
        if (Math.abs(hlsVideo.currentTime - elapsed) > 3) {
          hlsVideo.currentTime = elapsed;
        }
        if (hlsVideo.paused && state.isTVStarted) {
          hlsVideo.play().catch(() => {});
        }
      }
    } else if (hlsVideo.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Safari HLS
      if (isNewUrl) {
        hlsVideo.src = currentItem.url;
        hlsVideo.currentTime = elapsed;
      }
      hlsVideo.muted = state.isMuted;
      hlsVideo.volume = state.volume / 100;
      if (state.isTVStarted) hlsVideo.play().catch(() => {});
    }

  } else {
    bumperScreen.classList.add('hidden');
    hlsVideo.classList.add('hidden');
  }

  renderChannelList();
  renderVerticalChannelDock();
  renderInspectorGrid();
}

// Update DOM Labels & Details
function updateChannelInfoDOM(channel, currentItem, elapsed, nextItem, progressPercent) {
  const timeBlock = getTimeOfDayBlock();

  const setElText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  // Watermark (top-left) & Slot Badge
  setElText('channel-watermark', `${channel.logo || ''} ${channel.name}`);
  setElText('screen-slot-badge', currentItem.timeSlotLabel || timeBlock.label);

  // Badges & Show info
  setElText('current-channel-badge', `CH ${channel.number}`);
  setElText('show-title', currentItem.title);
  setElText('show-episode', currentItem.episode || "");
  setElText('show-description', currentItem.description || "");
  setElText('show-slot-badge', currentItem.timeSlotLabel || timeBlock.label);

  const poster = document.getElementById('show-poster');
  if (poster && currentItem.poster) {
    poster.src = currentItem.poster;
  }

  // Progress Bar
  const prog = document.getElementById('broadcast-progress');
  if (prog) prog.style.width = `${progressPercent}%`;
  setElText('broadcast-time-text', `${formatTime(elapsed)} / ${formatTime(currentItem.duration || 1400)}`);
}

// Retro OSD Banner Popup
let osdTimeout = null;
function showOSDBanner(channel, currentItem, nextItem) {
  const osd = document.getElementById('osd-banner');
  if (!osd) return;

  const setElText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setElText('osd-channel', `CH ${channel.number} • ${channel.name}`);
  setElText('osd-title', currentItem.title);
  setElText('osd-next', nextItem ? `Далее: ${nextItem.title}` : "Далее: Конец блока");

  osd.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-2');
  osd.classList.add('opacity-100', 'translate-y-0');

  if (osdTimeout) clearTimeout(osdTimeout);
  osdTimeout = setTimeout(() => {
    osd.classList.remove('opacity-100', 'translate-y-0');
    osd.classList.add('opacity-0', 'pointer-events-none', 'translate-y-2');
  }, 3500);
}

// Render Channel Bento Cards in the Bottom Showcase
function renderChannelList() {
  const container = document.getElementById('channels-container');
  if (!container) return;
  container.innerHTML = '';

  state.channels.forEach((ch, idx) => {
    const isActive = idx === state.currentChannelIndex;
    const { currentItem, progressPercent } = calculateBroadcastPosition(ch);

    const card = document.createElement('div');
    card.className = `glass-panel p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all duration-300 relative overflow-hidden group ${
      isActive 
        ? 'channel-card-bento active ring-2 ring-rose-500/80 shadow-2xl scale-[1.02]' 
        : 'hover:scale-[1.01] hover:border-white/20'
    }`;

    card.innerHTML = `
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-xl glass-pill font-mono font-black text-xs flex items-center justify-center ${isActive ? 'text-rose-400 border-rose-500/50' : 'text-gray-400'}">
            ${ch.number}
          </span>
          <div>
            <h4 class="font-display font-extrabold text-xs text-white truncate max-w-[120px]">${ch.name}</h4>
            <span class="text-[9px] text-gray-400 font-mono">${ch.badge || 'HD'}</span>
          </div>
        </div>
        ${isActive ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">В ЭФИРЕ</span>' : ''}
      </div>

      <div class="my-1">
        <div class="text-xs font-bold text-gray-200 line-clamp-1">${currentItem.title}</div>
        <div class="text-[10px] text-gray-400 line-clamp-1 mt-0.5">${currentItem.episode || ch.tagline || ''}</div>
      </div>

      <div>
        <div class="w-full bg-gray-800/80 h-1 rounded-full overflow-hidden mb-2">
          <div class="h-full bg-gradient-to-r from-rose-500 to-cyan-400 transition-all" style="width: ${progressPercent}%"></div>
        </div>
        <div class="flex items-center justify-between text-[10px] text-gray-400">
          <span>${progressPercent}% эфира</span>
          <span class="text-cyan-400 font-bold group-hover:translate-x-1 transition flex items-center gap-1">
            Смотреть <i class="fa-solid fa-arrow-right text-[8px]"></i>
          </span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => {
      if (state.currentChannelIndex !== idx) {
        state.currentChannelIndex = idx;
        playCurrentChannel(true);
      }
    });

    container.appendChild(card);
  });
}

// Render Left Vertical Floating Channel Dock
function renderVerticalChannelDock() {
  const dock = document.getElementById('vertical-channel-dock');
  if (!dock) return;
  dock.innerHTML = '';

  state.channels.forEach((ch, idx) => {
    const isActive = idx === state.currentChannelIndex;
    const btn = document.createElement('button');
    btn.className = `w-10 h-11 rounded-2xl glass-pill flex flex-col items-center justify-center transition-all cursor-pointer ${
      isActive 
        ? 'bg-gradient-to-b from-rose-500/30 to-purple-500/30 border-rose-400 text-white font-black shadow-lg shadow-rose-500/30 scale-105 ring-1 ring-rose-400' 
        : 'text-gray-400 hover:text-white hover:border-white/30'
    }`;
    btn.title = `${ch.number}: ${ch.name}`;
    btn.innerHTML = `
      <span class="text-xs font-mono font-extrabold leading-none">${ch.number}</span>
      <span class="text-[9px] mt-0.5 leading-none opacity-80">${ch.logo || ''}</span>
    `;
    btn.addEventListener('click', () => {
      if (state.currentChannelIndex !== idx) {
        state.currentChannelIndex = idx;
        playCurrentChannel(true);
      }
    });
    dock.appendChild(btn);
  });
}

// Render Multi-Channel Timeline Inspector
function renderInspectorGrid() {
  const container = document.getElementById('inspector-grid');
  if (!container) return;
  container.innerHTML = '';

  state.channels.forEach((ch, idx) => {
    if (idx === state.currentChannelIndex) return; // Don't show currently active channel here
    const { currentItem, progressPercent, nextItem } = calculateBroadcastPosition(ch);

    const card = document.createElement('div');
    card.className = "glass-panel p-2.5 rounded-2xl border border-white/8 hover:border-white/25 cursor-pointer transition flex flex-col gap-1.5 group";
    card.innerHTML = `
      <div class="flex items-center justify-between text-[11px]">
        <div class="flex items-center gap-1.5 truncate">
          <span class="w-5 h-5 rounded-lg glass-pill text-[10px] font-mono text-cyan-300 font-bold flex items-center justify-center">${ch.number}</span>
          <span class="font-bold text-gray-200 truncate">${ch.name}</span>
        </div>
        <span class="text-[10px] text-gray-500 font-mono">${progressPercent}%</span>
      </div>
      <div class="text-xs font-semibold text-white truncate group-hover:text-cyan-300 transition">
        ${currentItem.title}
      </div>
      <div class="w-full bg-gray-800/80 h-1 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-cyan-500 to-rose-500" style="width: ${progressPercent}%"></div>
      </div>
      <div class="text-[10px] text-gray-500 truncate flex items-center justify-between">
        <span class="truncate">Далее: ${nextItem ? nextItem.title : '—'}</span>
        <i class="fa-solid fa-play text-[8px] text-gray-600 group-hover:text-rose-400 transition"></i>
      </div>
    `;

    card.addEventListener('click', () => {
      state.currentChannelIndex = idx;
      playCurrentChannel(true);
    });

    container.appendChild(card);
  });
}

// EPG (Electronic Program Guide)
function renderEPG() {
  const tabs = document.getElementById('epg-tabs');
  const scheduleList = document.getElementById('epg-schedule-list');

  if (!state.activeEpgChannelId) {
    state.activeEpgChannelId = state.channels[state.currentChannelIndex].id;
  }

  // Render Tabs
  tabs.innerHTML = '';
  state.channels.forEach(ch => {
    const isTabActive = ch.id === state.activeEpgChannelId;
    const btn = document.createElement('button');
    btn.className = `px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
      isTabActive ? 'bg-cyan-500 text-black font-bold shadow' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
    }`;
    btn.innerHTML = `<span class="font-mono">${ch.number}</span> ${ch.name}`;
    btn.addEventListener('click', () => {
      state.activeEpgChannelId = ch.id;
      renderEPG();
    });
    tabs.appendChild(btn);
  });

  // Calculate schedule for selected Day Offset
  const channel = state.channels.find(c => c.id === state.activeEpgChannelId) || state.channels[0];
  scheduleList.innerHTML = '';

  if (!channel.schedule || channel.schedule.length === 0) {
    scheduleList.innerHTML = `
      <div class="text-center py-12 text-gray-400 text-xs">
        <i class="fa-solid fa-circle-exclamation text-xl mb-2 text-amber-500 block"></i>
        В сетке этого канала пока нет передач. Добавьте серии в Конструкторе!
      </div>
    `;
    return;
  }

  const { currentItem } = calculateBroadcastPosition(channel, state.activeEpgDayOffset);

  channel.schedule.forEach((item) => {
    const isNowPlaying = (item === currentItem && state.activeEpgDayOffset === 0);
    const row = document.createElement('div');
    row.className = `p-3.5 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 transition ${
      isNowPlaying ? 'border-cyan-400/60 bg-cyan-950/20' : 'border-white/10 bg-black/40 hover:bg-white/5'
    }`;

    row.innerHTML = `
      <div class="flex items-start gap-3.5 flex-1">
        <div class="w-14 h-16 rounded-xl bg-gray-900 overflow-hidden flex-shrink-0 border border-white/10">
          <img src="${item.poster || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=100'}" class="w-full h-full object-cover">
        </div>
        <div>
          <div class="flex items-center gap-2">
            ${isNowPlaying ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-cyan-400 live-dot"></span> СЕЙЧАС В ЭФИРЕ</span>' : ''}
            <span class="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">${item.timeSlotLabel || 'ТАЙМ-СЛОТ'}</span>
            <span class="text-xs font-mono text-gray-400">${formatTime(item.duration || 1400)}</span>
          </div>
          <h4 class="font-bold text-sm text-white mt-1">${item.title}</h4>
          <p class="text-xs text-cyan-400 font-medium">${item.episode || ''}</p>
          <p class="text-xs text-gray-400 line-clamp-1 mt-0.5">${item.description || item.bumperText || ''}</p>
        </div>
      </div>
      <button class="btn-tune-epg px-4 py-2 rounded-xl text-xs font-bold ${isNowPlaying ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/30' : 'bg-gray-800 hover:bg-gray-700 text-gray-200'} transition flex-shrink-0">
        ${isNowPlaying ? 'Смотреть сейчас' : 'Выбрать канал'}
      </button>
    `;

    row.querySelector('.btn-tune-epg').addEventListener('click', () => {
      const chIdx = state.channels.findIndex(c => c.id === channel.id);
      if (chIdx !== -1) {
        state.currentChannelIndex = chIdx;
        playCurrentChannel(true);
        document.getElementById('modal-epg').classList.add('hidden');
      }
    });

    scheduleList.appendChild(row);
  });
}

// AniLibria Live Search & Studio Manager
async function searchAniLibria(query) {
  const container = document.getElementById('search-results-container');
  const countBadge = document.getElementById('search-count-badge');
  
  if (!query.trim()) {
    container.innerHTML = `<div class="text-center py-12 text-gray-500 text-xs">Введите название аниме выше...</div>`;
    countBadge.textContent = "Введите запрос";
    return;
  }

  container.innerHTML = `
    <div class="flex items-center justify-center py-12 gap-2 text-cyan-400 text-xs">
      <i class="fa-solid fa-spinner fa-spin"></i> Поиск в базе AniLibria...
    </div>
  `;

  try {
    const encoded = encodeURIComponent(query.trim());
    const res = await fetch(`https://anilibria.top/api/v1/app/search/releases?query=${encoded}`);
    if (!res.ok) throw new Error("Search API responded with error " + res.status);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = `<div class="text-center py-12 text-gray-500 text-xs">Ничего не найдено по запросу «${query}». Попробуйте другое слово.</div>`;
      countBadge.textContent = "0 найдено";
      return;
    }

    countBadge.textContent = `Найдено: ${data.length}`;
    container.innerHTML = '';

    data.slice(0, 10).forEach(item => {
      const titleRu = item.name?.main || "Без названия";
      const titleEn = item.name?.english || "";
      const year = item.year || "";
      const poster = item.poster?.src ? `https://anilibria.top${item.poster.src}` : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100';
      const alias = item.alias;

      const card = document.createElement('div');
      card.className = "p-3 rounded-2xl border border-white/10 bg-black/40 hover:bg-white/5 transition flex items-center justify-between gap-3";

      card.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
          <img src="${poster}" class="w-12 h-16 object-cover rounded-xl border border-white/10 flex-shrink-0">
          <div class="truncate">
            <h5 class="font-bold text-sm text-white truncate">${titleRu}</h5>
            <p class="text-xs text-gray-400 truncate">${titleEn} (${year})</p>
            <span class="text-[10px] text-cyan-400 font-mono">ID: ${alias}</span>
          </div>
        </div>
        <button class="btn-add-anime px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition flex-shrink-0 flex items-center gap-1.5 shadow">
          <i class="fa-solid fa-plus"></i> В эфир
        </button>
      `;

      card.querySelector('.btn-add-anime').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Добавляем...`;
        await addAnimeReleaseToCustomChannel(alias, titleRu, poster);
        btn.innerHTML = `<i class="fa-solid fa-check"></i> Добавлено!`;
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-plus"></i> В эфир`;
        }, 1500);
      });

      container.appendChild(card);
    });

  } catch (err) {
    console.error("AniLibria search error:", err);
    container.innerHTML = `
      <div class="text-center py-12 text-rose-400 text-xs">
        Ошибка подключения к базе AniLibria. Проверьте соединение или попробуйте снова.
      </div>
    `;
  }
}

// Fetch full release details and add Episode 1 to Custom Channel
async function addAnimeReleaseToCustomChannel(alias, titleRu, poster) {
  try {
    const res = await fetch(`https://anilibria.top/api/v1/anime/releases/${alias}`);
    if (!res.ok) throw new Error("Could not load release details");
    const data = await res.json();

    const episodes = data.episodes || [];
    if (episodes.length === 0) {
      alert("У этого тайтла пока нет готовых серий.");
      return;
    }

    const firstEp = episodes[0];
    const streamUrl = firstEp.hls_720 || firstEp.hls_480 || firstEp.hls_1080;
    const duration = firstEp.duration || 1440;

    const newItem = {
      title: titleRu,
      episode: firstEp.name ? `Серия 1: ${firstEp.name}` : `Серия 1`,
      duration: duration,
      type: "hls",
      url: streamUrl,
      poster: poster,
      description: data.description ? data.description.replace(/<[^>]+>/g, '').slice(0, 150) + '...' : "Аниме из базы AniLibria"
    };

    const customChan = state.channels.find(c => c.isCustom);
    if (customChan) {
      customChan.schedule.push(newItem);
      saveChannelsToBackend();
      renderCustomSchedule();
      renderChannelList();

      if (state.channels[state.currentChannelIndex].isCustom) {
        playCurrentChannel(false);
      }
    }
  } catch (err) {
    console.error("Error adding anime to custom channel:", err);
    alert("Не удалось загрузить серию: " + err.message);
  }
}

// Render Custom Channel's schedule in Studio
function renderCustomSchedule() {
  const container = document.getElementById('custom-schedule-items');
  const customChan = state.channels.find(c => c.isCustom);
  if (!customChan) return;

  container.innerHTML = '';
  if (customChan.schedule.length === 0) {
    container.innerHTML = `
      <div class="text-center py-6 text-gray-500 text-xs">
        Сетка пуста. Найдите аниме слева через поиск в базе!
      </div>
    `;
    return;
  }

  customChan.schedule.forEach((item, idx) => {
    const el = document.createElement('div');
    el.className = "p-2 rounded-xl bg-[#181d2e] border border-white/10 flex items-center justify-between gap-2 text-xs";
    el.innerHTML = `
      <div class="truncate flex items-center gap-2">
        <span class="text-gray-500 font-mono">${idx + 1}.</span>
        <div class="truncate">
          <div class="font-bold text-white truncate">${item.title}</div>
          <div class="text-[10px] text-gray-400 font-mono">${formatTime(item.duration || 1400)} • ${item.type.toUpperCase()}</div>
        </div>
      </div>
      <button class="btn-del-item text-gray-500 hover:text-red-400 px-2 py-1 transition" title="Удалить из сетки">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;

    el.querySelector('.btn-del-item').addEventListener('click', () => {
      customChan.schedule.splice(idx, 1);
      saveChannelsToBackend();
      renderCustomSchedule();
      renderChannelList();
      if (state.channels[state.currentChannelIndex].isCustom) {
        playCurrentChannel(false);
      }
    });

    container.appendChild(el);
  });
}

// Persist channels to Backend API and localStorage
async function saveChannelsToBackend() {
  localStorage.setItem('yturok_schedule_saved', JSON.stringify(state.channels));
  try {
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.channels)
    });
  } catch (e) {
    console.log("Offline or static host, saved locally:", e);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  const screenContainer = document.getElementById('tv-screen-container');

  // 1. AUTO-HIDE CURSOR ON INACTIVITY
  function resetMouseTimer() {
    if (screenContainer) screenContainer.classList.remove('cursor-hidden');
    if (state.mouseTimer) clearTimeout(state.mouseTimer);

    state.mouseTimer = setTimeout(() => {
      if (screenContainer) screenContainer.classList.add('cursor-hidden');
    }, 2500);
  }

  if (screenContainer) {
    screenContainer.addEventListener('mousemove', resetMouseTimer);
    screenContainer.addEventListener('mouseenter', resetMouseTimer);
    screenContainer.addEventListener('mouseleave', () => {
      screenContainer.classList.remove('cursor-hidden');
      if (state.mouseTimer) clearTimeout(state.mouseTimer);
    });
  }

  // Unmute / Sound activate click
  document.getElementById('unmute-overlay').addEventListener('click', () => {
    state.isTVStarted = true;
    state.isMuted = false;
    document.getElementById('unmute-overlay').classList.add('hidden');
    const hlsVideo = document.getElementById('hls-player');
    hlsVideo.muted = false;
    hlsVideo.volume = state.volume / 100;
    if (hlsVideo.paused) {
      hlsVideo.play().catch(() => {});
    }
    playChannelSwitchAudio();
  });

  // Next / Prev Channel Buttons
  document.getElementById('btn-next-ch').addEventListener('click', () => {
    state.currentChannelIndex = (state.currentChannelIndex + 1) % state.channels.length;
    playCurrentChannel(true);
  });

  document.getElementById('btn-prev-ch').addEventListener('click', () => {
    state.currentChannelIndex = (state.currentChannelIndex - 1 + state.channels.length) % state.channels.length;
    playCurrentChannel(true);
  });

  // Volume Slider & Mute synchronization
  const volumeSlider = document.getElementById('volume-slider');
  const muteIcon = document.getElementById('mute-icon');
  const dockMuteIcon = document.getElementById('dock-mute-icon');

  function handleVolumeChange(val) {
    state.volume = parseInt(val, 10);
    state.isMuted = state.volume === 0;
    if (volumeSlider) volumeSlider.value = state.volume;
    applyVolume();
  }

  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => handleVolumeChange(e.target.value));
  }

  function toggleMute() {
    state.isMuted = !state.isMuted;
    applyVolume();
  }

  const btnMute = document.getElementById('btn-mute');
  if (btnMute) btnMute.addEventListener('click', toggleMute);
  const dockBtnMute = document.getElementById('dock-btn-mute');
  if (dockBtnMute) dockBtnMute.addEventListener('click', toggleMute);

  function applyVolume() {
    const iconClass = state.isMuted || state.volume === 0 
      ? "fa-solid fa-volume-xmark text-rose-500" 
      : "fa-solid fa-volume-high";
    if (muteIcon) muteIcon.className = iconClass;
    if (dockMuteIcon) dockMuteIcon.className = iconClass;

    const hlsVideo = document.getElementById('hls-player');
    if (hlsVideo) {
      hlsVideo.muted = state.isMuted;
      hlsVideo.volume = state.volume / 100;
    }
  }

  // CRT Screen Toggle
  const crtBtn = document.getElementById('btn-toggle-crt');
  const crtText = document.getElementById('crt-status-text');

  function toggleCRT() {
    state.crtEnabled = !state.crtEnabled;
    if (screenContainer) {
      if (state.crtEnabled) {
        screenContainer.classList.add('crt-mode');
        if (crtText) { crtText.textContent = "ЭЛТ"; crtText.className = "text-amber-400 font-bold text-[10px]"; }
      } else {
        screenContainer.classList.remove('crt-mode');
        if (crtText) { crtText.textContent = "ВЫКЛ"; crtText.className = "text-gray-400 text-[10px]"; }
      }
    }
  }

  if (crtBtn) crtBtn.addEventListener('click', toggleCRT);

  // Fullscreen Cinema mode
  function toggleFullscreen() {
    const el = document.getElementById('tv-screen-container');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(err => alert("Fullscreen error: " + err.message));
    } else {
      document.exitFullscreen();
    }
  }

  const btnCinema = document.getElementById('btn-cinema');
  if (btnCinema) btnCinema.addEventListener('click', toggleFullscreen);
  const dockBtnCinema = document.getElementById('dock-btn-cinema');
  if (dockBtnCinema) dockBtnCinema.addEventListener('click', toggleFullscreen);

  // Manual Live Force Sync Button
  const btnSyncLive = document.getElementById('btn-sync-live');
  if (btnSyncLive) {
    btnSyncLive.addEventListener('click', async () => {
      btnSyncLive.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> <span class="hidden sm:inline text-[11px] font-bold">Синхрон...</span>`;
      await syncAtomicTime();
      const channel = state.channels[state.currentChannelIndex];
      if (channel) {
        const { elapsed } = calculateBroadcastPosition(channel);
        const hlsVideo = document.getElementById('hls-player');
        if (hlsVideo && hlsVideo.duration && elapsed < hlsVideo.duration) {
          try { hlsVideo.currentTime = elapsed; } catch(e) {}
        }
      }
      setTimeout(() => {
        btnSyncLive.innerHTML = `<i class="fa-solid fa-check text-[11px] text-emerald-400"></i> <span class="hidden sm:inline text-[11px] font-bold text-emerald-400">Синхрон</span>`;
        setTimeout(() => {
          btnSyncLive.innerHTML = `<i class="fa-solid fa-arrows-rotate text-[11px]"></i> <span class="hidden sm:inline text-[11px] font-bold">Синхрон</span>`;
        }, 1500);
      }, 400);
    });
  }

  // EPG Modal Open / Close
  const modalEpg = document.getElementById('modal-epg');
  function openEPG() {
    renderEPG();
    if (modalEpg) modalEpg.classList.remove('hidden');
  }

  const btnNavEpg = document.getElementById('btn-nav-epg');
  if (btnNavEpg) btnNavEpg.addEventListener('click', openEPG);
  const btnCloseEpg = document.getElementById('btn-close-epg');
  if (btnCloseEpg) btnCloseEpg.addEventListener('click', () => modalEpg.classList.add('hidden'));

  // EPG Day Selector Buttons
  document.querySelectorAll('.epg-day-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.epg-day-btn').forEach(b => {
        b.className = "epg-day-btn glass-pill px-4 py-1.5 text-xs text-gray-400 hover:text-white cursor-pointer";
      });
      btn.className = "epg-day-btn active glass-pill px-4 py-1.5 text-xs font-bold text-cyan-300 border-cyan-500/40 cursor-pointer";
      
      const offsets = [0, 1, 3, 5];
      state.activeEpgDayOffset = offsets[idx] || 0;
      renderEPG();
    });
  });

  // Studio Modal Open / Close
  const modalStudio = document.getElementById('modal-studio');
  function openStudio() {
    renderCustomSchedule();
    if (modalStudio) modalStudio.classList.remove('hidden');
  }

  const btnOpenStudio = document.getElementById('btn-open-studio');
  if (btnOpenStudio) btnOpenStudio.addEventListener('click', openStudio);
  const btnBannerStudio = document.getElementById('btn-banner-studio');
  if (btnBannerStudio) btnBannerStudio.addEventListener('click', openStudio);
  const btnCloseStudio = document.getElementById('btn-close-studio');
  if (btnCloseStudio) btnCloseStudio.addEventListener('click', () => modalStudio.classList.add('hidden'));

  // Studio Search Button & Enter Key
  const searchInput = document.getElementById('studio-search-input');
  document.getElementById('btn-studio-search').addEventListener('click', () => {
    searchAniLibria(searchInput.value);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') searchAniLibria(searchInput.value);
  });

  // Direct Alias Add Button
  const aliasInput = document.getElementById('custom-alias-input');
  const btnAddAlias = document.getElementById('btn-add-alias');
  if (btnAddAlias && aliasInput) {
    btnAddAlias.addEventListener('click', async () => {
      const alias = aliasInput.value.trim();
      if (!alias) {
        alert("Введите код аниме, например bleach или chainsaw-man");
        return;
      }
      btnAddAlias.disabled = true;
      btnAddAlias.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
      await addAnimeReleaseToCustomChannel(alias, alias, 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100');
      btnAddAlias.disabled = false;
      btnAddAlias.innerHTML = `+ Добавить`;
      aliasInput.value = '';
    });
  }

  // Clear Custom Channel
  document.getElementById('btn-clear-custom').addEventListener('click', () => {
    if (confirm("Точно очистить сетку «Моего Канала»?")) {
      const customChan = state.channels.find(c => c.isCustom);
      if (customChan) {
        customChan.schedule = [];
        saveChannelsToBackend();
        renderCustomSchedule();
        renderChannelList();
      }
    }
  });

  // Keyboard Shortcuts: TV Remote
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      state.currentChannelIndex = (state.currentChannelIndex + 1) % state.channels.length;
      playCurrentChannel(true);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      state.currentChannelIndex = (state.currentChannelIndex - 1 + state.channels.length) % state.channels.length;
      playCurrentChannel(true);
    } else if (['1', '2', '3', '4', '5'].includes(e.key)) {
      const targetIdx = parseInt(e.key, 10) - 1;
      if (targetIdx < state.channels.length) {
        state.currentChannelIndex = targetIdx;
        playCurrentChannel(true);
      }
    } else if (e.key.toLowerCase() === 'm') {
      toggleMute();
    } else if (e.key.toLowerCase() === 'f') {
      toggleFullscreen();
    }
  });

  // Periodic Clock Ticking, Sverdlovsk (UTC+5 / ЕКБ) Alignment & Active Stream Drift Correction
  setInterval(() => {
    // Unified Sverdlovsk Time (YEKT, UTC+5 / Екатеринбург)
    const yektDate = new Date(getSyncedTimestamp() + (5 * 3600 * 1000));
    const h = String(yektDate.getUTCHours()).padStart(2, '0');
    const m = String(yektDate.getUTCMinutes()).padStart(2, '0');
    const s = String(yektDate.getUTCSeconds()).padStart(2, '0');
    const clock = document.getElementById('current-clock');
    if (clock) {
      clock.textContent = `${h}:${m}:${s} ЕКБ`;
    }

    const channel = state.channels[state.currentChannelIndex];
    if (channel) {
      const { currentItem, elapsed, nextItem, progressPercent } = calculateBroadcastPosition(channel);
      if (state.currentShow !== currentItem) {
        playCurrentChannel(false);
      } else {
        document.getElementById('broadcast-progress').style.width = `${progressPercent}%`;
        document.getElementById('broadcast-time-text').textContent = `${formatTime(elapsed)} / ${formatTime(currentItem.duration || 1400)}`;

        // Active Stream Drift Auto-Correction (Eliminates buffer lag between different friends)
        const hlsVideo = document.getElementById('hls-player');
        if (hlsVideo && !hlsVideo.paused && currentItem.type !== 'bumper' && hlsVideo.duration) {
          const drift = Math.abs(hlsVideo.currentTime - elapsed);
          // If video drifted by more than 2.5 seconds (lagged or paused tab)
          if (drift > 2.5 && elapsed < hlsVideo.duration) {
            console.log(`[TV Sync] Correcting drift of ${drift.toFixed(1)}s -> snapping to ${elapsed.toFixed(1)}s`);
            try {
              hlsVideo.currentTime = elapsed;
            } catch (err) {}
          }
        }
      }
    }
  }, 1000);

  // Periodic atomic time re-synchronization every 60 seconds
  setInterval(syncAtomicTime, 60000);
}

// Initialization on DOMContentLoaded
window.addEventListener('DOMContentLoaded', async () => {
  // Clear any old corrupted localStorage versions
  localStorage.removeItem('yturok_channels');
  localStorage.removeItem('yturok_channels_v2');
  localStorage.removeItem('yturok_channels_v3');

  // Synchronize atomic time before calculating initial broadcast position
  await syncAtomicTime();

  await loadScheduleFromBackend();
  renderChannelList();
  renderVerticalChannelDock();
  renderInspectorGrid();
  setupEventListeners();

  const initialChannel = state.channels[0];
  const { currentItem, elapsed, nextItem, progressPercent } = calculateBroadcastPosition(initialChannel);
  updateChannelInfoDOM(initialChannel, currentItem, elapsed, nextItem, progressPercent);
  updateAmbilight(initialChannel.color);

  // Auto-start playback in background (muted until user clicks)
  playCurrentChannel(false);
});
