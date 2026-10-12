export function promoMessage(item, elapsed, timestamp = Date.now()) {
  const startsAt = timestamp + Math.max(0, item.duration - elapsed) * 1000;
  const time = new Date(startsAt).toLocaleTimeString('ru-RU', {
    timeZone: 'Asia/Yekaterinburg', hour: '2-digit', minute: '2-digit',
  });
  const sameDay = new Date(timestamp).toLocaleDateString('ru-RU', {timeZone:'Asia/Yekaterinburg'}) ===
    new Date(startsAt).toLocaleDateString('ru-RU', {timeZone:'Asia/Yekaterinburg'});
  return `${sameDay ? 'Сегодня' : 'Завтра'} в ${time} — ${item.promoTitle}. Не пропусти!`;
}
