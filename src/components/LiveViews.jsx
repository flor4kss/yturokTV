import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";

const roots = new WeakMap();
function render(id, view) {
  const container = document.getElementById(id);
  if (!container) return;
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  flushSync(() => root.render(view));
}
const poster =
  "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=100";
const Icon = ({ children }) => (
  <span className="material-symbols-outlined text-[17px]">{children}</span>
);

function ChannelList({ channels, activeId, onSelect }) {
  return channels.map((channel) => (
    <button
      key={channel.id}
      className={`rail-channel-btn ${channel.id === activeId ? "active" : ""}`}
      onClick={() => onSelect(channel)}
      title={channel.tagline}
    >
      <div className="w-7 h-7 rounded-lg bg-black/40 flex items-center justify-center">
        <Icon>{channel.icon || "tv"}</Icon>
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex justify-between gap-1">
          <span className="text-[11px] font-bold text-white truncate">
            {channel.shortName || channel.name}
          </span>
          <span className="text-[9px] font-mono">{channel.number}</span>
        </div>
        <span className="text-[9px] text-gray-400 truncate">
          {channel.badge || channel.categoryName}
        </span>
      </div>
      {channel.id === activeId && (
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      )}
    </button>
  ));
}
function StreamCards({ entries, onSelect }) {
  return entries.map(({ channel, currentItem, nextItem, progressPercent }) => (
    <button
      key={channel.id}
      className="p-3 rounded-2xl bg-[#141520] hover:bg-[#1c1d2c] transition flex flex-col gap-2 border border-white/5 text-left"
      onClick={() => onSelect(channel)}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-white">
          <Icon>{channel.icon || "tv"}</Icon> {channel.number}{" "}
          {channel.shortName || channel.name}
        </span>
        <span className="text-gray-400">{progressPercent}%</span>
      </div>
      <div className="flex gap-2.5">
        <img
          src={currentItem.poster || poster}
          alt=""
          className="w-10 h-14 object-cover rounded-xl"
        />
        <div className="min-w-0">
          <span className="text-[9px] text-emerald-300">
            {currentItem.badgeTag || "⭐ ПРЕМЬЕРА"}
          </span>
          <div className="text-xs font-bold text-white truncate">
            {currentItem.title}
          </div>
          <div className="text-[10px] text-purple-300">
            {currentItem.episode}
          </div>
        </div>
      </div>
      <div className="w-full bg-black/50 h-1.5 rounded-full overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: channel.color || "#06b6d4",
          }}
        />
      </div>
      <div className="text-[10px] text-gray-400 truncate">
        Далее: {nextItem?.title || "—"}
      </div>
    </button>
  ));
}
function ScheduleRows({ rows, onWatch }) {
  if (!rows.length)
    return (
      <p className="text-center py-12 text-gray-400 text-xs">
        В сетке этого канала пока нет передач.
      </p>
    );
  return rows.map(({ item, start, end, live, duration }, index) => (
    <div
      key={`${index}-${start}`}
      className={`p-3 rounded-2xl flex items-center justify-between gap-3 ${live ? "bg-purple-950/40 border border-purple-500/40" : "bg-[#181926]"}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col w-14 py-1 rounded-xl bg-black/40 text-center font-mono">
          <span className="text-xs text-white">{start}</span>
          <span className="text-[9px] text-gray-400">{end}</span>
        </div>
        <img
          src={item.poster || poster}
          alt=""
          className="w-10 h-12 rounded-xl object-cover"
        />
        <div className="min-w-0">
          <div className="flex gap-2 text-[9px]">
            {live && <span className="text-rose-300">В ЭФИРЕ СЕЙЧАС</span>}
            <span className="text-emerald-300">
              {item.badgeTag || "⭐ ПРЕМЬЕРА"}
            </span>
            <span className="text-gray-400">{duration}</span>
          </div>
          <h4 className="font-bold text-xs text-white truncate">
            {item.title}
          </h4>
          <p className="text-[10px] text-purple-300">
            {item.episode || item.description}
          </p>
        </div>
      </div>
      {live && (
        <button className="m3-chip active" onClick={onWatch}>
          Смотреть
        </button>
      )}
    </div>
  ));
}
function ChatMessages({ comments }) {
  return comments.map((comment) => (
    <div
      key={comment.id}
      className="chat-message-item p-2 rounded-xl bg-white/[0.04] border border-white/5 flex flex-col gap-1"
    >
      <div className="flex justify-between text-[10px]">
        <span className="text-cyan-300">
          {comment.author || "Зритель"} · {comment.channelName || "Эфир"}
        </span>
        <span className="text-gray-500">{comment.timeStr}</span>
      </div>
      <div
        className="text-xs font-semibold break-words"
        style={{
          color: /^#[0-9a-f]{3,8}$/i.test(comment.color || "")
            ? comment.color
            : "#fff",
        }}
      >
        {comment.text}
      </div>
    </div>
  ));
}
export function renderChannels(props) {
  render("vertical-channel-dock", <ChannelList {...props} />);
}
export function renderStreams(props) {
  render("inspector-grid", <StreamCards {...props} />);
}
export function renderSchedule(props) {
  render("epg-schedule-list", <ScheduleRows {...props} />);
}
export function renderChat(comments) {
  render("live-chat-messages", <ChatMessages comments={comments} />);
}
export function renderChannelTabs({ channels, activeId, onSelect }) {
  render(
    "epg-tabs",
    <>
      {channels.map((channel) => (
        <button
          key={channel.id}
          className={`m3-chip ${channel.id === activeId ? "active" : ""}`}
          onClick={() => onSelect(channel)}
        >
          <Icon>{channel.icon || "tv"}</Icon> {channel.number}{" "}
          {channel.shortName || channel.name}
        </button>
      ))}
    </>,
  );
}
export function renderAdmin(entries) {
  render(
    "admin-channels-summary",
    <>
      {entries.map(({ channel, currentItem, hours }) => (
        <div
          key={channel.id}
          className="p-3 rounded-2xl bg-[#141520] border border-white/5"
        >
          <div className="flex justify-between text-xs text-white">
            <strong>
              {channel.number} {channel.name}
            </strong>
            <span className="text-purple-300">
              {channel.schedule.length} передач (~{hours}ч)
            </span>
          </div>
          <p className="text-[11px] text-gray-300">
            Сейчас: {currentItem.title} ({currentItem.episode})
          </p>
        </div>
      ))}
    </>,
  );
}

function CatalogCard({ item, onAdd }) {
  const [pending, setPending] = useState(null);
  const [done, setDone] = useState([]);
  const title = item.name?.main || "Без названия";
  const image = item.poster?.src
    ? `https://anilibria.top${item.poster.src}`
    : poster;
  async function add(index) {
    setPending(index);
    try {
      await onAdd(item.alias, title, image, index);
      setDone((previous) => [...previous, index]);
    } finally {
      setPending(null);
    }
  }
  return (
    <div className="p-2.5 rounded-2xl bg-[#181926] flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <img src={image} alt="" className="w-10 h-14 object-cover rounded-xl" />
        <div className="min-w-0">
          <h5 className="font-bold text-xs text-white truncate">{title}</h5>
          <p className="text-[10px] text-gray-400">
            {item.name?.english} ({item.year})
          </p>
        </div>
      </div>
      <div className="flex gap-1.5">
        {["УТРО", "ДЕНЬ", "ВЕЧЕР"].map((label, index) => (
          <button
            key={index}
            className="m3-chip text-[10px]"
            disabled={pending !== null}
            onClick={() => add(index)}
          >
            {pending === index
              ? "…"
              : done.includes(index)
                ? "✓"
                : `+ ${label}`}
          </button>
        ))}
      </div>
    </div>
  );
}
export function renderCatalog({ items = [], message, onAdd }) {
  render(
    "admin-search-results",
    message ? (
      <p className="text-center py-12 text-gray-400 text-xs">{message}</p>
    ) : (
      <>
        {items.map((item) => (
          <CatalogCard key={item.id || item.alias} item={item} onAdd={onAdd} />
        ))}
      </>
    ),
  );
}
export function renderSyncBadge() {
  render(
    "sync-indicator-badge",
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{" "}
      СИНХРОН (ЕКБ • UTC+5)
    </>,
  );
}
export function renderSyncButton(mode) {
  render(
    "btn-sync-live",
    <>
      <span
        className={`material-symbols-outlined text-[16px] ${mode === "loading" ? "animate-spin" : mode === "done" ? "text-emerald-400" : ""}`}
      >
        {mode === "done" ? "check" : "sync"}
      </span>
      <span className="hidden md:inline text-[11px]">
        {mode === "loading" ? "Синхрон…" : "Синхрон"}
      </span>
    </>,
  );
}
function ChannelLogo({ channel }) {
  const kind =
    channel.logoSvg ||
    (channel.category === "anime"
      ? "animehit"
      : channel.category === "minecrafters"
        ? "cyber"
        : "toonster");
  if (kind === "2x2")
    return (
      <svg viewBox="0 0 44 28" className="w-6 h-5">
        <rect width="44" height="28" rx="6" fill="#f59e0b" />
        <text
          x="22"
          y="20"
          fontFamily="system-ui"
          fontWeight="900"
          fontSize="16"
          textAnchor="middle"
          fill="#08090e"
        >
          2x2
        </text>
      </svg>
    );
  if (kind === "animehit")
    return (
      <svg viewBox="0 0 36 36" className="w-5 h-5">
        <circle cx="18" cy="18" r="16" fill="#f43f5e" />
        <path
          d="M10 10h16 M12 16h12 M14 10v16 M22 10v16"
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  if (kind === "cyber")
    return (
      <svg viewBox="0 0 36 36" className="w-5 h-5">
        <rect width="32" height="32" x="2" y="2" rx="7" fill="#a855f7" />
        <path d="M9 14h18v8h-5l-4 4-4-4H9z" fill="#08090e" />
        <circle cx="14" cy="17" r="2" fill="#22d3ee" />
        <circle cx="22" cy="17" r="2" fill="#22d3ee" />
      </svg>
    );
  return (
    <svg viewBox="0 0 40 32" className="w-6 h-5">
      <rect width="36" height="26" x="2" y="5" rx="7" fill="#06b6d4" />
      <path
        d="M13 18a5 5 0 0 0 14 0"
        stroke="#08090e"
        strokeWidth="2.5"
        fill="none"
      />
      <circle cx="15" cy="13" r="2" fill="#08090e" />
      <circle cx="25" cy="13" r="2" fill="#08090e" />
    </svg>
  );
}
export function renderLogo(channel) {
  render("watermark-logo-slot", <ChannelLogo channel={channel} />);
}
