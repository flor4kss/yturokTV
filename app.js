import { DEFAULT_CHANNELS } from './channels.js';

// Application State
const state = {
  channels: DEFAULT_CHANNELS,
  currentChannelIndex: 0,
  isMuted: false,
  volume: 80,
  crtEnabled: false, // Default CRT state loaded from localStorage
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

// Safe DOM Helpers
const $ = (id) => document.getElementById(id);
const text = (id, str) => { const el = $(id); if (el) el.textContent = str; };
const on = (id, evt, handler) => { const el = $(id); if (el) el.addEventListener(evt, handler); return el; };

// Channel SVG Logos Dictionary
const CHANNEL_LOGOS = {
  "toonster": `<svg viewBox="0 0 40 32" class="w-7 h-6 inline-block"><rect width="36" height="26" x="2" y="5" rx="7" fill="#06b6d4"/><path d="M13 18a5 5 0 0 0 14 0" stroke="#08090e" stroke-width="2.5" stroke-linecap="round" fill="none"/><circle cx="15" cy="13" r="2" fill="#08090e"/><circle cx="25" cy="13" r="2" fill="#08090e"/><path d="M20 5 L16 1 M20 5 L24 1" stroke="#f43f5e" stroke-width="2" stroke-linecap="round"/></svg>`,
  "2x2": `<svg viewBox="0 0 44 28" class="w-7 h-5 inline-block"><rect width="44" height="28" rx="6" fill="#f59e0b"/><text x="22" y="20" font-family="system-ui, sans-serif" font-weight="900" font-size="16" text-anchor="middle" fill="#08090e" letter-spacing="-1">2x2</text></svg>`,
  "animehit": `<svg viewBox="0 0 36 36" class="w-6 h-6 inline-block"><circle cx="18" cy="18" r="16" fill="#e11d48"/><path d="M10 10 h16 M12 16 h12 M14 10 v16 M22 10 v16" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  "cyber": `<svg viewBox="0 0 36 36" class="w-6 h-6 inline-block"><rect width="32" height="32" x="2" y="2" rx="7" fill="#8b5cf6"/><path d="M9 14 h18 v8 h-5 l-4 4 l-4 -4 h-5 z" fill="#08090e"/><circle cx="14" cy="17" r="2" fill="#22d3ee"/><circle cx="22" cy="17" r="2" fill="#22d3ee"/></svg>`
};

function getChannelLogo(ch) {
  const key = ch.logoSvg || (ch.id === 'toonster' ? 'toonster' : ch.id === '2x2-max' ? '2x2' : ch.id === 'anime-hit' ? 'animehit' : 'cyber');
  return CHANNEL_LOGOS[key] || CHANNEL_LOGOS['toonster'];
}

// Master Sverdlovsk Clock (YEKT • UTC+5 / Екатеринбург)
function getSyncedTimestamp() {
  return Date.now() + (state.serverTimeDeltaMs || 0);
}

function getSverdlovskDate() {
  return new Date(getSyncedTimestamp() + (5 * 3600 * 1000));
}

function tickClock() {
  const d = getSverdlovskDate();
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  const s = String(d.getUTCSeconds()).padStart(2, '0');
  text('current-clock', `${h}:${m}:${s} ЕКБ`);
}

// Background NTP-over-HTTP Time Synchronization
async function syncAtomicTime() {
  const t0 = performance.now();

  try {
    const res = await fetch('/api/time?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data && data.timestamp) {
        const rtt = performance.now() - t0;
        const serverUtcMs = (data.timestamp * 1000) + (rtt / 2);
        state.serverTimeDeltaMs = serverUtcMs - Date.now();
        state.isTimeSynced = true;
        updateSyncBadgeDOM();
        return;
      }
    }
  } catch (e) {}

  try {
    const res = await fetch(window.location.href, { method: 'HEAD', cache: 'no-store' });
    const rtt = performance.now() - t0;
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const serverUtcMs = new Date(dateHeader).getTime() + (rtt / 2);
      state.serverTimeDeltaMs = serverUtcMs - Date.now();
      state.isTimeSynced = true;
      updateSyncBadgeDOM();
      return;
    }
  } catch (e) {}

  state.serverTimeDeltaMs = 0;
  updateSyncBadgeDOM();
}

function updateSyncBadgeDOM() {
  const badge = $('sync-indicator-badge');
  if (badge) {
    badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> СИНХРОН (ЕКБ • UTC+5)`;
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  }
}

// Load schedule from Backend API or localStorage
async function loadScheduleFromBackend() {
  try {
    const res = await fetch('/api/schedule?t=' + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length >= 4) {
        state.channels = data;
        return;
      }
    }
  } catch (e) {}

  const saved = localStorage.getItem('yturok_schedule_saved');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length >= 4) {
        state.channels = parsed;
        return;
      }
    } catch (e) {}
  }

  state.channels = DEFAULT_CHANNELS;
}

// Web Audio API Synthesizer: Rotary Channel Switch Click
function playChannelSwitchAudio() {
  try {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
    const ctx = state.audioCtx;

    const osc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.08);
    clickGain.gain.setValueAtTime(0.2, ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(clickGain);
    clickGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);

    const bufferSize = ctx.sampleRate * 0.1;
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
    noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start();
  } catch (err) {}
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

// Deterministic Broadcast Timeline Math (Continuous Multi-Season Broadcast Anchored to Fixed Epoch)
const EPOCH_START = 1767225600; // 2026-01-01 00:00:00 UTC (predictable across days and years!)

function calculateBroadcastPosition(channel, dayOffset = 0) {
  const schedule = channel.schedule;
  if (!schedule || schedule.length === 0) {
    return {
      currentItem: {
        title: "Профилактика канала",
        episode: "Эфир временно приостановлен",
        duration: 3600,
        type: "placeholder",
        description: "Скоро эфир возобновится",
        poster: "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400"
      },
      elapsed: 0,
      nextItem: null,
      progressPercent: 0,
      currentIndex: 0
    };
  }

  const totalDuration = schedule.reduce((sum, item) => sum + (item.duration || 1440), 0);
  const currentSec = Math.floor(getSyncedTimestamp() / 1000) + (dayOffset * 86400);
  const elapsedFromEpoch = Math.max(0, currentSec - EPOCH_START);
  let offset = elapsedFromEpoch % totalDuration;

  let currentItem = schedule[0];
  let elapsed = 0;
  let currentIndex = 0;

  for (let i = 0; i < schedule.length; i++) {
    const item = schedule[i];
    const dur = item.duration || 1440;
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
  const progressPercent = Math.min(100, Math.floor((elapsed / (currentItem.duration || 1440)) * 100));

  return { currentItem, elapsed, nextItem, progressPercent, currentIndex };
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// Update Dynamic Ambilight Aura Color
function updateAmbilight(colorHex) {
  const rgb = hexToRgb(colorHex || "#06b6d4");
  document.documentElement.style.setProperty('--channel-primary', colorHex || '#06b6d4');
  document.documentElement.style.setProperty('--channel-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`);
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

// Play Current Channel (Guaranteed 100% Stream Switching)
function playCurrentChannel(withGlitch = true) {
  const channel = state.channels[state.currentChannelIndex];
  if (!channel) return;

  const { currentItem, elapsed, nextItem, progressPercent } = calculateBroadcastPosition(channel);
  state.currentShow = currentItem;

  // Sound & Static noise glitch
  if (withGlitch) {
    playChannelSwitchAudio();
    const staticScreen = $('static-screen');
    if (staticScreen) {
      staticScreen.classList.remove('hidden');
      setTimeout(() => staticScreen.classList.add('hidden'), 200);
    }
  }

  // Update Ambilight & DOM
  updateAmbilight(channel.color);
  updateChannelInfoDOM(channel, currentItem, elapsed, nextItem, progressPercent);

  // Apply CRT mode strictly according to state.crtEnabled (never resets on channel switch!)
  applyCRT();

  const hlsVideo = $('hls-player');
  const bumperScreen = $('bumper-screen');

  // Handle Stream Types
  if (currentItem.type === 'bumper') {
    if (hlsVideo) {
      hlsVideo.pause();
      hlsVideo.classList.add('hidden');
    }
    if (bumperScreen) {
      bumperScreen.classList.remove('hidden');
      text('bumper-logo', channel.logo || "[2x2]");
      text('bumper-text', currentItem.bumperText || "Вы смотрите 2х2. Не переключайтесь.");
    }
    playBumperAmbientTone();

  } else if (currentItem.type === 'video') {
    if (bumperScreen) bumperScreen.classList.add('hidden');
    if (hlsVideo) {
      hlsVideo.classList.remove('hidden');

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
        if (hlsVideo.readyState >= 1) applySeek();
        hlsVideo.play().catch(e => console.log("Play waiting user interaction:", e));
      } else {
        if (Math.abs(hlsVideo.currentTime - elapsed) > 3) {
          try { hlsVideo.currentTime = elapsed; } catch (e) {}
        }
        if (hlsVideo.paused) hlsVideo.play().catch(() => {});
      }
    }

  } else if (currentItem.type === 'hls' || currentItem.url) {
    if (bumperScreen) bumperScreen.classList.add('hidden');
    if (hlsVideo) {
      hlsVideo.classList.remove('hidden');
      const isNewUrl = (state.currentStreamUrl !== currentItem.url);
      state.currentStreamUrl = currentItem.url;

      if (hlsVideo.getAttribute('src')) {
        hlsVideo.removeAttribute('src');
        hlsVideo.load();
      }

      if (window.Hls && Hls.isSupported()) {
        if (isNewUrl || !state.hlsInstance) {
          if (state.hlsInstance) state.hlsInstance.destroy();
          const hls = new Hls({ maxBufferLength: 30, enableWorker: true });
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
                case Hls.ErrorTypes.NETWORK_ERROR: hls.startLoad(); break;
                case Hls.ErrorTypes.MEDIA_ERROR: hls.recoverMediaError(); break;
                default: hls.destroy(); break;
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
        if (isNewUrl) {
          hlsVideo.src = currentItem.url;
          hlsVideo.currentTime = elapsed;
        }
        hlsVideo.muted = state.isTVStarted ? state.isMuted : true;
        hlsVideo.volume = state.volume / 100;
        hlsVideo.play().catch(() => {});
      }
    }
  }

  renderVerticalChannelDock();
  renderInspectorGrid();
}

// Update DOM Labels & Details
function updateChannelInfoDOM(channel, currentItem, elapsed, nextItem, progressPercent) {
  // Corner Watermark: clean, real TV aesthetic with SVG logo
  const logoSlot = $('watermark-logo-slot');
  if (logoSlot) {
    logoSlot.innerHTML = getChannelLogo(channel);
  }
  text('channel-watermark', channel.name);

  // Badges & Show info in Player Hover Overlay
  text('hover-channel-badge', `CH ${channel.number}`);
  text('hover-show-title', `${currentItem.title} • ${currentItem.episode || ''}`);

  // Badges & Show info in under-player metadata card
  text('current-channel-badge', `CH ${channel.number}`);
  text('show-title', currentItem.title);
  text('show-episode', currentItem.episode || "");
  text('show-slot-badge', `☀️ ${channel.badge || 'ЭФИР ЕКБ'}`);

  const poster = $('show-poster');
  if (poster && currentItem.poster) {
    poster.src = currentItem.poster;
  }

  // Progress Bar
  const prog = $('broadcast-progress');
  if (prog) prog.style.width = `${progressPercent}%`;
  text('broadcast-time-text', `${formatTime(elapsed)} / ${formatTime(currentItem.duration || 1400)}`);
}

// Apply CRT state strictly without regressions
function applyCRT() {
  const tvCabinet = $('tv-cabinet');
  const crtBtn = $('btn-toggle-crt');
  const crtText = $('crt-status-text');

  if (tvCabinet) {
    if (state.crtEnabled) {
      tvCabinet.classList.add('crt-mode');
      if (crtBtn) crtBtn.classList.add('active');
      if (crtText) crtText.textContent = "ЭЛТ: ВКЛ";
    } else {
      tvCabinet.classList.remove('crt-mode');
      if (crtBtn) crtBtn.classList.remove('active');
      if (crtText) crtText.textContent = "ЭЛТ: ВЫКЛ";
    }
  }
}

// Render Left Vertical Navigation Rail (4 Channels with SVGs)
function renderVerticalChannelDock() {
  const dock = $('vertical-channel-dock');
  if (!dock) return;
  dock.innerHTML = '';

  state.channels.forEach((ch, idx) => {
    const isActive = idx === state.currentChannelIndex;
    const btn = document.createElement('button');
    btn.className = `rail-channel-btn ${isActive ? 'active' : ''}`;
    btn.title = `${ch.number}: ${ch.name}`;
    btn.innerHTML = `
      <span class="text-xs font-mono font-bold leading-none mb-1">${ch.number}</span>
      <div class="leading-none">${getChannelLogo(ch)}</div>
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

// Render Right Multi-Channel Live Radar Feed
function renderInspectorGrid() {
  const container = $('inspector-grid');
  if (!container) return;
  container.innerHTML = '';

  state.channels.forEach((ch, idx) => {
    if (idx === state.currentChannelIndex) return; // Hide active channel here
    const { currentItem, progressPercent, nextItem } = calculateBroadcastPosition(ch);

    const card = document.createElement('div');
    card.className = "p-2.5 rounded-2xl bg-[#181926] hover:bg-[#1f2030] cursor-pointer transition flex flex-col gap-1.5 group";
    card.innerHTML = `
      <div class="flex items-center justify-between text-[11px]">
        <div class="flex items-center gap-1.5 truncate">
          <span class="w-5 h-5 rounded-lg bg-black/40 text-[10px] font-mono text-purple-300 font-bold flex items-center justify-center">${ch.number}</span>
          <span class="font-bold text-gray-200 truncate">${ch.name}</span>
        </div>
        <span class="text-[10px] text-gray-400 font-mono">${progressPercent}%</span>
      </div>
      <div class="text-xs font-semibold text-white truncate group-hover:text-purple-300 transition">
        ${currentItem.title}
      </div>
      <div class="text-[10px] text-gray-400 truncate">
        ${currentItem.episode || ''}
      </div>
      <div class="w-full bg-black/50 h-1 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-purple-400 to-cyan-400" style="width: ${progressPercent}%"></div>
      </div>
      <div class="text-[10px] text-gray-500 truncate flex items-center justify-between">
        <span class="truncate">Далее: ${nextItem ? nextItem.title : '—'}</span>
        <span class="material-symbols-outlined text-[13px] text-gray-400 group-hover:text-purple-400 transition">play_arrow</span>
      </div>
    `;

    card.addEventListener('click', () => {
      state.currentChannelIndex = idx;
      playCurrentChannel(true);
    });

    container.appendChild(card);
  });
}

// Redesigned Teleprogram (EPG) with Exact Timetable
function renderEPG() {
  const tabs = $('epg-tabs');
  const scheduleList = $('epg-schedule-list');
  if (!scheduleList) return;

  if (!state.activeEpgChannelId) {
    state.activeEpgChannelId = state.channels[state.currentChannelIndex]?.id || state.channels[0].id;
  }

  // Render Channel Tabs
  if (tabs) {
    tabs.innerHTML = '';
    state.channels.forEach(ch => {
      const isTabActive = ch.id === state.activeEpgChannelId;
      const btn = document.createElement('button');
      btn.className = `m3-chip ${isTabActive ? 'active' : ''}`;
      btn.innerHTML = `<span class="font-mono">${ch.number}</span> ${ch.name}`;
      btn.addEventListener('click', () => {
        state.activeEpgChannelId = ch.id;
        renderEPG();
      });
      tabs.appendChild(btn);
    });
  }

  const channel = state.channels.find(c => c.id === state.activeEpgChannelId) || state.channels[0];
  scheduleList.innerHTML = '';

  const schedule = channel.schedule;
  if (!schedule || schedule.length === 0) {
    scheduleList.innerHTML = `<div class="text-center py-12 text-gray-400 text-xs">В сетке этого канала пока нет передач.</div>`;
    return;
  }

  const { currentItem, currentIndex, elapsed } = calculateBroadcastPosition(channel, state.activeEpgDayOffset);

  // Compute exact air times for each episode starting from current moment
  const nowMs = getSyncedTimestamp() + (state.activeEpgDayOffset * 86400000);
  let rollingStartSec = (nowMs / 1000) - elapsed;

  // Render chronological sequence of episodes
  for (let i = 0; i < Math.min(schedule.length, 30); i++) {
    const itemIdx = (currentIndex + i) % schedule.length;
    const item = schedule[itemIdx];
    const dur = item.duration || 1440;
    
    // Convert to Sverdlovsk Time (UTC+5)
    const startDate = new Date((rollingStartSec * 1000) + (5 * 3600 * 1000));
    const endDate = new Date(((rollingStartSec + dur) * 1000) + (5 * 3600 * 1000));
    const startStr = `${String(startDate.getUTCHours()).padStart(2, '0')}:${String(startDate.getUTCMinutes()).padStart(2, '0')}`;
    const endStr = `${String(endDate.getUTCHours()).padStart(2, '0')}:${String(endDate.getUTCMinutes()).padStart(2, '0')}`;

    const isNowPlaying = (i === 0 && state.activeEpgDayOffset === 0);

    const row = document.createElement('div');
    row.className = `p-3 rounded-2xl flex items-center justify-between gap-3 transition ${
      isNowPlaying ? 'bg-purple-950/40 border border-purple-500/40 shadow-lg' : 'bg-[#181926] hover:bg-[#1f2030]'
    }`;

    row.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <div class="flex flex-col items-center justify-center w-14 py-1 rounded-xl bg-black/40 text-center flex-shrink-0 font-mono">
          <span class="text-xs font-bold text-white">${startStr}</span>
          <span class="text-[9px] text-gray-400">${endStr}</span>
        </div>
        <img src="${item.poster || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=100'}" class="w-10 h-12 rounded-xl object-cover flex-shrink-0 shadow">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            ${isNowPlaying ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-rose-500/20 text-rose-300 animate-pulse">В ЭФИРЕ СЕЙЧАС</span>' : ''}
            <span class="text-[11px] font-mono text-gray-400">${formatTime(dur)}</span>
          </div>
          <h4 class="font-bold text-xs text-white truncate mt-0.5">${item.title}</h4>
          <p class="text-[11px] text-purple-300 truncate">${item.episode || ''}</p>
        </div>
      </div>
      <button class="btn-tune-epg m3-chip ${isNowPlaying ? 'active' : ''} flex-shrink-0">
        ${isNowPlaying ? 'Смотреть' : 'Включить'}
      </button>
    `;

    row.querySelector('.btn-tune-epg').addEventListener('click', () => {
      const chIdx = state.channels.findIndex(c => c.id === channel.id);
      if (chIdx !== -1) {
        state.currentChannelIndex = chIdx;
        playCurrentChannel(true);
        $('modal-epg')?.classList.add('hidden');
      }
    });

    scheduleList.appendChild(row);
    rollingStartSec += dur;
  }
}

// Render Admin Summary & Live Search
function renderAdminSummary() {
  const container = $('admin-channels-summary');
  if (!container) return;
  container.innerHTML = '';

  state.channels.forEach(ch => {
    const totalSec = ch.schedule.reduce((s, x) => s + (x.duration || 1440), 0);
    const hours = (totalSec / 3600).toFixed(1);
    const { currentItem } = calculateBroadcastPosition(ch);

    const card = document.createElement('div');
    card.className = "p-3 rounded-2xl bg-[#181926] flex flex-col gap-1.5";
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="font-bold text-white flex items-center gap-1.5">${getChannelLogo(ch)} ${ch.name}</span>
        <span class="text-[10px] font-mono text-purple-300">${hours} ч. • ${ch.schedule.length} серий</span>
      </div>
      <div class="text-[11px] text-gray-300 truncate">
        Сейчас: <strong class="text-white">${currentItem.title}</strong> (${currentItem.episode || ''})
      </div>
    `;
    container.appendChild(card);
  });
}

// Admin AniLibria Live Search
async function searchAdminCatalog(query) {
  const container = $('admin-search-results');
  if (!container) return;

  if (!query || !query.trim()) {
    container.innerHTML = `<div class="text-center py-12 text-gray-500 text-xs">Введите название аниме выше...</div>`;
    return;
  }

  container.innerHTML = `<div class="text-center py-12 text-purple-300 text-xs">Поиск в базе AniLibria...</div>`;

  try {
    const encoded = encodeURIComponent(query.trim());
    const res = await fetch(`https://anilibria.top/api/v1/app/search/releases?query=${encoded}`);
    if (!res.ok) throw new Error("API error " + res.status);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = `<div class="text-center py-12 text-gray-500 text-xs">Ничего не найдено по запросу «${query}».</div>`;
      return;
    }

    container.innerHTML = '';

    data.slice(0, 10).forEach(item => {
      const titleRu = item.name?.main || "Без названия";
      const titleEn = item.name?.english || "";
      const year = item.year || "";
      const poster = item.poster?.src ? `https://anilibria.top${item.poster.src}` : 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=100';
      const alias = item.alias;

      const card = document.createElement('div');
      card.className = "p-2.5 rounded-2xl bg-[#181926] hover:bg-[#1f2030] transition flex items-center justify-between gap-3";
      card.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
          <img src="${poster}" class="w-10 h-14 object-cover rounded-xl flex-shrink-0">
          <div class="truncate">
            <h5 class="font-bold text-xs text-white truncate">${titleRu}</h5>
            <p class="text-[10px] text-gray-400 truncate">${titleEn} (${year})</p>
          </div>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
          <button class="btn-add-ch m3-chip text-[10px] py-1 px-2.5" data-ch="0" title="Добавить в ТОЙСТЕР">+ 01</button>
          <button class="btn-add-ch m3-chip text-[10px] py-1 px-2.5" data-ch="1" title="Добавить в 2х2">+ 02</button>
          <button class="btn-add-ch m3-chip text-[10px] py-1 px-2.5" data-ch="2" title="Добавить в АНИМЕ ХИТ">+ 03</button>
          <button class="btn-add-ch m3-chip text-[10px] py-1 px-2.5" data-ch="3" title="Добавить в ДАРК">+ 04</button>
        </div>
      `;

      card.querySelectorAll('.btn-add-ch').forEach(btn => {
        btn.addEventListener('click', async () => {
          const chIdx = parseInt(btn.dataset.ch, 10);
          btn.textContent = "...";
          await addReleaseToChannel(alias, titleRu, poster, chIdx);
          btn.textContent = "✓";
          renderAdminSummary();
        });
      });

      container.appendChild(card);
    });

  } catch (err) {
    container.innerHTML = `<div class="text-center py-12 text-rose-400 text-xs">Ошибка подключения к базе AniLibria.</div>`;
  }
}

// Ingest Release into target Channel
async function addReleaseToChannel(alias, titleRu, poster, chIdx) {
  try {
    const res = await fetch(`https://anilibria.top/api/v1/anime/releases/${alias}`);
    if (!res.ok) throw new Error("Could not load release");
    const data = await res.json();
    const eps = data.episodes || [];
    if (eps.length === 0) {
      alert("У этого тайтла нет готовых серий.");
      return;
    }

    const items = eps.map((ep, i) => {
      const ordNum = ep.ordinal || (i + 1);
      const name = ep.name || "";
      const streamUrl = ep.hls_720 || ep.hls_480 || ep.hls_1080;
      return {
        title: titleRu,
        episode: name ? `Серия ${ordNum}: ${name}` : `Серия ${ordNum}`,
        duration: ep.duration || 1440,
        type: "hls",
        url: streamUrl,
        poster: poster,
        description: data.description ? data.description.replace(/<[^>]+>/g, '').slice(0, 150) + '...' : "Аниме AniLibria"
      };
    });

    state.channels[chIdx].schedule.push(...items);
    localStorage.setItem('yturok_schedule_saved', JSON.stringify(state.channels));
    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.channels)
      });
    } catch (e) {}

    renderInspectorGrid();
    if (state.currentChannelIndex === chIdx) {
      playCurrentChannel(false);
    }
  } catch (err) {
    alert("Ошибка: " + err.message);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  const tvCabinet = $('tv-cabinet');

  // FLUID FULLSCREEN & NORMAL AUTO-HIDE CONTROLS
  function showPlayerControls() {
    if (tvCabinet) {
      tvCabinet.classList.add('show-controls');
      tvCabinet.classList.remove('cursor-hidden');
    }
    if (state.mouseTimer) clearTimeout(state.mouseTimer);

    // Hide controls and cursor after 2.5 seconds of stillness
    state.mouseTimer = setTimeout(() => {
      if (tvCabinet) {
        tvCabinet.classList.remove('show-controls');
        tvCabinet.classList.add('cursor-hidden');
      }
    }, 2500);
  }

  // Listen to mousemove on TV Cabinet
  if (tvCabinet) {
    tvCabinet.addEventListener('mousemove', showPlayerControls);
    tvCabinet.addEventListener('mouseenter', showPlayerControls);
    tvCabinet.addEventListener('mouseleave', () => {
      if (!document.fullscreenElement) {
        tvCabinet.classList.remove('show-controls');
        tvCabinet.classList.remove('cursor-hidden');
        if (state.mouseTimer) clearTimeout(state.mouseTimer);
      }
    });
  }

  // In native fullscreen, listen on document so cursor anywhere triggers controls
  document.addEventListener('mousemove', () => {
    if (document.fullscreenElement) {
      showPlayerControls();
    }
  });

  // Unmute on overlay click or TV click
  on('unmute-overlay', 'click', () => {
    state.isTVStarted = true;
    state.isMuted = false;
    $('unmute-overlay')?.classList.add('hidden');
    const hlsVideo = $('hls-player');
    if (hlsVideo) {
      hlsVideo.muted = false;
      hlsVideo.volume = state.volume / 100;
      if (hlsVideo.paused) hlsVideo.play().catch(() => {});
    }
    applyVolume();
    playChannelSwitchAudio();
  });

  // Next / Prev Channel Buttons
  on('btn-next-ch', 'click', () => {
    state.currentChannelIndex = (state.currentChannelIndex + 1) % state.channels.length;
    playCurrentChannel(true);
  });

  on('btn-prev-ch', 'click', () => {
    state.currentChannelIndex = (state.currentChannelIndex - 1 + state.channels.length) % state.channels.length;
    playCurrentChannel(true);
  });

  // Volume Controls
  const volumeSlider = $('volume-slider');
  const muteIcon = $('mute-icon');
  const dockMuteIcon = $('dock-mute-icon');

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

  on('btn-mute', 'click', toggleMute);
  on('dock-btn-mute', 'click', toggleMute);

  function applyVolume() {
    const iconName = state.isMuted || state.volume === 0 ? "volume_off" : "volume_up";
    if (muteIcon) muteIcon.textContent = iconName;
    if (dockMuteIcon) dockMuteIcon.textContent = iconName;

    const hlsVideo = $('hls-player');
    if (hlsVideo) {
      hlsVideo.muted = state.isMuted;
      hlsVideo.volume = state.volume / 100;
    }
  }

  // CRT Screen Toggle with LocalStorage persistence
  function toggleCRT() {
    state.crtEnabled = !state.crtEnabled;
    localStorage.setItem('yturok_crt_enabled', state.crtEnabled ? 'true' : 'false');
    applyCRT();
  }

  on('btn-toggle-crt', 'click', toggleCRT);
  on('btn-player-crt', 'click', toggleCRT);

  // Fullscreen Cinema mode (Развернуть на весь экран)
  function toggleFullscreen() {
    const el = $('tv-cabinet');
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
  on('btn-cinema', 'click', toggleFullscreen);
  on('dock-btn-cinema', 'click', toggleFullscreen);

  // Force Live Sync Button (Синхрон ЕКБ)
  const btnSyncLive = $('btn-sync-live');
  if (btnSyncLive) {
    btnSyncLive.addEventListener('click', async () => {
      btnSyncLive.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">sync</span> <span class="hidden md:inline text-[11px]">Синхрон...</span>`;
      await syncAtomicTime();
      const channel = state.channels[state.currentChannelIndex];
      if (channel) {
        const { elapsed } = calculateBroadcastPosition(channel);
        const hlsVideo = $('hls-player');
        if (hlsVideo && hlsVideo.duration && elapsed < hlsVideo.duration) {
          try { hlsVideo.currentTime = elapsed; } catch(e) {}
        }
      }
      setTimeout(() => {
        btnSyncLive.innerHTML = `<span class="material-symbols-outlined text-[16px] text-emerald-400">check</span> <span class="hidden md:inline text-[11px] text-emerald-400">Синхрон</span>`;
        setTimeout(() => {
          btnSyncLive.innerHTML = `<span class="material-symbols-outlined text-[16px]">sync</span> <span class="hidden md:inline text-[11px]">Синхрон</span>`;
        }, 1500);
      }, 350);
    });
  }

  // EPG Modal Open / Close
  const modalEpg = $('modal-epg');
  on('btn-nav-epg', 'click', () => {
    renderEPG();
    modalEpg?.classList.remove('hidden');
  });
  on('btn-close-epg', 'click', () => modalEpg?.classList.add('hidden'));

  // EPG Day Selector
  document.querySelectorAll('.epg-day-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.epg-day-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const offsets = [0, 1, 2];
      state.activeEpgDayOffset = offsets[idx] || 0;
      renderEPG();
    });
  });

  // Admin Modal Open / Close
  const modalAdmin = $('modal-admin');
  on('btn-open-admin', 'click', () => {
    renderAdminSummary();
    modalAdmin?.classList.remove('hidden');
  });
  on('btn-banner-admin', 'click', () => {
    renderAdminSummary();
    modalAdmin?.classList.remove('hidden');
  });
  on('btn-close-admin', 'click', () => modalAdmin?.classList.add('hidden'));

  // Admin Search
  const adminSearchInput = $('admin-search-input');
  on('btn-admin-search', 'click', () => {
    if (adminSearchInput) searchAdminCatalog(adminSearchInput.value);
  });
  if (adminSearchInput) {
    adminSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchAdminCatalog(adminSearchInput.value);
    });
  }

  // Keyboard Shortcuts (TV Remote)
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      state.currentChannelIndex = (state.currentChannelIndex + 1) % state.channels.length;
      playCurrentChannel(true);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      state.currentChannelIndex = (state.currentChannelIndex - 1 + state.channels.length) % state.channels.length;
      playCurrentChannel(true);
    } else if (['1', '2', '3', '4'].includes(e.key)) {
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
}

// Master Periodic Loop: Clock Ticking, Sverdlovsk Sync & Stream Drift Correction
function startMasterLoop() {
  tickClock();

  setInterval(() => {
    tickClock();

    const channel = state.channels[state.currentChannelIndex];
    if (channel) {
      const { currentItem, elapsed, nextItem, progressPercent } = calculateBroadcastPosition(channel);
      if (state.currentShow !== currentItem) {
        playCurrentChannel(false);
      } else {
        const prog = $('broadcast-progress');
        if (prog) prog.style.width = `${progressPercent}%`;
        text('broadcast-time-text', `${formatTime(elapsed)} / ${formatTime(currentItem.duration || 1400)}`);

        // Stream Drift Auto-Correction (Snaps video to deterministic Sverdlovsk time)
        const hlsVideo = $('hls-player');
        if (hlsVideo && !hlsVideo.paused && currentItem.type !== 'bumper' && hlsVideo.duration) {
          const drift = Math.abs(hlsVideo.currentTime - elapsed);
          if (drift > 3 && elapsed < hlsVideo.duration) {
            console.log(`[TV Sync] Correcting drift ${drift.toFixed(1)}s -> snapping to ${elapsed.toFixed(1)}s`);
            try { hlsVideo.currentTime = elapsed; } catch (err) {}
          }
        }
      }
    }
  }, 1000);

  // Periodic Atomic Time Sync every 60 seconds
  setInterval(() => {
    syncAtomicTime().catch(() => {});
  }, 60000);
}

// Application Startup
window.addEventListener('DOMContentLoaded', async () => {
  // Restore CRT preference
  const savedCrt = localStorage.getItem('yturok_crt_enabled');
  if (savedCrt !== null) {
    state.crtEnabled = (savedCrt === 'true');
  }

  startMasterLoop();
  await loadScheduleFromBackend();

  renderVerticalChannelDock();
  renderInspectorGrid();
  setupEventListeners();

  const initialChannel = state.channels[0];
  const { currentItem, elapsed, nextItem, progressPercent } = calculateBroadcastPosition(initialChannel);
  updateChannelInfoDOM(initialChannel, currentItem, elapsed, nextItem, progressPercent);
  updateAmbilight(initialChannel.color);
  applyCRT();

  // Start background playback (muted initially for browser autoplay compliance)
  playCurrentChannel(false);

  // Background non-blocking sync
  syncAtomicTime().catch(() => {});
});
