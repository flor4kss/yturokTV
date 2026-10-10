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

// Safe DOM Helpers
const $ = (id) => document.getElementById(id);
const text = (id, str) => { const el = $(id); if (el) el.textContent = str; };
const on = (id, evt, handler) => { const el = $(id); if (el) el.addEventListener(evt, handler); return el; };

// Unified Master Sverdlovsk Clock (YEKT • UTC+5 / Екатеринбург)
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

  // 1. Try local backend endpoint
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

  // 2. Try HTTP Date header (static GitHub Pages fallback)
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

// Calculate current Time of Day block label (YEKT, UTC+5 / ЕКБ)
function getTimeOfDayBlock() {
  const d = getSverdlovskDate();
  const hour = d.getUTCHours();
  if (hour >= 6 && hour < 12) return { label: "☀️ УТРЕННИЙ БЛОК (ЕКБ)", id: "morning" };
  if (hour >= 12 && hour < 18) return { label: "🌤️ ДНЕВНОЙ МАРАФОН (ЕКБ)", id: "day" };
  if (hour >= 18 && hour < 23) return { label: "🌆 ВЕЧЕРНИЙ ПРАЙМ (ЕКБ)", id: "evening" };
  return { label: "🌙 НОЧНОЙ ADULT SWIM (ЕКБ)", id: "night" };
}

// Deterministic Broadcast Timeline Math (Continuous multi-hour progression)
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

// Update Dynamic Ambilight Aura Color
function updateAmbilight(colorHex) {
  const rgb = hexToRgb(colorHex || "#06b6d4");
  document.documentElement.style.setProperty('--channel-primary', colorHex || '#06b6d4');
  document.documentElement.style.setProperty('--channel-glow', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`);
  document.documentElement.style.setProperty('--channel-border', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`);
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
  const timeBlock = getTimeOfDayBlock();

  // Corner Watermark: clean, real TV aesthetic
  text('channel-watermark', `${channel.name}`);

  // Badges & Show info in Player Hover Overlay
  text('hover-channel-badge', `CH ${channel.number}`);
  text('hover-show-title', `${currentItem.title} • ${currentItem.episode || ''}`);

  // Badges & Show info in under-player metadata card
  text('current-channel-badge', `CH ${channel.number}`);
  text('show-title', currentItem.title);
  text('show-episode', currentItem.episode || "");
  text('show-slot-badge', currentItem.timeSlotLabel || timeBlock.label);

  const poster = $('show-poster');
  if (poster && currentItem.poster) {
    poster.src = currentItem.poster;
  }

  // Progress Bar
  const prog = $('broadcast-progress');
  if (prog) prog.style.width = `${progressPercent}%`;
  text('broadcast-time-text', `${formatTime(elapsed)} / ${formatTime(currentItem.duration || 1400)}`);
}

// Render Left Vertical Navigation Rail (Channels 01-05)
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
      <span class="text-xs font-mono font-bold leading-none">${ch.number}</span>
      <span class="text-[11px] mt-1 leading-none">${ch.logo || ''}</span>
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
    card.className = "p-2.5 rounded-2xl bg-[#1b1d2a] border border-white/8 hover:border-white/20 cursor-pointer transition flex flex-col gap-1.5 group";
    card.innerHTML = `
      <div class="flex items-center justify-between text-[11px]">
        <div class="flex items-center gap-1.5 truncate">
          <span class="w-5 h-5 rounded-lg bg-white/10 text-[10px] font-mono text-purple-300 font-bold flex items-center justify-center">${ch.number}</span>
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
      <div class="w-full bg-black/40 h-1 rounded-full overflow-hidden">
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

// EPG Teleprogram Guide
function renderEPG() {
  const tabs = $('epg-tabs');
  const scheduleList = $('epg-schedule-list');
  if (!scheduleList) return;

  if (!state.activeEpgChannelId) {
    state.activeEpgChannelId = state.channels[state.currentChannelIndex]?.id || state.channels[0].id;
  }

  // Render Tabs
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

  // Calculate schedule for selected Day Offset
  const channel = state.channels.find(c => c.id === state.activeEpgChannelId) || state.channels[0];
  scheduleList.innerHTML = '';

  if (!channel.schedule || channel.schedule.length === 0) {
    scheduleList.innerHTML = `
      <div class="text-center py-12 text-gray-400 text-xs">
        В сетке этого канала пока нет передач. Добавьте серии в Конструкторе!
      </div>
    `;
    return;
  }

  const { currentItem } = calculateBroadcastPosition(channel, state.activeEpgDayOffset);

  channel.schedule.forEach((item) => {
    const isNowPlaying = (item === currentItem && state.activeEpgDayOffset === 0);
    const row = document.createElement('div');
    row.className = `p-3 rounded-2xl border flex items-center justify-between gap-3 transition ${
      isNowPlaying ? 'border-purple-400/60 bg-purple-950/20' : 'border-white/10 bg-[#171824] hover:bg-white/5'
    }`;

    row.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <img src="${item.poster || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=100'}" class="w-10 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0">
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            ${isNowPlaying ? '<span class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30">СЕЙЧАС В ЭФИРЕ</span>' : ''}
            <span class="text-xs font-mono text-gray-400">${formatTime(item.duration || 1400)}</span>
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
  });
}

// AniLibria Live Search & Studio Manager
async function searchAniLibria(query) {
  const container = $('search-results-container');
  if (!container) return;
  
  if (!query || !query.trim()) {
    container.innerHTML = `<div class="text-center py-12 text-gray-500 text-xs">Введите название аниме выше...</div>`;
    return;
  }

  container.innerHTML = `
    <div class="flex items-center justify-center py-12 gap-2 text-purple-300 text-xs">
      Поиск в базе AniLibria...
    </div>
  `;

  try {
    const encoded = encodeURIComponent(query.trim());
    const res = await fetch(`https://anilibria.top/api/v1/app/search/releases?query=${encoded}`);
    if (!res.ok) throw new Error("API error " + res.status);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      container.innerHTML = `<div class="text-center py-12 text-gray-500 text-xs">Ничего не найдено по запросу «${query}». Попробуйте другое слово.</div>`;
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
      card.className = "p-2.5 rounded-2xl border border-white/10 bg-[#171824] hover:bg-white/5 transition flex items-center justify-between gap-3";

      card.innerHTML = `
        <div class="flex items-center gap-3 overflow-hidden">
          <img src="${poster}" class="w-10 h-14 object-cover rounded-xl border border-white/10 flex-shrink-0">
          <div class="truncate">
            <h5 class="font-bold text-xs text-white truncate">${titleRu}</h5>
            <p class="text-[10px] text-gray-400 truncate">${titleEn} (${year})</p>
          </div>
        </div>
        <button class="btn-add-anime m3-chip text-xs py-1 px-3 flex-shrink-0">
          + В эфир
        </button>
      `;

      card.querySelector('.btn-add-anime').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = "Добавляем...";
        await addAnimeReleaseToCustomChannel(alias, titleRu, poster);
        btn.textContent = "Добавлено!";
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = "+ В эфир";
        }, 1500);
      });

      container.appendChild(card);
    });

  } catch (err) {
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

      if (state.channels[state.currentChannelIndex].isCustom) {
        playCurrentChannel(false);
      }
    }
  } catch (err) {
    alert("Не удалось загрузить серию: " + err.message);
  }
}

// Render Custom Channel's schedule in Studio
function renderCustomSchedule() {
  const container = $('custom-schedule-items');
  const customChan = state.channels.find(c => c.isCustom);
  if (!container || !customChan) return;

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
    el.className = "p-2 rounded-xl bg-[#1b1d2a] border border-white/10 flex items-center justify-between gap-2 text-xs";
    el.innerHTML = `
      <div class="truncate flex items-center gap-2">
        <span class="text-gray-500 font-mono">${idx + 1}.</span>
        <div class="truncate">
          <div class="font-bold text-white truncate">${item.title}</div>
          <div class="text-[10px] text-gray-400 font-mono">${formatTime(item.duration || 1400)}</div>
        </div>
      </div>
      <button class="btn-del-item text-gray-500 hover:text-red-400 px-2 py-1 transition" title="Удалить">
        ✕
      </button>
    `;

    el.querySelector('.btn-del-item').addEventListener('click', () => {
      customChan.schedule.splice(idx, 1);
      saveChannelsToBackend();
      renderCustomSchedule();
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
  } catch (e) {}
}

// Setup Event Listeners
function setupEventListeners() {
  const tvCabinet = $('tv-cabinet');

  // Interactive Player Controls on Hover & Mouse Move
  function showPlayerControls() {
    if (tvCabinet) {
      tvCabinet.classList.add('show-controls');
      tvCabinet.classList.remove('cursor-hidden');
    }
    if (state.mouseTimer) clearTimeout(state.mouseTimer);

    state.mouseTimer = setTimeout(() => {
      if (tvCabinet) {
        tvCabinet.classList.remove('show-controls');
        tvCabinet.classList.add('cursor-hidden');
      }
    }, 2800);
  }

  if (tvCabinet) {
    tvCabinet.addEventListener('mousemove', showPlayerControls);
    tvCabinet.addEventListener('mouseenter', showPlayerControls);
    tvCabinet.addEventListener('mouseleave', () => {
      tvCabinet.classList.remove('show-controls');
      tvCabinet.classList.remove('cursor-hidden');
      if (state.mouseTimer) clearTimeout(state.mouseTimer);
    });
  }

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

  // CRT Screen Toggle (Быстрые настройки: ЭЛТ-фильтр)
  const crtBtn = $('btn-toggle-crt');
  const crtPlayerBtn = $('btn-player-crt');
  const crtText = $('crt-status-text');

  function toggleCRT() {
    state.crtEnabled = !state.crtEnabled;
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

  if (crtBtn) crtBtn.addEventListener('click', toggleCRT);
  if (crtPlayerBtn) crtPlayerBtn.addEventListener('click', toggleCRT);

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
      const offsets = [0, 1, 3, 5];
      state.activeEpgDayOffset = offsets[idx] || 0;
      renderEPG();
    });
  });

  // Studio Modal Open / Close
  const modalStudio = $('modal-studio');
  on('btn-open-studio', 'click', () => {
    renderCustomSchedule();
    modalStudio?.classList.remove('hidden');
  });
  on('btn-banner-studio', 'click', () => {
    renderCustomSchedule();
    modalStudio?.classList.remove('hidden');
  });
  on('btn-close-studio', 'click', () => modalStudio?.classList.add('hidden'));

  // Studio Search
  const searchInput = $('studio-search-input');
  on('btn-studio-search', 'click', () => {
    if (searchInput) searchAniLibria(searchInput.value);
  });
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') searchAniLibria(searchInput.value);
    });
  }

  // Clear Custom Channel
  on('btn-clear-custom', 'click', () => {
    if (confirm("Точно очистить сетку «Моего Канала»?")) {
      const customChan = state.channels.find(c => c.isCustom);
      if (customChan) {
        customChan.schedule = [];
        saveChannelsToBackend();
        renderCustomSchedule();
      }
    }
  });

  // Keyboard Shortcuts (TV Remote)
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
  startMasterLoop();
  await loadScheduleFromBackend();

  renderVerticalChannelDock();
  renderInspectorGrid();
  setupEventListeners();

  const initialChannel = state.channels[0];
  const { currentItem, elapsed, nextItem, progressPercent } = calculateBroadcastPosition(initialChannel);
  updateChannelInfoDOM(initialChannel, currentItem, elapsed, nextItem, progressPercent);
  updateAmbilight(initialChannel.color);

  // Start background playback (muted initially for browser autoplay compliance)
  playCurrentChannel(false);

  // Background non-blocking sync
  syncAtomicTime().catch(() => {});
});
