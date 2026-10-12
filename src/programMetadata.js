export function cleanEpisode(value = "") {
  const text = String(value).replace(/\s+/g, " ").trim();
  const duplicate = text.match(
    /^(Серия|Выпуск)\s*(\d+)\s*[:—-]\s*\1\s*\2(?:\s*[:—-]\s*(.*))?$/iu,
  );
  return duplicate
    ? `${duplicate[1]} ${duplicate[2]}${duplicate[3] ? `: ${duplicate[3]}` : ""}`
    : text;
}
export function usablePoster(value) {
  return typeof value === "string" &&
    /^https?:\/\//i.test(value) &&
    !/(?:unsplash\.com|picsum\.photos)/i.test(value)
    ? value
    : undefined;
}
export function normalizeChannels(channels) {
  const covers = new Map();
  for (const channel of channels)
    for (const item of channel.schedule || []) {
      const poster = usablePoster(item.poster);
      if (poster && !covers.has(item.title?.trim()))
        covers.set(item.title?.trim(), poster);
    }
  return channels.map((channel) => ({
    ...channel,
    schedule: (channel.schedule || []).map((item) => ({
      ...item,
      title: String(item.title || "Прямой эфир").trim(),
      episode: cleanEpisode(item.episode),
      poster: usablePoster(item.poster) || covers.get(item.title?.trim()),
    })),
  }));
}
export function remainingLabel(duration, elapsed = 0) {
  if (!Number.isFinite(duration) || duration <= 0) return "";
  const seconds = Math.max(0, duration - elapsed);
  const minutes = Math.ceil(seconds / 60);
  if (minutes >= 60)
    return `Осталось ${Math.floor(minutes / 60)} ч${minutes % 60 ? ` ${minutes % 60} мин` : ""}`;
  return seconds <= 30
    ? "Передача завершается"
    : `Осталось ${Math.ceil(seconds / 60)} мин`;
}
