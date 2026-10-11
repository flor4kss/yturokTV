let Hls;
import {
  renderChannels,
  renderStreams,
  renderSchedule,
  renderChannelTabs,
  renderAdmin,
  renderChat,
} from "./components/LiveViews.jsx";
import {
  renderCatalog,
  renderSyncBadge,
  renderSyncButton,
  renderLogo,
} from "./components/LiveViews.jsx";
import { DEFAULT_CHANNELS } from "../channels.js";

// Application State
const state = {
  channels: DEFAULT_CHANNELS,
  currentChannelIndex: 0,
  activeCategory: "all",
  activeEpgCategory: "all",
  isMuted: false,
  volume: 80,
  crtEnabled: false,
  currentShow: null,
  hlsInstance: null,
  ytPlayer: null,
  isYtReady: false,
  audioCtx: null,
  isTVStarted: false,
  activeEpgChannelId: null,
  activeEpgDayOffset: 0,
  mouseTimer: null,
  currentStreamUrl: null,
  currentYtId: null,
  serverTimeDeltaMs: 0,
  isTimeSynced: false,
  isCatchUpMode: false,
  sleepTimerMinutes: 0,
  sleepTimerEndMs: 0,
  tickerEnabled: localStorage.getItem("yturokTV_ticker_enabled") !== "false",
  metaCardEnabled: localStorage.getItem("yturokTV_meta_enabled") !== "false",
  danmakuEnabled: localStorage.getItem("yturokTV_danmaku_enabled") !== "false",
  danmakuColor: "#ffffff",
  danmakuLanes: [0, 0, 0, 0, 0, 0, 0, 0],
  seenCommentIds: new Set(),
  commentsList: [],
  activeRightTab: "streams",
  lastCommentTimestamp: 0,
};

// Safe DOM Helpers
const $ = (id) => document.getElementById(id);
const text = (id, str) => {
  const el = $(id);
  if (el) el.textContent = str;
};
const on = (id, evt, handler) => {
  const el = $(id);
  if (el) el.addEventListener(evt, handler);
  return el;
};

// Master Sverdlovsk Clock (YEKT • UTC+5 / Екатеринбург)
function getSyncedTimestamp() {
  return Date.now() + (state.serverTimeDeltaMs || 0);
}

function getSverdlovskDate() {
  return new Date(getSyncedTimestamp() + 5 * 3600 * 1000);
}

function tickClock() {
  const d = getSverdlovskDate();
  const h = String(d.getUTCHours()).padStart(2, "0");
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const s = String(d.getUTCSeconds()).padStart(2, "0");
  text("current-clock", `${h}:${m}:${s} ЕКБ`);
}

// Background NTP-over-HTTP Time Synchronization
async function syncAtomicTime() {
  const t0 = performance.now();

  try {
    const res = await fetch("/api/time?t=" + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (data && data.timestamp) {
        const rtt = performance.now() - t0;
        const serverUtcMs = data.timestamp * 1000 + rtt / 2;
        state.serverTimeDeltaMs = serverUtcMs - Date.now();
        state.isTimeSynced = true;
        updateSyncBadgeDOM();
        return;
      }
    }
  } catch (e) {}

  try {
    const res = await fetch(window.location.href, {
      method: "HEAD",
      cache: "no-store",
    });
    const rtt = performance.now() - t0;
    const dateHeader = res.headers.get("date");
    if (dateHeader) {
      const serverUtcMs = new Date(dateHeader).getTime() + rtt / 2;
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
  const badge = $("sync-indicator-badge");
  if (badge) {
    renderSyncBadge();
    badge.classList.remove("hidden");
    badge.classList.add("flex");
  }
}

// Load schedule from Backend API or localStorage
async function loadScheduleFromBackend() {
  try {
    const res = await fetch("/api/schedule?t=" + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length >= 3) {
        state.channels = data;
        return;
      }
    }
  } catch (e) {}

  const saved = localStorage.getItem("yturok_schedule_saved");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length >= 3) {
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
    if (state.audioCtx.state === "suspended") {
      state.audioCtx.resume();
    }
    const ctx = state.audioCtx;

    const osc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.04);

    clickGain.gain.setValueAtTime(0.25, ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);

    osc.connect(clickGain);
    clickGain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
}

// Ambient Bumper Tone for 2x2 Screen
function playBumperAmbientTone() {
  try {
    if (!state.audioCtx) {
      state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (state.audioCtx.state === "suspended") {
      state.audioCtx.resume();
    }
    const ctx = state.audioCtx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(65, ctx.currentTime + 1.2);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 1.3);
  } catch (e) {}
}

// -----------------------------------------------------------------------------
// Global Volume & Mute Manager
// -----------------------------------------------------------------------------
function applyVolume() {
  const iconName =
    state.isMuted || state.volume === 0 ? "volume_off" : "volume_up";
  const muteIcon = $("mute-icon");
  const dockMuteIcon = $("dock-mute-icon");
  if (muteIcon) muteIcon.textContent = iconName;
  if (dockMuteIcon) dockMuteIcon.textContent = iconName;

  const hlsVideo = $("hls-player");
  if (hlsVideo) {
    hlsVideo.muted = state.isTVStarted ? state.isMuted : true;
    hlsVideo.volume = state.volume / 100;
  }

  if (state.ytPlayer && state.ytPlayer.setVolume) {
    try {
      if (state.isMuted || !state.isTVStarted) {
        state.ytPlayer.mute();
      } else {
        state.ytPlayer.unMute();
        state.ytPlayer.setVolume(state.volume);
      }
    } catch (e) {}
  }
}

// -----------------------------------------------------------------------------
// YouTube IFrame Player Engine (Dual Engine Architecture)
// -----------------------------------------------------------------------------
function initYouTubePlayer() {
  if (state.ytPlayer || !window.YT || !window.YT.Player) return;
  try {
    state.ytPlayer = new YT.Player("yt-player", {
      width: "100%",
      height: "100%",
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        iv_load_policy: 3,
        playsinline: 1,
        enablejsapi: 1,
        origin: window.location.origin || "http://localhost:8080",
      },
      events: {
        onReady: (event) => {
          state.isYtReady = true;
          applyVolume();
          const channel = state.channels[state.currentChannelIndex];
          if (channel) {
            const { currentItem } = calculateBroadcastPosition(channel);
            if (
              currentItem &&
              (currentItem.type === "youtube" || currentItem.youtubeId)
            ) {
              playCurrentChannel(false);
            }
          }
        },
        onStateChange: (event) => {
          if (event.data === (window.YT?.PlayerState?.ENDED ?? 0)) {
            playCurrentChannel(false);
          }
        },
        onError: (event) => {
          console.warn("YouTube Player Event Code:", event.data);
        },
      },
    });
  } catch (e) {
    console.warn("YouTube init exception:", e);
  }
}

window.onYouTubeIframeAPIReady = function () {
  initYouTubePlayer();
};

// Also attempt initialization if API is already loaded
if (window.YT && window.YT.Player) {
  initYouTubePlayer();
}

// -----------------------------------------------------------------------------
// Native Stream Engine (Direct Video MP4 & HLS.js • YouTube Dual-Engine)
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Deterministic Sverdlovsk Broadcast Scheduler (UTC+5 / YEKT)
// -----------------------------------------------------------------------------
const EPOCH_START = 1791658800; // Today 00:00:00 YEKT (Clean, non-repetitive cycle)

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
        poster:
          "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400",
      },
      elapsed: 0,
      nextItem: null,
      progressPercent: 0,
      currentIndex: 0,
    };
  }

  const totalDuration = schedule.reduce(
    (sum, item) => sum + (item.duration || 1440),
    0,
  );
  const currentSec =
    Math.floor(getSyncedTimestamp() / 1000) + dayOffset * 86400;
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
  const progressPercent = Math.min(
    100,
    Math.floor((elapsed / (currentItem.duration || 1440)) * 100),
  );

  return { currentItem, elapsed, nextItem, progressPercent, currentIndex };
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

// Update Dynamic Ambilight Aura Color
function updateAmbilight(colorHex) {
  const rgb = hexToRgb(colorHex || "#06b6d4");
  document.documentElement.style.setProperty(
    "--channel-primary",
    colorHex || "#06b6d4",
  );
  document.documentElement.style.setProperty(
    "--channel-glow",
    `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`,
  );
}

function hexToRgb(hex) {
  hex = (hex || "#06b6d4").replace("#", "");
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

// -----------------------------------------------------------------------------
// Play Current Channel (Dual Playback: HLS + YouTube + Video)
// -----------------------------------------------------------------------------
function playCurrentChannel(withGlitch = true) {
  const channel = state.channels[state.currentChannelIndex];
  if (!channel) return;

  const { currentItem, elapsed, nextItem, progressPercent } =
    calculateBroadcastPosition(channel);
  state.currentShow = currentItem;

  // Sound & Static noise glitch
  if (withGlitch) {
    playChannelSwitchAudio();
    const staticScreen = $("static-screen");
    if (staticScreen) {
      staticScreen.classList.remove("hidden");
      setTimeout(() => staticScreen.classList.add("hidden"), 200);
    }
  }

  // Update Ambilight & DOM
  updateAmbilight(channel.color);
  updateChannelInfoDOM(
    channel,
    currentItem,
    elapsed,
    nextItem,
    progressPercent,
  );

  // Apply CRT mode strictly according to state.crtEnabled
  applyCRT();

  // Reset Catch-Up mode on channel switch
  state.isCatchUpMode = false;
  $("btn-go-live")?.classList.add("hidden");
  $("btn-start-over")?.classList.remove("hidden");

  const hlsVideo = $("hls-player");
  const ytContainer = $("yt-player-container");
  const bumperScreen = $("bumper-screen");

  // Handle Playback by Stream Type (Prioritize Direct Native Video Streams!)
  if (currentItem.type === "bumper") {
    if (ytContainer) {
      ytContainer.classList.add("hidden");
      try {
        state.ytPlayer?.pauseVideo();
      } catch (e) {}
    }
    if (hlsVideo) {
      hlsVideo.pause();
      hlsVideo.classList.add("hidden");
    }
    if (bumperScreen) {
      bumperScreen.classList.remove("hidden");
      text("bumper-logo", "[2x2]");
      text(
        "bumper-text",
        currentItem.bumperText || "Вы смотрите 2х2. Не переключайтесь.",
      );
    }
    playBumperAmbientTone();
  } else if (currentItem.type === "youtube" || currentItem.youtubeId) {
    // Seamless YouTube IFrame Stream (Auto-cropped, Zero YouTube Interface, Instant Seek)
    const ytId =
      currentItem.youtubeId ||
      (currentItem.url
        ? currentItem.url.includes("watch?v=")
          ? currentItem.url.split("watch?v=")[1].split("&")[0]
          : currentItem.url
        : null);

    if (hlsVideo) {
      hlsVideo.pause();
      hlsVideo.classList.add("hidden");
    }
    if (state.hlsInstance) {
      state.hlsInstance.destroy();
      state.hlsInstance = null;
    }
    if (bumperScreen) bumperScreen.classList.add("hidden");

    if (ytContainer) {
      ytContainer.classList.remove("hidden");
    }

    if (ytId) {
      if (state.ytPlayer && state.isYtReady) {
        if (state.currentYtId !== ytId) {
          state.currentYtId = ytId;
          try {
            state.ytPlayer.loadVideoById({
              videoId: ytId,
              startSeconds: Math.max(0, elapsed),
            });
          } catch (e) {}
        } else {
          try {
            const cur = state.ytPlayer.getCurrentTime();
            if (Math.abs(cur - elapsed) > 4) {
              state.ytPlayer.seekTo(elapsed, true);
            }
            if (state.ytPlayer.getPlayerState() !== 1 && state.isTVStarted) {
              state.ytPlayer.playVideo();
            }
          } catch (e) {}
        }
        applyVolume();
      } else {
        state.currentYtId = ytId;
        if (!state.ytPlayer && window.YT && window.YT.Player) {
          initYouTubePlayer();
        }
      }
    }
  } else if (
    currentItem.type === "video" ||
    (currentItem.url && !currentItem.url.includes(".m3u8"))
  ) {
    // Pure Direct MP4 Video Stream (Native HTML5 <video> - Zero YouTube interface / Zero Bot blocks!)
    if (ytContainer) {
      ytContainer.classList.add("hidden");
      try {
        state.ytPlayer?.pauseVideo();
      } catch (e) {}
    }
    state.currentYtId = null;
    if (bumperScreen) bumperScreen.classList.add("hidden");

    if (hlsVideo) {
      hlsVideo.classList.remove("hidden");
      if (state.hlsInstance) {
        state.hlsInstance.destroy();
        state.hlsInstance = null;
      }

      const isNewUrl = state.currentStreamUrl !== currentItem.url;
      state.currentStreamUrl = currentItem.url;

      if (isNewUrl || !hlsVideo.src || hlsVideo.src !== currentItem.url) {
        hlsVideo.src = currentItem.url;
        hlsVideo.muted = state.isTVStarted ? state.isMuted : true;
        hlsVideo.volume = state.volume / 100;

        const applySeek = () => {
          if (elapsed > 0 && hlsVideo.duration && elapsed < hlsVideo.duration) {
            try {
              hlsVideo.currentTime = elapsed;
            } catch (e) {}
          }
        };
        hlsVideo.addEventListener("loadedmetadata", applySeek, { once: true });
        if (hlsVideo.readyState >= 1) applySeek();
        hlsVideo
          .play()
          .catch((e) => console.log("Play waiting interaction:", e));
      } else {
        if (Math.abs(hlsVideo.currentTime - elapsed) > 3) {
          try {
            hlsVideo.currentTime = elapsed;
          } catch (e) {}
        }
        if (hlsVideo.paused && state.isTVStarted)
          hlsVideo.play().catch(() => {});
      }
    }
  } else if (
    currentItem.type === "hls" ||
    (currentItem.url && currentItem.url.includes(".m3u8"))
  ) {
    // Pure HLS Stream (Native AniLibria / HLS.js - Zero YouTube interface!)
    if (ytContainer) {
      ytContainer.classList.add("hidden");
      try {
        state.ytPlayer?.pauseVideo();
      } catch (e) {}
    }
    state.currentYtId = null;
    if (bumperScreen) bumperScreen.classList.add("hidden");

    if (hlsVideo) {
      hlsVideo.classList.remove("hidden");
      const isNewUrl = state.currentStreamUrl !== currentItem.url;
      state.currentStreamUrl = currentItem.url;

      if (hlsVideo.getAttribute("src")) {
        hlsVideo.removeAttribute("src");
        hlsVideo.load();
      }

      if (Hls.isSupported()) {
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
            hlsVideo
              .play()
              .catch((e) => console.log("HLS play waiting interaction:", e));
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
      } else if (hlsVideo.canPlayType("application/vnd.apple.mpegurl")) {
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
function updateChannelInfoDOM(
  channel,
  currentItem,
  elapsed,
  nextItem,
  progressPercent,
) {
  // Corner Watermark: clean, real TV aesthetic with SVG logo
  const logoSlot = $("watermark-logo-slot");
  if (logoSlot) {
    renderLogo(channel);
  }
  text("channel-watermark", `yturokTV • ${channel.shortName || channel.name}`);

  // Badges & Show info in Player Hover Overlay
  text("hover-channel-badge", `${channel.number} • ${channel.shortName}`);
  text(
    "hover-show-title",
    `${currentItem.badgeTag ? currentItem.badgeTag + " " : ""}${currentItem.title} • ${currentItem.episode || ""}`,
  );

  // Badges & Show info in under-player metadata card
  text("current-channel-badge", `${channel.number} ${channel.shortName}`);
  text("show-title", currentItem.title);
  text("show-episode", currentItem.episode || "");
  text(
    "show-slot-badge",
    `${channel.categoryName || "ЭФИР"} • ${channel.name}`,
  );

  const tagBadge = $("show-tag-badge");
  if (tagBadge) {
    const tag = currentItem.badgeTag || "⭐ ПРЕМЬЕРА";
    tagBadge.textContent = tag;
    if (tag.includes("ПОВТОР")) {
      tagBadge.className =
        "px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold";
    } else if (tag.includes("БАМПЕР")) {
      tagBadge.className =
        "px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold";
    } else {
      tagBadge.className =
        "px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold";
    }
  }

  const poster = $("show-poster");
  if (poster && currentItem.poster) {
    poster.src = currentItem.poster;
  }

  // News Ticker text update
  const tickerText = $("ticker-text");
  if (tickerText) {
    tickerText.textContent = `СЕЙЧАС В ЭФИРЕ [${channel.number} ${channel.name}]: ${currentItem.title} (${currentItem.episode || "Трансляция"}) • ДАЛЕЕ: ${nextItem ? nextItem.title : "Продолжение эфира"} • ВРЕМЯ ЕКАТЕРИНБУРГ (YEKT • UTC+5) • yturokTV`;
  }
}

// CRT Filter Application
function applyCRT() {
  const cabinet = $("tv-cabinet");
  const crtText = $("crt-status-text");
  const btnToggle = $("btn-toggle-crt");
  const btnPlayer = $("btn-player-crt");

  if (cabinet) {
    if (state.crtEnabled) {
      cabinet.classList.add("crt-mode");
    } else {
      cabinet.classList.remove("crt-mode");
    }
  }

  if (crtText)
    crtText.textContent = state.crtEnabled ? "ЭЛТ: ВКЛ" : "ЭЛТ: ВЫКЛ";
  if (btnToggle) {
    if (state.crtEnabled) btnToggle.classList.add("active");
    else btnToggle.classList.remove("active");
  }
  if (btnPlayer) {
    if (state.crtEnabled) btnPlayer.classList.add("active");
    else btnPlayer.classList.remove("active");
  }
}

// Catch-Up TV Mode (Start over & Go Live)
function initCatchUpButtons() {
  const btnStartOver = $("btn-start-over");
  const btnGoLive = $("btn-go-live");

  if (btnStartOver) {
    btnStartOver.addEventListener("click", () => {
      state.isCatchUpMode = true;
      const hlsVideo = $("hls-player");
      if (hlsVideo) hlsVideo.currentTime = 0;
      if (state.ytPlayer && state.ytPlayer.seekTo)
        state.ytPlayer.seekTo(0, true);

      btnStartOver.classList.add("hidden");
      btnGoLive?.classList.remove("hidden");
    });
  }

  if (btnGoLive) {
    btnGoLive.addEventListener("click", () => {
      state.isCatchUpMode = false;
      playCurrentChannel(false);
      btnGoLive.classList.add("hidden");
      btnStartOver?.classList.remove("hidden");
    });
  }
}

// Sleep Timer Handling
function handleSleepTimerToggle() {
  const modes = [0, 15, 30, 45, 60];
  const curIdx = modes.indexOf(state.sleepTimerMinutes);
  const nextIdx = (curIdx + 1) % modes.length;
  state.sleepTimerMinutes = modes[nextIdx];

  if (state.sleepTimerMinutes === 0) {
    state.sleepTimerEndMs = 0;
    text("sleep-timer-text", "Сон: Выкл");
    $("btn-sleep-timer")?.classList.remove("active");
  } else {
    state.sleepTimerEndMs = Date.now() + state.sleepTimerMinutes * 60 * 1000;
    text("sleep-timer-text", `Сон: ${state.sleepTimerMinutes}м`);
    $("btn-sleep-timer")?.classList.add("active");
  }
}

function checkSleepTimerTick() {
  if (state.sleepTimerEndMs > 0) {
    const leftMs = state.sleepTimerEndMs - Date.now();
    if (leftMs <= 0) {
      state.sleepTimerMinutes = 0;
      state.sleepTimerEndMs = 0;
      text("sleep-timer-text", "Сон: Выкл");
      $("btn-sleep-timer")?.classList.remove("active");

      // Pause playback
      const hlsVideo = $("hls-player");
      if (hlsVideo) hlsVideo.pause();
      if (state.ytPlayer && state.ytPlayer.pauseVideo)
        state.ytPlayer.pauseVideo();
      alert("🌙 Таймер сна: Эфир yturokTV приостановлен. Приятных снов!");
    } else {
      const leftMin = Math.ceil(leftMs / 60000);
      text("sleep-timer-text", `Сон: ${leftMin}м`);
    }
  }
}

// Live Viewer Floating Reactions
function spawnFloatingReaction(emoji) {
  const stage = $("reactions-stage");
  if (!stage) return;

  const el = document.createElement("div");
  el.className = "floating-emoji";
  el.textContent = emoji;

  const randomLeft = 15 + Math.random() * 70;
  el.style.left = `${randomLeft}%`;

  stage.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// -----------------------------------------------------------------------------
// Category Filtering Helpers
// -----------------------------------------------------------------------------
function getFilteredChannels(category = state.activeCategory) {
  if (!category || category === "all") return state.channels;
  return state.channels.filter((ch) => ch.category === category);
}

// Render Left Vertical Navigation Rail
function selectChannel(channel) {
  const index = state.channels.indexOf(channel);
  if (index < 0) return;
  state.currentChannelIndex = index;
  playCurrentChannel(true);
}
function renderVerticalChannelDock() {
  const channels = getFilteredChannels(state.activeCategory);
  text("active-category-count", `${channels.length} каналов`);
  renderChannels({
    channels,
    activeId: state.channels[state.currentChannelIndex]?.id,
    onSelect: selectChannel,
  });
}

// Render Right Multi-Stream Live Radar Feed
function renderInspectorGrid() {
  const entries = state.channels
    .filter((_, index) => index !== state.currentChannelIndex)
    .map((channel) => ({ channel, ...calculateBroadcastPosition(channel) }));
  text("radar-channels-count", `${entries.length} каналов`);
  renderStreams({ entries, onSelect: selectChannel });
}

// -----------------------------------------------------------------------------
// Redesigned Teleprogram (EPG) with Exact Timetable & Categories
// -----------------------------------------------------------------------------
function renderEPG() {
  const channels = getFilteredChannels(state.activeEpgCategory);
  if (!channels.some((channel) => channel.id === state.activeEpgChannelId)) {
    state.activeEpgChannelId = channels[0]?.id;
  }
  renderChannelTabs({
    channels,
    activeId: state.activeEpgChannelId,
    onSelect: (channel) => {
      state.activeEpgChannelId = channel.id;
      renderEPG();
    },
  });
  const channel = state.channels.find(
    (channel) => channel.id === state.activeEpgChannelId,
  );
  if (!channel?.schedule?.length) {
    renderSchedule({ rows: [] });
    return;
  }
  const { currentIndex, elapsed } = calculateBroadcastPosition(
    channel,
    state.activeEpgDayOffset,
  );
  let start =
    (getSyncedTimestamp() + state.activeEpgDayOffset * 86400000) / 1000 -
    elapsed;
  const clock = (seconds) =>
    new Date(seconds * 1000).toLocaleTimeString("ru-RU", {
      timeZone: "Asia/Yekaterinburg",
      hour: "2-digit",
      minute: "2-digit",
    });
  const rows = Array.from(
    { length: Math.min(channel.schedule.length, 35) },
    (_, index) => {
      const item =
        channel.schedule[(currentIndex + index) % channel.schedule.length];
      const duration = item.duration || 1440;
      const row = {
        item,
        start: clock(start),
        end: clock(start + duration),
        live: index === 0 && state.activeEpgDayOffset === 0,
        duration: formatTime(duration),
      };
      start += duration;
      return row;
    },
  );
  renderSchedule({
    rows,
    onWatch: () => {
      selectChannel(channel);
      $("modal-epg")?.classList.add("hidden");
    },
  });
}

// -----------------------------------------------------------------------------
// Admin Modal & Ingestion
// -----------------------------------------------------------------------------
function renderAdminSummary() {
  renderAdmin(
    state.channels.map((channel) => ({
      channel,
      currentItem: calculateBroadcastPosition(channel).currentItem,
      hours: (
        channel.schedule.reduce(
          (sum, item) => sum + (item.duration || 1440),
          0,
        ) / 3600
      ).toFixed(0),
    })),
  );
}

let catalogRequest = 0;
async function searchAdminCatalog(query) {
  const request = ++catalogRequest;
  if (!query?.trim()) {
    renderCatalog({ message: "Введите название аниме выше…" });
    return;
  }
  renderCatalog({ message: "Поиск в базе AniLibria…" });
  try {
    const response = await fetch(
      `https://anilibria.top/api/v1/app/search/releases?query=${encodeURIComponent(query.trim())}`,
    );
    if (!response.ok) throw new Error("Ошибка поиска");
    const items = await response.json();
    if (request !== catalogRequest) return;
    if (!Array.isArray(items) || !items.length) {
      renderCatalog({ message: `Ничего не найдено по запросу «${query}».` });
      return;
    }
    renderCatalog({
      items: items.slice(0, 10),
      onAdd: async (...args) => {
        await addReleaseToChannel(...args);
        renderAdminSummary();
      },
    });
  } catch (error) {
    if (request === catalogRequest)
      renderCatalog({ message: "Ошибка подключения к базе AniLibria." });
  }
}

async function addReleaseToChannel(alias, titleRu, poster, chIdx) {
  try {
    const res = await fetch(
      `https://anilibria.top/api/v1/anime/releases/${alias}`,
    );
    if (!res.ok) throw new Error("Could not load release");
    const data = await res.json();
    const eps = data.episodes || [];
    if (eps.length === 0) {
      alert("У этого тайтла нет готовых серий.");
      return;
    }

    const items = eps.map((ep, i) => {
      const ordNum = ep.ordinal || i + 1;
      const name = ep.name || "";
      const streamUrl = ep.hls_720 || ep.hls_480 || ep.hls_1080;
      return {
        title: titleRu,
        episode: name ? `Серия ${ordNum}: ${name}` : `Серия ${ordNum}`,
        duration: ep.duration || 1440,
        type: "hls",
        url: streamUrl,
        poster: poster,
        description: data.description
          ? data.description.replace(/<[^>]+>/g, "").slice(0, 150) + "..."
          : "Аниме AniLibria",
      };
    });

    state.channels[chIdx].schedule.push(...items);
    localStorage.setItem(
      "yturok_schedule_saved",
      JSON.stringify(state.channels),
    );
    try {
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.channels),
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

// -----------------------------------------------------------------------------
// TV Ticker Bar & Metadata Card Toggles
// -----------------------------------------------------------------------------
function toggleTicker(forceVal = null) {
  state.tickerEnabled = forceVal !== null ? forceVal : !state.tickerEnabled;
  localStorage.setItem(
    "yturokTV_ticker_enabled",
    state.tickerEnabled ? "true" : "false",
  );

  const tickerBar = $("tv-ticker-bar");
  const cabinet = $("tv-cabinet");
  const chip = $("btn-toggle-ticker-header");
  const playerBtn = $("btn-player-ticker");
  const statusTxt = $("ticker-status-text");

  if (state.tickerEnabled) {
    tickerBar?.classList.remove("hidden");
    cabinet?.classList.remove("no-ticker");
    chip?.classList.add("active");
    playerBtn?.classList.add("active");
    if (statusTxt) statusTxt.textContent = "Строка: ВКЛ";
  } else {
    tickerBar?.classList.add("hidden");
    cabinet?.classList.add("no-ticker");
    chip?.classList.remove("active");
    playerBtn?.classList.remove("active");
    if (statusTxt) statusTxt.textContent = "Строка: ВЫКЛ";
  }
}

function toggleMetaCard() {
  state.metaCardEnabled = !state.metaCardEnabled;
  localStorage.setItem(
    "yturokTV_meta_enabled",
    state.metaCardEnabled ? "true" : "false",
  );
  const card = $("show-metadata-card");
  const icon = $("collapse-meta-icon");
  if (state.metaCardEnabled) {
    card?.classList.remove("collapsed");
    if (icon) icon.textContent = "expand_more";
  } else {
    card?.classList.add("collapsed");
    if (icon) icon.textContent = "expand_less";
  }
}

// -----------------------------------------------------------------------------
// Bilibili Danmaku Bullet Comments Engine (Летящие комментарии)
// -----------------------------------------------------------------------------
function toggleDanmaku(forceVal = null) {
  state.danmakuEnabled = forceVal !== null ? forceVal : !state.danmakuEnabled;
  localStorage.setItem(
    "yturokTV_danmaku_enabled",
    state.danmakuEnabled ? "true" : "false",
  );

  const cabinet = $("tv-cabinet");
  const chip = $("btn-toggle-danmaku-header");
  const playerBtn = $("btn-player-danmaku");
  const statusTxt = $("danmaku-status-text");

  if (state.danmakuEnabled) {
    cabinet?.classList.remove("no-danmaku");
    chip?.classList.add("active");
    playerBtn?.classList.add("active");
    if (statusTxt) statusTxt.textContent = "Чат: ВКЛ";
  } else {
    cabinet?.classList.add("no-danmaku");
    chip?.classList.remove("active");
    playerBtn?.classList.remove("active");
    if (statusTxt) statusTxt.textContent = "Чат: ВЫКЛ";
  }
}

const DANMAKU_LANE_TOPS = [8, 16, 24, 32, 40, 48, 56, 64];

function sendDanmaku(commentText, color = null, isSelf = false) {
  if (!commentText || !commentText.trim()) return;
  const stage = $("danmaku-stage");
  if (!stage) return;

  const cleanText = commentText.trim();
  const commentColor = color || state.danmakuColor || "#ffffff";

  const now = Date.now();
  let bestLane = 0;
  let oldestTime = Infinity;
  for (let i = 0; i < state.danmakuLanes.length; i++) {
    if (state.danmakuLanes[i] < oldestTime) {
      oldestTime = state.danmakuLanes[i];
      bestLane = i;
    }
  }
  state.danmakuLanes[bestLane] = now;
  const laneTopPercent = DANMAKU_LANE_TOPS[bestLane];

  const bullet = document.createElement("div");
  bullet.className = isSelf ? "danmaku-bullet self-bullet" : "danmaku-bullet";
  bullet.style.top = `${laneTopPercent}%`;
  bullet.style.color = commentColor;

  const duration = isSelf ? 7.2 : 6.8 + Math.random() * 2.2;
  bullet.style.animationDuration = `${duration}s`;
  bullet.textContent = isSelf ? `💬 ${cleanText}` : cleanText;

  bullet.addEventListener("animationend", () => {
    bullet.remove();
  });

  stage.appendChild(bullet);

  if (isSelf) {
    playBumperAmbientTone();
  }
}

// -----------------------------------------------------------------------------
// Synchronized Real Comments Engine (Danmaku + Live Chat)
// -----------------------------------------------------------------------------
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Cross-tab real-time sync channel
const danmakuBroadcast =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("yturokTV_danmaku_sync")
    : null;

if (danmakuBroadcast) {
  danmakuBroadcast.onmessage = (event) => {
    if (event.data && event.data.type === "NEW_COMMENT" && event.data.comment) {
      receiveRealComment(event.data.comment, false, true);
    }
  };
}

// Receive and display a genuine user comment
function receiveRealComment(comment, isSelf = false, animate = true) {
  if (!comment || !comment.id) return;
  if (state.seenCommentIds.has(comment.id)) return;
  state.seenCommentIds.add(comment.id);

  state.commentsList.push(comment);
  if (state.commentsList.length > 200) {
    state.commentsList.shift();
  }
  if (comment.timestamp && comment.timestamp > state.lastCommentTimestamp) {
    state.lastCommentTimestamp = comment.timestamp;
  }

  // Animate flying Danmaku on video screen
  if (animate && state.danmakuEnabled) {
    sendDanmaku(comment.text, comment.color, isSelf);
  }

  // Render into right-side synchronized chat panel
  renderCommentInChat(comment, isSelf);
}

// Render a single message item inside the Live Chat panel
function renderCommentInChat(comment, isSelf = false) {
  if (isSelf) comment.author = "Вы";
  $("live-chat-empty")?.style.setProperty("display", "none");
  renderChat(state.commentsList);
  const panel = $("live-chat-panel");
  if (panel) panel.scrollTop = panel.scrollHeight;
  text("chat-count-badge", state.commentsList.length);
  $("chat-count-badge")?.classList.remove("hidden");
}

// Handle submission of a real comment by user
async function handleUserCommentSubmit(rawText) {
  const cleanText = (rawText || "").trim();
  if (!cleanText) return;

  const ch = state.channels[state.currentChannelIndex];
  const now = Date.now();
  const timeStr = new Date(now).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const comment = {
    id: "c_" + now + "_" + Math.random().toString(36).substring(2, 8),
    text: cleanText,
    color: state.danmakuColor || "#ffffff",
    timestamp: now,
    timeStr: timeStr,
    channelName: ch ? ch.name : "yturokTV",
    author: "Вы",
  };

  // 1. Immediately display locally (Danmaku + Chat)
  receiveRealComment(comment, true, true);

  // 2. Broadcast across tabs in real-time
  if (danmakuBroadcast) {
    try {
      danmakuBroadcast.postMessage({
        type: "NEW_COMMENT",
        comment: { ...comment, author: "Зритель" },
      });
    } catch (e) {
      console.warn("BroadcastChannel sync notice:", e);
    }
  }

  // 3. Fallback persistence in localStorage
  try {
    const saved = JSON.parse(
      localStorage.getItem("yturokTV_real_comments") || "[]",
    );
    saved.push(comment);
    if (saved.length > 100) saved.splice(0, saved.length - 100);
    localStorage.setItem("yturokTV_real_comments", JSON.stringify(saved));
  } catch (e) {}

  // 4. Send to backend server API
  try {
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...comment, author: "Зритель" }),
    });
  } catch (e) {
    // Normal when running statically on GitHub Pages
  }
}

// Background sync loop for real comments with server
let isSyncingComments = false;
async function syncCommentsFromBackend() {
  if (isSyncingComments) return;
  isSyncingComments = true;
  try {
    const res = await fetch("/api/comments");
    if (!res.ok) return;
    const serverComments = await res.json();
    if (Array.isArray(serverComments)) {
      const isInitial = state.seenCommentIds.size === 0;
      const now = Date.now();
      for (const c of serverComments) {
        if (!c || !c.id || state.seenCommentIds.has(c.id)) continue;
        const isFresh = now - (c.timestamp || 0) < 15000;
        const shouldAnimate = isInitial ? isFresh : true;
        receiveRealComment(c, false, shouldAnimate);
      }
    }
  } catch (e) {
    // Static / offline fallback
  } finally {
    isSyncingComments = false;
  }
}

// Initialize comment system: load local history, sync backend, start polling
function initCommentSystem() {
  try {
    const cached = JSON.parse(
      localStorage.getItem("yturokTV_real_comments") || "[]",
    );
    if (Array.isArray(cached)) {
      for (const c of cached) {
        if (c && c.id && !state.seenCommentIds.has(c.id)) {
          receiveRealComment(c, false, false);
        }
      }
    }
  } catch (e) {}

  syncCommentsFromBackend().catch(() => {});
  setInterval(syncCommentsFromBackend, 2000);
}

// Switch between "Потоки" and "Чат" in the right sidebar
function switchRightPanelTab(tabName) {
  state.activeRightTab = tabName;
  const streamsTab = $("tab-btn-streams");
  const chatTab = $("tab-btn-chat");
  const inspectorGrid = $("inspector-grid");
  const chatPanel = $("live-chat-panel");
  const statusEl = $("right-panel-status");

  if (tabName === "chat") {
    streamsTab?.classList.remove(
      "bg-purple-600/30",
      "text-purple-200",
      "border",
      "border-purple-500/30",
    );
    streamsTab?.classList.add("text-gray-400");
    chatTab?.classList.remove("text-gray-400");
    chatTab?.classList.add(
      "bg-purple-600/30",
      "text-purple-200",
      "border",
      "border-purple-500/30",
    );

    inspectorGrid?.classList.add("hidden");
    chatPanel?.classList.remove("hidden");
    if (statusEl) statusEl.textContent = "Чат эфира";

    if (chatPanel) chatPanel.scrollTop = chatPanel.scrollHeight;
  } else {
    chatTab?.classList.remove(
      "bg-purple-600/30",
      "text-purple-200",
      "border",
      "border-purple-500/30",
    );
    chatTab?.classList.add("text-gray-400");
    streamsTab?.classList.remove("text-gray-400");
    streamsTab?.classList.add(
      "bg-purple-600/30",
      "text-purple-200",
      "border",
      "border-purple-500/30",
    );

    chatPanel?.classList.add("hidden");
    inspectorGrid?.classList.remove("hidden");
    if (statusEl) statusEl.textContent = `${state.channels.length} Потоков`;
  }
}

// -----------------------------------------------------------------------------
// Event Listeners & UI Handlers
// -----------------------------------------------------------------------------
function setupEventListeners() {
  const tvCabinet = $("tv-cabinet");

  // Fluid Fullscreen & Normal Auto-hide Controls
  function showPlayerControls() {
    if (tvCabinet) {
      tvCabinet.classList.add("show-controls");
      tvCabinet.classList.remove("cursor-hidden");
    }
    if (state.mouseTimer) clearTimeout(state.mouseTimer);

    state.mouseTimer = setTimeout(() => {
      if (tvCabinet) {
        tvCabinet.classList.remove("show-controls");
        tvCabinet.classList.add("cursor-hidden");
      }
    }, 2500);
  }

  if (tvCabinet) {
    tvCabinet.addEventListener("mousemove", showPlayerControls);
    tvCabinet.addEventListener("mouseenter", showPlayerControls);
    tvCabinet.addEventListener("mouseleave", () => {
      if (!document.fullscreenElement) {
        tvCabinet.classList.remove("show-controls");
        tvCabinet.classList.remove("cursor-hidden");
        if (state.mouseTimer) clearTimeout(state.mouseTimer);
      }
    });
  }

  document.addEventListener("mousemove", () => {
    if (document.fullscreenElement) {
      showPlayerControls();
    }
  });

  // Unmute on overlay click or TV click
  on("unmute-overlay", "click", () => {
    state.isTVStarted = true;
    state.isMuted = false;
    $("unmute-overlay")?.classList.add("hidden");

    const hlsVideo = $("hls-player");
    if (hlsVideo) {
      hlsVideo.muted = false;
      hlsVideo.volume = state.volume / 100;
      if (hlsVideo.paused) hlsVideo.play().catch(() => {});
    }

    if (state.ytPlayer && state.ytPlayer.unMute) {
      state.ytPlayer.unMute();
      state.ytPlayer.setVolume(state.volume);
      state.ytPlayer.playVideo();
    }

    applyVolume();
    playChannelSwitchAudio();
  });

  // Category Selector Tabs in Left Rail
  document
    .querySelectorAll("#category-selector-tabs .m3-category-chip")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("#category-selector-tabs .m3-category-chip")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeCategory = btn.dataset.cat || "all";
        renderVerticalChannelDock();
      });
    });

  // Category Selector Tabs in EPG Modal
  document
    .querySelectorAll("#epg-categories .m3-category-chip")
    .forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("#epg-categories .m3-category-chip")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.activeEpgCategory = btn.dataset.epgCat || "all";
        renderEPG();
      });
    });

  // Next / Prev Channel Buttons
  on("btn-next-ch", "click", () => {
    state.currentChannelIndex =
      (state.currentChannelIndex + 1) % state.channels.length;
    playCurrentChannel(true);
  });

  on("btn-prev-ch", "click", () => {
    state.currentChannelIndex =
      (state.currentChannelIndex - 1 + state.channels.length) %
      state.channels.length;
    playCurrentChannel(true);
  });

  // Volume Controls
  const volumeSlider = $("volume-slider");
  const muteIcon = $("mute-icon");
  const dockMuteIcon = $("dock-mute-icon");

  function handleVolumeChange(val) {
    state.volume = parseInt(val, 10);
    state.isMuted = state.volume === 0;
    if (volumeSlider) volumeSlider.value = state.volume;
    applyVolume();
  }

  if (volumeSlider) {
    volumeSlider.addEventListener("input", (e) =>
      handleVolumeChange(e.target.value),
    );
  }

  function toggleMute() {
    state.isMuted = !state.isMuted;
    applyVolume();
  }

  on("btn-mute", "click", toggleMute);
  on("dock-btn-mute", "click", toggleMute);

  // CRT Screen Toggle with LocalStorage persistence
  function toggleCRT() {
    state.crtEnabled = !state.crtEnabled;
    localStorage.setItem(
      "yturok_crt_enabled",
      state.crtEnabled ? "true" : "false",
    );
    applyCRT();
  }

  on("btn-toggle-crt", "click", toggleCRT);
  on("btn-player-crt", "click", toggleCRT);

  // Fullscreen Cinema mode
  function toggleFullscreen() {
    const el = $("tv-cabinet");
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }
  on("btn-cinema", "click", toggleFullscreen);
  on("dock-btn-cinema", "click", toggleFullscreen);

  // Force Live Sync Button (Синхрон ЕКБ)
  const btnSyncLive = $("btn-sync-live");
  if (btnSyncLive) {
    btnSyncLive.addEventListener("click", async () => {
      renderSyncButton("loading");
      await syncAtomicTime();
      const channel = state.channels[state.currentChannelIndex];
      if (channel) {
        const { currentItem, elapsed } = calculateBroadcastPosition(channel);
        if (currentItem.type === "youtube" || currentItem.youtubeId) {
          if (state.ytPlayer && state.ytPlayer.seekTo)
            state.ytPlayer.seekTo(elapsed, true);
        } else {
          const hlsVideo = $("hls-player");
          if (hlsVideo && hlsVideo.duration && elapsed < hlsVideo.duration) {
            try {
              hlsVideo.currentTime = elapsed;
            } catch (e) {}
          }
        }
      }
      setTimeout(() => {
        renderSyncButton("done");
        setTimeout(() => {
          renderSyncButton("idle");
        }, 1500);
      }, 350);
    });
  }

  // EPG Modal Open / Close
  const modalEpg = $("modal-epg");
  on("btn-nav-epg", "click", () => {
    renderEPG();
    modalEpg?.classList.remove("hidden");
  });
  on("btn-close-epg", "click", () => modalEpg?.classList.add("hidden"));

  // EPG Day Selector
  document.querySelectorAll(".epg-day-btn").forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".epg-day-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const offsets = [0, 1, 2];
      state.activeEpgDayOffset = offsets[idx] || 0;
      renderEPG();
    });
  });

  // Admin Modal Open / Close
  const modalAdmin = $("modal-admin");
  on("btn-open-admin", "click", () => {
    renderAdminSummary();
    modalAdmin?.classList.remove("hidden");
  });
  on("btn-banner-admin", "click", () => {
    renderAdminSummary();
    modalAdmin?.classList.remove("hidden");
  });
  on("btn-close-admin", "click", () => modalAdmin?.classList.add("hidden"));

  // Admin Search
  const adminSearchInput = $("admin-search-input");
  on("btn-admin-search", "click", () => {
    if (adminSearchInput) searchAdminCatalog(adminSearchInput.value);
  });
  if (adminSearchInput) {
    adminSearchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") searchAdminCatalog(adminSearchInput.value);
    });
  }

  // Catch-Up TV buttons & Sleep timer
  initCatchUpButtons();
  on("btn-sleep-timer", "click", handleSleepTimerToggle);

  // Floating Emoji Reaction Buttons
  document.querySelectorAll(".emoji-react-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      spawnFloatingReaction(btn.dataset.emoji),
    );
  });

  // Ticker and Danmaku Toggle Buttons
  on("btn-toggle-ticker-header", "click", () => toggleTicker());
  on("btn-player-ticker", "click", () => toggleTicker());
  on("btn-close-ticker", "click", () => toggleTicker(false));

  on("btn-toggle-danmaku-header", "click", () => toggleDanmaku());
  on("btn-player-danmaku", "click", () => toggleDanmaku());

  on("btn-toggle-meta-card", "click", () => toggleMetaCard());

  // Dual Tabs: Streams vs Live Chat
  on("tab-btn-streams", "click", () => switchRightPanelTab("streams"));
  on("tab-btn-chat", "click", () => switchRightPanelTab("chat"));

  // Danmaku Color Pills
  document.querySelectorAll(".danmaku-color-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".danmaku-color-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.danmakuColor = btn.dataset.color || "#ffffff";
    });
  });

  // Synchronized Real Danmaku & Chat Submit
  const danmakuForm = $("danmaku-form");
  const danmakuInput = $("danmaku-input");
  if (danmakuForm) {
    danmakuForm.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!danmakuInput || !danmakuInput.value.trim()) return;
      if (!state.danmakuEnabled) toggleDanmaku(true);
      handleUserCommentSubmit(danmakuInput.value);
      danmakuInput.value = "";
    });
  }

  // Keyboard Shortcuts (TV Remote)
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") return;

    const key = e.key.toLowerCase();
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      state.currentChannelIndex =
        (state.currentChannelIndex + 1) % state.channels.length;
      playCurrentChannel(true);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      state.currentChannelIndex =
        (state.currentChannelIndex - 1 + state.channels.length) %
        state.channels.length;
      playCurrentChannel(true);
    } else if (["1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(e.key)) {
      const targetIdx = parseInt(e.key, 10) - 1;
      if (targetIdx < state.channels.length) {
        state.currentChannelIndex = targetIdx;
        playCurrentChannel(true);
      }
    } else if (key === "m" || key === "ь") {
      toggleMute();
    } else if (key === "f" || key === "а") {
      toggleFullscreen();
    } else if (key === "t" || key === "е") {
      toggleTicker();
    } else if (key === "d" || key === "в") {
      toggleDanmaku();
    } else if (key === "c" || key === "с") {
      e.preventDefault();
      danmakuInput?.focus();
    }
  });
}

// -----------------------------------------------------------------------------
// Master Periodic Loop
// -----------------------------------------------------------------------------
function startMasterLoop() {
  tickClock();

  setInterval(() => {
    tickClock();
    checkSleepTimerTick();

    // Occasional ambient reaction
    if (Math.random() < 0.05 && state.isTVStarted) {
      spawnFloatingReaction(
        ["🔥", "🚀", "🍿", "😂"][Math.floor(Math.random() * 4)],
      );
    }

    const channel = state.channels[state.currentChannelIndex];
    if (channel) {
      const { currentItem, elapsed, nextItem, progressPercent } =
        calculateBroadcastPosition(channel);
      if (state.currentShow !== currentItem) {
        playCurrentChannel(false);
      } else {
        const prog = $("broadcast-progress");
        if (prog) prog.style.width = `${progressPercent}%`;
        text(
          "broadcast-time-text",
          `${formatTime(elapsed)} / ${formatTime(currentItem.duration || 1400)}`,
        );

        // Stream Drift Auto-Correction
        if (!state.isCatchUpMode) {
          if (currentItem.type === "youtube" || currentItem.youtubeId) {
            if (state.ytPlayer && state.ytPlayer.getCurrentTime) {
              try {
                const cur = state.ytPlayer.getCurrentTime();
                if (
                  Math.abs(cur - elapsed) > 4 &&
                  elapsed < (currentItem.duration || 1400)
                ) {
                  state.ytPlayer.seekTo(elapsed, true);
                }
              } catch (e) {}
            }
          } else {
            const hlsVideo = $("hls-player");
            if (
              hlsVideo &&
              !hlsVideo.paused &&
              currentItem.type !== "bumper" &&
              hlsVideo.duration
            ) {
              const drift = Math.abs(hlsVideo.currentTime - elapsed);
              if (drift > 3 && elapsed < hlsVideo.duration) {
                try {
                  hlsVideo.currentTime = elapsed;
                } catch (err) {}
              }
            }
          }
        }
      }
    }
  }, 1000);

  // Periodic Atomic Time Sync every 60s
  setInterval(() => {
    syncAtomicTime().catch(() => {});
  }, 60000);
}

// Application Startup
export async function initializeTV() {
  Hls = (await import("hls.js")).default;
  const savedCrt = localStorage.getItem("yturok_crt_enabled");
  if (savedCrt !== null) {
    state.crtEnabled = savedCrt === "true";
  }

  startMasterLoop();
  await loadScheduleFromBackend();

  renderVerticalChannelDock();
  renderInspectorGrid();
  setupEventListeners();

  const initialChannel = state.channels[0];
  const { currentItem, elapsed, nextItem, progressPercent } =
    calculateBroadcastPosition(initialChannel);
  updateChannelInfoDOM(
    initialChannel,
    currentItem,
    elapsed,
    nextItem,
    progressPercent,
  );
  updateAmbilight(initialChannel.color);
  applyCRT();
  toggleTicker(state.tickerEnabled);
  toggleDanmaku(state.danmakuEnabled);
  initCommentSystem();
  if (window.YT && window.YT.Player) initYouTubePlayer();

  // Start background playback (muted initially for browser autoplay policy)
  playCurrentChannel(false);

  // Background non-blocking sync
  syncAtomicTime().catch(() => {});
}
