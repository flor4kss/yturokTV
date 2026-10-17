import {bufferedAhead,qualityTarget,qualityLevel,variantPlaylist,shouldSuggestDelay,bufferGoal} from "./playbackPolicy";
import {setNetworkBudget} from "./networkBudget";
import {mediaSource,rejectSource,resetSourceFailures,healthySources} from "./mediaSources";
let Hls;
let sourceLoadTimer;
let playbackDelayMs = 0;
let bufferingSince = null;
let loadingBeganAt=null, suggestionTimer, bufferGate=null, gateStartedAt=0, gateRebuffer=false;
let recentStalls=[], resumePoint=null, lastQualityDrop=0;
function sourceTarget(){return qualityTarget(state.qualityMode);}
function suggestDelay(){
  if(!state.isTVStarted || state.currentShow?.type==='bumper')return;
  recentStalls=recentStalls.filter(t=>Date.now()-t<60000);
  if(shouldSuggestDelay({waitingMs:loadingBeganAt===null?0:Date.now()-loadingBeganAt,stalls:recentStalls.length,enabled:state.delayedMode,dismissed:state.delayDismissed})){
    state.delaySuggested=true;state.networkConstrained=true;notify();
  }
}
function cancelBufferGate(){clearInterval(bufferGate);bufferGate=null;state.bufferHolding=false;}
function holdForBuffer(video,rebuffer=false,minimumWait=0){
  if(!video || !state.isTVStarted || state.currentShow?.type==='bumper')return;
  if(bufferGate)return;
  gateStartedAt=Date.now();gateRebuffer=rebuffer;state.bufferHolding=true;state.buffering=true;
  video.pause();armLoadingTimeout();
  const notBefore=Date.now()+minimumWait;
  bufferGate=setInterval(()=>{
    if(!state.isTVStarted || state.isPaused || state.currentShow?.type==='bumper'){cancelBufferGate();return;}
    const ahead=bufferedAhead(video),duration=video.duration;
    const remaining=Number.isFinite(duration)?Math.max(0,duration-video.currentTime):Infinity;
    const goal=Math.min(bufferGoal(state.delayedMode,gateRebuffer),remaining);
    // Native MP4 browsers may limit preloading while paused; allow progress after 12s if some media is ready.
    const nativeFallback=!state.hlsInstance && Date.now()-gateStartedAt>(state.delayedMode?12000:5000) && (ahead>=1 || video.readyState>=2);
    if(Date.now()>=notBefore && ((goal>0 && ahead>=goal-.15) || nativeFallback)){
      cancelBufferGate();video.play().catch(()=>{});
    }
  },250);
  notify();
}
function applyQuality(manual=false){
  const hls=state.hlsInstance;
  if(hls?.levels?.length){
    hls.autoLevelCapping=-1;const level=qualityLevel(hls.levels,state.qualityMode);
    if(manual && level>=0 && hls.currentLevel>=0 && level!==hls.currentLevel)hls.nextLevel=level;else hls.loadLevel=level;
  }
}
function rememberMediaPosition(){
  const video=$("hls-player");
  if(video && Number.isFinite(video.currentTime) && video.readyState>=1)resumePoint={url:state.currentShow?.url,time:video.currentTime};
}
function beginBuffering() {
  if (state.delayedMode && bufferingSince === null) bufferingSince = Date.now();
}
function playbackTimestamp() {
  return getSyncedTimestamp() - (state.delayedMode ? playbackDelayMs + (bufferingSince === null ? 0 : Date.now() - bufferingSince) : 0);
}
function isYouTubeSource() {
  return (
    state.currentShow?.type === "youtube" ||
    Boolean(state.currentShow?.youtubeId)
  );
}
function finishLoading() {
  if (bufferingSince !== null) {
    playbackDelayMs += Date.now() - bufferingSince;
    bufferingSince = null;
  }
  clearTimeout(sourceLoadTimer);clearTimeout(suggestionTimer);sourceLoadTimer=null;loadingBeganAt=null;
  state.buffering = false;state.hasPlayed=true;
  state.error = null;
  notify();
}
function tryAlternateSource(failedUrl) {
  const engine=state.hlsInstance;
  if(!failedUrl)failedUrl=engine?.levels?.[engine.nextLoadLevel>=0?engine.nextLoadLevel:engine.currentLevel]?.url?.[0] || state.currentStreamUrl;
  const item=state.currentShow;
  if (!item || !['hls','video','mp4'].includes(item.type) || !rejectSource(failedUrl,item,sourceTarget()))return false;
  rememberMediaPosition();cancelBufferGate();
  state.hlsInstance?.destroy();state.hlsInstance=null;state.currentStreamUrl=null;
  playCurrentChannel(false);return true;
}
function failLoading(message) {
  suggestDelay();cancelBufferGate();
  clearTimeout(sourceLoadTimer);sourceLoadTimer=null;loadingBeganAt=null;
  if(tryAlternateSource())return;
  state.buffering = false;
  state.error = message;
  notify();
}
function armLoadingTimeout() {
  beginBuffering();
  if(loadingBeganAt===null){loadingBeganAt=Date.now();clearTimeout(suggestionTimer);suggestionTimer=setTimeout(suggestDelay,8100);}
  if(sourceLoadTimer)return;
  clearTimeout(sourceLoadTimer);
  sourceLoadTimer = setTimeout(() => {
    if (state.buffering)
      failLoading(
        "Канал долго не отвечает. Повтори подключение или выбери другой эфир.",
      );
  }, state.currentShow?.type === "rutube" ? 90000 : 45000);
}
import { DEFAULT_CHANNELS } from "../channels.js";
import { normalizeChannels } from "./programMetadata";
import { promoMessage } from "./broadcastMessages";
import { broadcastPosition, broadcastRows, invalidatePlan } from "./broadcastPlanner";
import { playRutube, stopRutube, rutubeVolume, rutubeSeek, rutubeTime, rutubeIsPlaying, resumeRutube } from "./rutubePlayer";
import { startPromoMusic, stopPromoMusic, setPromoMusicVolume } from "./promoMusic";

const isCurrentCatalog = (data) => Array.isArray(data) && data.length === 6 &&
  data.every(channel => channel.catalogVersion === 5);

// Application State
const state = {
  delayedMode:false,
  delaySuggested:false,
  delayDismissed:false,
  networkConstrained:false,
  bufferHolding:false,
  hasPlayed:false,
  bufferSeconds:0,
  qualityMode:['auto','best','low'].includes(localStorage.getItem('yturok_quality'))?localStorage.getItem('yturok_quality'):'auto',
  testMode: localStorage.getItem("yturok_test_mode") === "true",
  channels: normalizeChannels(DEFAULT_CHANNELS),
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
  notify();
}

// Load schedule from Backend API or localStorage
async function loadScheduleFromBackend() {
  try {
    const res = await fetch("/api/schedule?t=" + Date.now());
    if (res.ok) {
      const data = await res.json();
      if (isCurrentCatalog(data)) {
        state.channels = normalizeChannels(data);
        state.backendAvailable = true;
        return;
      }
    }
  } catch (e) {}

  const saved = localStorage.getItem("yturok_schedule_saved");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (isCurrentCatalog(parsed)) {
        state.channels = normalizeChannels(parsed);
        return;
      }
    } catch (e) {}
  }

  state.channels = normalizeChannels(DEFAULT_CHANNELS);
}

// Web Audio API Synthesizer: Rotary Channel Switch Click
function playChannelSwitchAudio() {}

function playBumperAmbientTone() {
  if (!state.isTVStarted || state.isMuted || state.volume === 0 || localStorage.getItem("yturok_sounds") === "false")
    return;
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

    gain.gain.setValueAtTime(0.018 * state.volume / 100, ctx.currentTime);
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
  if(state.currentShow?.type==='rutube')rutubeVolume(state.isMuted || !state.isTVStarted ? 0 : state.volume / 100);
  setPromoMusicVolume(state.isMuted || !state.isTVStarted ? 0 : state.volume / 100);
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
          state.currentYtId = null;
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
          if (!isYouTubeSource()) return;
          if (event.data === 1) {
            const playingId = state.ytPlayer?.getVideoData?.()?.video_id;
            if (
              playingId &&
              state.currentYtId &&
              playingId !== state.currentYtId
            )
              return;
          }
          state.buffering = event.data === 3;
          if (state.buffering) armLoadingTimeout();
          if (event.data === 1) {
            finishLoading();
          }
          notify();
          if (event.data === (window.YT?.PlayerState?.ENDED ?? 0)) {
            waitForNextBroadcast();
          }
        },
        onError: (event) => {
          if (!isYouTubeSource()) return;
          clearTimeout(sourceLoadTimer);
          state.error =
            "Этот источник сейчас недоступен. Попробуйте другой канал или повторите подключение.";
          state.buffering = false;
          notify();
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
let testSequence = [];
let testStartedAt = 0;
function attachTestChannel() {
  state.channels = state.channels.filter(c => c.id !== "test-lab");
  if (!state.testMode) return;
  const library = state.channels.flatMap(c => c.schedule).filter(i => i.type !== "bumper" && !i.sourceOffset);
  state.channels.push({id:"test-lab",number:"07",name:"Тестовый эфир",shortName:"Тестовый эфир",category:"test",categoryName:"Лаборатория",color:"#9edbd1",schedule:library});
  if (!testSequence.length && library.length) {testSequence=[library[0]];testStartedAt=playbackTimestamp();}
}
function testPosition() {
  let elapsed=Math.max(0,(playbackTimestamp()-testStartedAt)/1000), index=0;
  while(index<testSequence.length-1 && elapsed>=testSequence[index].duration){elapsed-=testSequence[index].duration;index++;}
  const currentItem=testSequence[index];
  return {currentItem,elapsed:Math.min(elapsed,currentItem.duration)+(currentItem.sourceOffset||0),broadcastElapsed:elapsed,nextItem:testSequence[index+1]||currentItem,progressPercent:Math.min(100,elapsed/currentItem.duration*100)};
}
function calculateBroadcastPosition(channel, dayOffset = 0) {
  if(channel.id === "test-lab" && testSequence.length)return testPosition();
  return broadcastPosition(channel, (channel===state.channels[state.currentChannelIndex]?playbackTimestamp():getSyncedTimestamp()) + dayOffset * 86400000);
}

// A shorter source must not replay the same episode until its scheduled end.
function waitForNextBroadcast() {
  stopRutube();
  const channel = state.channels[state.currentChannelIndex];
  const position = calculateBroadcastPosition(channel);
  if (position.currentItem !== state.currentShow) {
    playCurrentChannel(false);
    return;
  }
  $("hls-player")?.classList.add("hidden");
  $("yt-player-container")?.classList.add("hidden");
  $("bumper-screen")?.classList.remove("hidden");
  text("bumper-logo", "ДАЛЕЕ В ЭФИРЕ");
  text("bumper-text", "Передача завершилась. Продолжение эфира — по телепрограмме.");
  finishLoading();
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
  stopRutube();
  stopPromoMusic();
  const channel = state.channels[state.currentChannelIndex];
  if (!channel) return;

  const { currentItem, elapsed:liveElapsed, nextItem, progressPercent } =
    calculateBroadcastPosition(channel);
  const elapsed=resumePoint?.url===currentItem.url?resumePoint.time:liveElapsed;
  resumePoint=null;cancelBufferGate();
  const reusingSource =
    state.currentStreamUrl === (mediaSource(currentItem,sourceTarget())?.url || currentItem.url) &&
    state.currentShow?.type === currentItem.type;
  state.currentShow = currentItem;
  state.error = null;
  state.loadId = (state.loadId || 0) + 1;
  state.buffering = currentItem.type !== "bumper";
  clearTimeout(sourceLoadTimer);sourceLoadTimer=null;loadingBeganAt=null;clearTimeout(suggestionTimer);
  if (state.buffering) armLoadingTimeout();else finishLoading();

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
  state.isPaused = false;
  $("btn-go-live")?.classList.add("hidden");
  $("btn-start-over")?.classList.remove("hidden");

  const streamUrl=mediaSource(currentItem,sourceTarget())?.url || currentItem.url;
  state.sourceQuality=mediaSource(currentItem,sourceTarget())?.quality || null;
  const hlsVideo = $("hls-player");
  const ytContainer = $("yt-player-container");
  const bumperScreen = $("bumper-screen");

  // Handle Playback by Stream Type (Prioritize Direct Native Video Streams!)
  if(currentItem.type==='rutube') {
    state.hlsInstance?.destroy();state.hlsInstance=null;state.currentStreamUrl=null;
    hlsVideo?.pause();hlsVideo?.classList.add('hidden');
    state.ytPlayer?.pauseVideo?.();ytContainer?.classList.add('hidden');bumperScreen?.classList.add('hidden');
    playRutube(currentItem,elapsed,{started:state.isTVStarted,volume:state.isMuted || !state.isTVStarted ? 0 : state.volume/100,
      isActive:()=>state.currentShow===currentItem,
      onReady:finishLoading,onError:()=>failLoading('Источник 2×2 сейчас не отвечает. Попробуй другой канал.'),onEnded:waitForNextBroadcast});
    if(!state.isTVStarted)finishLoading();
  } else if (currentItem.type === "bumper") {
    state.hlsInstance?.destroy();
    state.hlsInstance = null;
    state.currentStreamUrl = null;
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
      text("bumper-logo", currentItem.kind === "advert" ? "РЕКЛАМНАЯ ПАУЗА" : "СКОРО В ЭФИРЕ");
      text(
        "bumper-text",
        currentItem.kind === "promo"
          ? promoMessage(currentItem, elapsed, getSyncedTimestamp()).replace(` — ${currentItem.promoTitle}.`, '.')
          : currentItem.bumperText || channel.tagline,
      );
    }
    if (state.isTVStarted) startPromoMusic(channel, currentItem, elapsed, state.isMuted ? 0 : state.volume / 100);
  } else if (currentItem.type === "youtube" || currentItem.youtubeId) {
    // Seamless YouTube IFrame Stream (Auto-cropped, Zero YouTube Interface, Instant Seek)
    const ytId =
      currentItem.youtubeId ||
      (streamUrl
        ? streamUrl.includes("watch?v=")
          ? streamUrl.split("watch?v=")[1].split("&")[0]
          : streamUrl
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
    (streamUrl && !streamUrl.includes(".m3u8"))
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

      const isNewUrl = state.currentStreamUrl !== streamUrl;
      state.currentStreamUrl = streamUrl;

      if (isNewUrl || !hlsVideo.src || hlsVideo.src !== streamUrl) {
        hlsVideo.src = streamUrl;
        hlsVideo.muted = state.isTVStarted ? state.isMuted : true;
        hlsVideo.volume = state.volume / 100;

        hlsVideo.preload="auto";
        const applySeek = () => {
          if (state.currentStreamUrl !== streamUrl) return;
          if (elapsed > 0 && hlsVideo.duration && elapsed < hlsVideo.duration) {
            try {
              hlsVideo.currentTime = elapsed;
            } catch (e) {}
          }
        };
        hlsVideo.addEventListener("loadedmetadata", applySeek, { once: true });
        if (hlsVideo.readyState >= 1) applySeek();
        if(state.isTVStarted)holdForBuffer(hlsVideo);
      } else {
        if (Math.abs(hlsVideo.currentTime - elapsed) > 3) {
          try {
            hlsVideo.currentTime = elapsed;
          } catch (e) {}
        }
        if (hlsVideo.paused && state.isTVStarted)holdForBuffer(hlsVideo);
      }
    }
  } else if (
    currentItem.type === "hls" ||
    (streamUrl && streamUrl.includes(".m3u8"))
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
      const isNewUrl = state.currentStreamUrl !== streamUrl;
      state.currentStreamUrl = streamUrl;

      if ((isNewUrl || !state.hlsInstance) && hlsVideo.getAttribute("src")) {
        hlsVideo.removeAttribute("src");
        hlsVideo.load();
      }

      if (Hls.isSupported()) {
        if (isNewUrl || !state.hlsInstance) {
          if (state.hlsInstance) state.hlsInstance.destroy();
          const hls = new Hls({startPosition:elapsed,startLevel:0,maxBufferLength:state.delayedMode?120:60,maxMaxBufferLength:180,maxBufferSize:48*1000*1000,backBufferLength:10,enableWorker:true,
            abrMaxWithRealBitrate:true,abrBandWidthFactor:.7,abrBandWidthUpFactor:.5,abrEwmaFastVoD:3,abrEwmaSlowVoD:12,maxStarvationDelay:4,maxLoadingDelay:4,
            fragLoadPolicy:{default:{...Hls.DefaultConfig.fragLoadPolicy.default,maxTimeToFirstByteMs:10000,maxLoadTimeMs:25000,
              errorRetry:{...Hls.DefaultConfig.fragLoadPolicy.default.errorRetry,maxNumRetry:4,retryDelayMs:1000,maxRetryDelayMs:8000},
              timeoutRetry:{...Hls.DefaultConfig.fragLoadPolicy.default.timeoutRetry,maxNumRetry:3,retryDelayMs:1000,maxRetryDelayMs:8000}}}});
          state.hlsInstance = hls;
          const playlist=variantPlaylist(healthySources(currentItem));
          const masterUrl=playlist ? URL.createObjectURL(new Blob([playlist],{type:'application/vnd.apple.mpegurl'})) : null;
          if(masterUrl)hls.on(Hls.Events.DESTROYING,()=>URL.revokeObjectURL(masterUrl));
          hls.loadSource(masterUrl || streamUrl);
          hls.attachMedia(hlsVideo);
          let recoveryAttempts = 0;

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (state.hlsInstance !== hls) return;
            try {
              if (elapsed > 0) hlsVideo.currentTime = elapsed;
            } catch (e) {}
            hlsVideo.muted = state.isTVStarted ? state.isMuted : true;
            hlsVideo.volume = state.volume / 100;
            applyQuality();if(state.isTVStarted)holdForBuffer(hlsVideo);
          });

          hls.on(Hls.Events.LEVEL_SWITCHED,(_,data)=>{
            if(state.hlsInstance!==hls)return;
            state.sourceQuality=hlsVideo.videoHeight || hls.levels[data.level]?.height || null;notify();
          });
          hls.on(Hls.Events.FRAG_BUFFERED,()=>{
            if(state.hlsInstance!==hls)return;
            recoveryAttempts=0;
            const ahead=bufferedAhead(hlsVideo);state.bufferSeconds=Math.floor(ahead);
            if(state.qualityMode==='auto'){
              if(ahead<8 && state.hasPlayed){hls.autoLevelCapping=Math.max(0,hls.currentLevel-1);lastQualityDrop=Date.now();}
              else if(ahead>25 && Date.now()-lastQualityDrop>30000)hls.autoLevelCapping=-1;
            }
            if(hls.bandwidthEstimate<1800000)state.networkConstrained=true;
            else if(ahead>25 && Date.now()-lastQualityDrop>60000)state.networkConstrained=false;
            notify();
          });
          hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
              if (state.hlsInstance !== hls) return;
              recoveryAttempts++;
              if(data.type===Hls.ErrorTypes.NETWORK_ERROR && (recoveryAttempts>=2 || [403,404,410].includes(data.response?.code)) && tryAlternateSource(hls.levels[data.frag?.level ?? data.context?.level ?? hls.currentLevel]?.url?.[0] || state.currentStreamUrl))return;
              if (recoveryAttempts > 4) {
                state.error =
                  "Источник сейчас не отвечает. Можно повторить подключение или выбрать другой канал.";
                state.buffering = false;
                clearTimeout(sourceLoadTimer);sourceLoadTimer=null;loadingBeganAt=null;cancelBufferGate();
                suggestDelay();hls.destroy();
                state.hlsInstance = null;
                notify();
                return;
              }
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  {
                    const delay = Math.min(15000, 1000 * 2 ** (recoveryAttempts - 1));
                    setTimeout(() => {
                      if (state.hlsInstance === hls) hls.startLoad(hlsVideo.currentTime);
                    }, delay);
                  }
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
          if (hlsVideo.paused && state.isTVStarted)holdForBuffer(hlsVideo);
        }
      } else if (hlsVideo.canPlayType("application/vnd.apple.mpegurl")) {
        if (isNewUrl) {
          hlsVideo.src = streamUrl;
          hlsVideo.currentTime = elapsed;
        }
        hlsVideo.muted = state.isTVStarted ? state.isMuted : true;
        hlsVideo.volume = state.volume / 100;
        hlsVideo.play().catch(() => {});
      }
    }
  }

  if (
    reusingSource &&
    !isYouTubeSource() &&
    hlsVideo?.readyState >= 3 &&
    !hlsVideo.paused
  )
    finishLoading();
  renderVerticalChannelDock();
  renderInspectorGrid();
}

// Update DOM Labels & Details
function updateChannelInfoDOM() {
  notify();
}

// CRT Filter Application
function applyCRT() {
  notify();
}

// Catch-Up TV Mode (Start over & Go Live)

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
      stopRutube();stopPromoMusic();
      const hlsVideo = $("hls-player");
      if (hlsVideo) hlsVideo.pause();
      if (state.ytPlayer && state.ytPlayer.pauseVideo)
        state.ytPlayer.pauseVideo();
      state.isPaused = true;
      state.note = "Таймер сна остановил эфир. Сладких снов!";
      notify();
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
  playbackDelayMs = 0; bufferingSince = null;recentStalls=[];
  state.currentChannelIndex = index;
  playCurrentChannel(true);
}
function renderVerticalChannelDock() {
  notify();
}
function renderInspectorGrid() {
  notify();
}

// -----------------------------------------------------------------------------
// Admin Modal & Ingestion
// -----------------------------------------------------------------------------
function renderAdminSummary() {
  notify();
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
      throw new Error("У этого тайтла пока нет готовых серий.");
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
        sources:[720,480,1080].filter(q=>ep['hls_'+q]).map(quality=>({url:ep['hls_'+quality],quality,type:'hls',provider:'aniliberty'})),
        tvUrl:ep.hls_480 || streamUrl,
        releaseId:data.id,
        ordinal:ordNum,
        poster: poster,
        description: data.description
          ? data.description.replace(/<[^>]+>/g, "").slice(0, 150) + "..."
          : "Аниме AniLibria",
      };
    });

    const playable = items.filter((item) => item.url);
    if (!playable.length)
      throw new Error("У этого тайтла пока нет доступных потоков.");
    state.channels[chIdx].schedule.push(
      ...normalizeChannels([{ schedule: playable }])[0].schedule,
    );
    invalidatePlan(state.channels[chIdx]);
    localStorage.setItem(
      "yturok_schedule_saved",
      JSON.stringify(state.channels),
    );
    let savedRemotely = false;
    try {
      const saveResponse = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state.channels),
      });
      savedRemotely = saveResponse.ok;
    } catch (e) {}

    renderInspectorGrid();
    if (state.currentChannelIndex === chIdx) {
      playCurrentChannel(false);
    }
    return savedRemotely
      ? "Добавлено в общую сетку"
      : "Добавлено в сетку этого браузера";
  } catch (err) {
    throw err;
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
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
function renderCommentInChat() {
  notify();
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
  setInterval(()=>{if(!state.buffering && !state.networkConstrained && navigator.onLine!==false)syncCommentsFromBackend();}, 5000);
}

// Master Periodic Loop
// -----------------------------------------------------------------------------
function startMasterLoop() {
  tickClock();

  setInterval(() => {
    tickClock();
    checkSleepTimerTick();
    notify();

    // Occasional ambient reaction
    if (false) {
      spawnFloatingReaction(
        ["🔥", "🚀", "🍿", "😂"][Math.floor(Math.random() * 4)],
      );
    }

    const channel = state.channels[state.currentChannelIndex];
    if (channel) {
      const { currentItem, elapsed, nextItem, progressPercent } =
        calculateBroadcastPosition(channel);
      if (
        state.currentShow !== currentItem &&
        !state.isCatchUpMode &&
        !state.isPaused
      ) {
        playCurrentChannel(false);
      } else {
        const prog = $("broadcast-progress");
        if (prog) prog.style.width = `${progressPercent}%`;
        text(
          "broadcast-time-text",
          `${formatTime(elapsed)} / ${formatTime(currentItem.duration || 1400)}`,
        );

        // Stream Drift Auto-Correction
        if (!state.delayedMode && !state.buffering && !state.isCatchUpMode && !state.isPaused) {
          if(!['rutube','youtube'].includes(currentItem.type) && !currentItem.youtubeId) {
            const hlsVideo = $("hls-player");
            if (
              hlsVideo &&
              !hlsVideo.paused &&
              currentItem.type !== "bumper" &&
              hlsVideo.duration
            ) {
              const drift = Math.abs(hlsVideo.currentTime - elapsed);
              if (drift > 15 && bufferedAhead(hlsVideo,elapsed)>=8 && elapsed < hlsVideo.duration) {
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

  await loadScheduleFromBackend();
  attachTestChannel();
  startMasterLoop();

  renderVerticalChannelDock();
  renderInspectorGrid();

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

  window.addEventListener('offline',()=>{state.networkConstrained=true;notify();});
  window.addEventListener('online',()=>{
    if(state.isTVStarted && state.buffering && state.hlsInstance)state.hlsInstance.startLoad($("hls-player")?.currentTime || -1);
  });
  const video = $("hls-player");
  if (video) {
    video.addEventListener("resize",()=>{if(video.videoHeight){state.sourceQuality=video.videoHeight;notify();}});
    video.addEventListener("waiting", () => {
      if (isYouTubeSource() || ['bumper','rutube'].includes(state.currentShow?.type) || state.isPaused || !state.isTVStarted) return;
      if(!state.buffering && state.hasPlayed)recentStalls.push(Date.now());
      state.buffering = true;armLoadingTimeout();suggestDelay();
      if(state.hlsInstance && !state.bufferHolding)holdForBuffer(video,true);
      notify();
    });
    video.addEventListener("playing", () => {
      if (!isYouTubeSource()) {
        if(state.bufferHolding){video.pause();return;}
        finishLoading();
        if(state.delayedMode && !state.isCatchUpMode){
          const position=calculateBroadcastPosition(state.channels[state.currentChannelIndex]);
          if(position.currentItem===state.currentShow)playbackDelayMs=Math.max(0,playbackDelayMs+(position.elapsed-video.currentTime)*1000);
        }
      }
    });
    video.addEventListener("error", () => {
      if (['rutube','bumper'].includes(state.currentShow?.type) || state.currentShow?.type === "youtube" || state.currentShow?.youtubeId)
        return;
      state.buffering = false;
      clearTimeout(sourceLoadTimer);
      if(tryAlternateSource())return;
      state.error = "Не удалось подключиться к видео. Попробуйте другой канал.";
      notify();
    });
    video.addEventListener("ended", () => {
      if (
        !['youtube','rutube','bumper'].includes(state.currentShow?.type) &&
        !state.currentShow?.youtubeId
      )
        waitForNextBroadcast();
    });
  }
  state.ready = true;
  // Start background playback (muted initially for browser autoplay policy)
  playCurrentChannel(false);

  // Background non-blocking sync
  syncAtomicTime().catch(() => {});
  notify();
}

const subscribers = new Set();
let snapshot;
let catalog = { items: [], message: "" };
function renderCatalog(value) {
  catalog = value;
  notify();
}
function renderSyncButton() {
  notify();
}
function makeSnapshot() {
  const channel = state.channels[state.currentChannelIndex];
  let position = channel ? calculateBroadcastPosition(channel) : {};
  if ((state.isCatchUpMode || state.isPaused) && state.currentShow) {
    const item = state.currentShow;
    let elapsed = 0;
    try {
      elapsed =
        item.type === 'rutube' ? rutubeTime() : item.type === "youtube" || item.youtubeId
          ? state.ytPlayer?.getCurrentTime?.() || 0
          : $("hls-player")?.currentTime || 0;
    } catch {}
    position = {
      ...position,
      currentItem: item,
      elapsed,
      progressPercent: Math.min(
        100,
        Math.floor((elapsed / (item.mediaDuration || item.duration || 1440)) * 100),
      ),
    };
  }
  return {
    ...state,
    channels: state.channels.map((channel, index) => ({
      channel,
      index,
      ...calculateBroadcastPosition(channel),
    })),
    comments: [...state.commentsList],
    channel,
    position,
    catalog,
    clock: new Date(getSyncedTimestamp()).toLocaleTimeString("ru-RU", {
      timeZone: "Asia/Yekaterinburg",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}
function notify() {
  state.bufferSeconds=Math.floor(bufferedAhead($("hls-player")));
  state.delaySeconds=Math.round((playbackDelayMs+(bufferingSince===null?0:Date.now()-bufferingSince))/1000);
  state.allowPromoVideo=state.qualityMode!=='low' && !state.networkConstrained;
  setNetworkBudget(Boolean(state.buffering || state.bufferHolding || state.networkConstrained));
  snapshot = makeSnapshot();
  subscribers.forEach((listener) => listener());
}
export function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}
export function getSnapshot() {
  return (snapshot ||= makeSnapshot());
}
function action(fn) {
  const result = fn();
  notify();
  return result;
}
function resumeActivePlayer() {
  if(state.currentShow?.type==='rutube'){resumeRutube();return;}
  if (state.currentShow?.type === "bumper") {
    const channel = state.channels[state.currentChannelIndex];
    const { elapsed } = calculateBroadcastPosition(channel);
    startPromoMusic(channel, state.currentShow, elapsed, state.isMuted ? 0 : state.volume / 100);
    return;
  }
  if (state.currentShow?.type === "youtube" || state.currentShow?.youtubeId)
    state.ytPlayer?.playVideo?.();
  else
    $("hls-player")
      ?.play()
      .catch(() => {});
}
export const tv = {
  quality(mode){
    if(!['auto','best','low'].includes(mode))return;
    return action(()=>{
      state.qualityMode=mode;localStorage.setItem('yturok_quality',mode);
      if(state.hlsInstance?.levels?.length)applyQuality(true);
      else if(['hls','video','mp4'].includes(state.currentShow?.type)){
        const source=mediaSource(state.currentShow,sourceTarget());
        if(source?.url && source.url!==state.currentStreamUrl){rememberMediaPosition();playCurrentChannel(false);}
      }
    });
  },
  delay(enabled=true){
    return action(()=>{
      if(state.delayedMode===Boolean(enabled))return;
      state.delayedMode=Boolean(enabled);state.delaySuggested=false;
      if(!enabled){
        state.delayDismissed=true;playbackDelayMs=0;bufferingSince=null;
        cancelBufferGate();if(state.hlsInstance)state.hlsInstance.config.maxBufferLength=60;
        playCurrentChannel(false);return;
      }
      const video=$("hls-player"),channel=state.channels[state.currentChannelIndex];
      const position=calculateBroadcastPosition(channel);
      if(video?.readyState>=1 && ['hls','video','mp4'].includes(state.currentShow?.type))
        playbackDelayMs=Math.max(0,(position.elapsed-video.currentTime)*1000);
      bufferingSince=null;
      if(state.hlsInstance)state.hlsInstance.config.maxBufferLength=120;
      if(['hls','video','mp4'].includes(state.currentShow?.type)){
        if(state.error){clearTimeout(sourceLoadTimer);sourceLoadTimer=null;loadingBeganAt=null;state.currentStreamUrl=null;playCurrentChannel(false);}
        cancelBufferGate();holdForBuffer(video,true,10000);
      }else if(state.buffering)beginBuffering();
    });
  },
  dismissDelay(){return action(()=>{state.delaySuggested=false;state.delayDismissed=true;});},
  testMode(enabled) {
    return action(()=>{
      state.testMode=Boolean(enabled);localStorage.setItem("yturok_test_mode",state.testMode);
      const wasTest=state.channels[state.currentChannelIndex]?.id==="test-lab";
      attachTestChannel();
      if(wasTest && !enabled){state.currentChannelIndex=0;playCurrentChannel(false);}
    });
  },
  testPlay(item) {
    if(!state.testMode || !item)return;
    return action(()=>{
      testSequence=[{...item,sourceOffset:0}];testStartedAt=playbackTimestamp();
      state.currentChannelIndex=state.channels.findIndex(c=>c.id==="test-lab");
      state.isTVStarted=true;state.isPaused=false;playCurrentChannel(false);
    });
  },
  testPromo(item) {
    if(!state.testMode || !item)return;
    return action(()=>{
      const current=state.currentShow;
      const isTest=state.channels[state.currentChannelIndex]?.id==="test-lab";
      let offset=0;try{offset=current?.type==='youtube' ? state.ytPlayer?.getCurrentTime?.()||0 : current?.type==='rutube' ? rutubeTime() : $("hls-player")?.currentTime||0;}catch{}
      const continuation=isTest && current?.type!=="bumper" ? {...current,sourceOffset:offset,duration:Math.max(1,(current.mediaDuration||current.duration)-offset),mediaDuration:current.mediaDuration||current.duration} : {...item,sourceOffset:0};
      testSequence=[{title:`Анонс: ${item.title}`,episode:"Ручной запуск анонса",type:"bumper",kind:"promo",duration:30,promoTitle:item.title,poster:item.poster,promoYoutubeId:item.youtubeId,promoVideoUrl:['hls','mp4','video'].includes(item.type)?(mediaSource(item,sourceTarget())?.url || item.url):undefined,promoVideoType:item.type},continuation];
      testStartedAt=playbackTimestamp();state.currentChannelIndex=state.channels.findIndex(c=>c.id==="test-lab");
      state.isTVStarted=true;state.isPaused=false;playCurrentChannel(false);
    });
  },
  select(index) {
    if (!state.ready || !state.channels[index]) return;
    return action(() => {
      state.error = null;
      state.isPaused = false;
      playbackDelayMs = 0; bufferingSince = null;recentStalls=[];
  state.currentChannelIndex = index;
      playCurrentChannel(false);
    });
  },
  next(delta = 1) {
    this.select(
      (state.currentChannelIndex + delta + state.channels.length) %
        state.channels.length,
    );
  },
  start() {
    return action(() => {
      state.isTVStarted = true;
      state.isPaused = false;
      state.isMuted = false;
      applyVolume();
      if(["hls","video","mp4"].includes(state.currentShow?.type))holdForBuffer($("hls-player"));else resumeActivePlayer();
    });
  },
  suspend() {
    cancelBufferGate();
    if(!state.isTVStarted)return;
    state.isPaused=true;
    $("hls-player")?.pause();state.ytPlayer?.pauseVideo?.();stopRutube();stopPromoMusic();notify();
  },
  resume() {
    if(state.isTVStarted && state.isPaused)action(()=>playCurrentChannel(false));
  },
  sourceFailure() {
    if (state.currentShow?.type === "youtube" || state.currentShow?.youtubeId)
      return action(() => {
        state.error =
          "YouTube не подключился. Проверь соединение или выбери другой канал.";
        state.buffering = false;
        clearTimeout(sourceLoadTimer);
      });
  },
  mute() {
    return action(() => {
      state.isMuted = !state.isMuted;
      applyVolume();
    });
  },
  volume(value) {
    return action(() => {
      state.volume = Number(value);
      state.isMuted = state.volume === 0;
      applyVolume();
    });
  },
  crt() {
    return action(() => {
      state.crtEnabled = !state.crtEnabled;
      localStorage.setItem("yturok_crt_enabled", state.crtEnabled);
    });
  },
  danmaku() {
    return action(() => toggleDanmaku());
  },
  ticker() {
    return action(() => toggleTicker());
  },
  sleep() {
    return action(() => handleSleepTimerToggle());
  },
  restart() {
    return action(() => {
      state.isCatchUpMode = true;
      if(state.currentShow?.type==='rutube'){rutubeSeek(0);return;}
      const video = $("hls-player");
      if (video) video.currentTime = 0;
      state.ytPlayer?.seekTo?.(0, true);
    });
  },
  live() {
    state.delayedMode=false;state.delaySuggested=false;state.delayDismissed=true;
    playbackDelayMs = 0; bufferingSince = null;recentStalls=[];
    return action(() => playCurrentChannel(false));
  },
  async sync() {
    await syncAtomicTime();
    return action(() => playCurrentChannel(false));
  },
  retry() {
    resetSourceFailures(state.currentShow);clearTimeout(sourceLoadTimer);sourceLoadTimer=null;loadingBeganAt=null;
    return action(() => {
      state.error = null;
      state.currentYtId = null;
      state.currentStreamUrl = null;
      state.hlsInstance?.destroy();
      state.hlsInstance = null;
      if (
        !window.YT &&
        (state.currentShow?.type === "youtube" || state.currentShow?.youtubeId)
      ) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.onerror = () => tv.sourceFailure();
        document.head.appendChild(script);
      }
      playCurrentChannel(false);
    });
  },
  async comment(text) {
    await handleUserCommentSubmit(text);
    notify();
  },
  reaction(emoji) {
    spawnFloatingReaction(emoji);
  },
  search: searchAdminCatalog,
  addRelease: addReleaseToChannel,
  schedule(channelId, day = 0) {
    const channel =
      state.channels.find((channel) => channel.id === channelId) ||
      state.channels[0];
    if (!channel?.schedule?.length) return [];
    const timestamp = getSyncedTimestamp() + day * 86400000;
    const clock = seconds => new Date(seconds * 1000).toLocaleTimeString("ru-RU", {
      timeZone:"Asia/Yekaterinburg",hour:"2-digit",minute:"2-digit",
    });
    return broadcastRows(channel,timestamp).map(({item,start,repeat,duration})=>({
      item,start:clock(start),end:clock(start+duration),repeat,
      live:day===0 && start<=timestamp/1000 && start+duration>timestamp/1000,
      duration:formatTime(duration),
    }));
  },
};
