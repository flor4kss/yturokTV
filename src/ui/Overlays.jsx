import { useState } from "react";
import Icon from "./Icon";
import Poster from "./Poster";
import { tv } from "../tvController";
export function ProgramGuide({ snapshot, onWatch }) {
  const [channelId, setChannelId] = useState(snapshot.channel?.id);
  const [day, setDay] = useState(0);
  const rows = tv.schedule(channelId, day);
  const channel =
    snapshot.channels.find((entry) => entry.channel.id === channelId) ||
    snapshot.channels[0];
  return (
    <>
      <div className="guide-filters">
        <label className="select-field">
          <span>Канал</span>
          <select
            aria-label="Канал телепрограммы"
            value={channelId}
            onChange={(event) => setChannelId(event.target.value)}
          >
            {snapshot.channels.map(({ channel }) => (
              <option key={channel.id} value={channel.id}>
                {channel.number} · {channel.shortName || channel.name}
              </option>
            ))}
          </select>
          <Icon name="down" size={17} />
        </label>
        <div className="day-tabs" aria-label="День телепрограммы">
          {["Сегодня", "Завтра", "Послезавтра"].map((label, index) => (
            <button
              key={label}
              className={day === index ? "is-active" : ""}
              aria-pressed={day === index}
              onClick={() => setDay(index)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="guide-timezone">
        <Icon name="clock" size={14} /> Время Екатеринбурга · UTC+5
      </p>
      <div className="guide-list">
        {rows.length ? (
          rows.map(({ item, start, end, live, repeat }, index) => (
            <article
              className={`guide-row ${live ? "is-live" : ""}`}
              key={`${index}-${start}`}
            >
              <div className="guide-time">
                <strong>{start}</strong>
                <span>{end}</span>
              </div>
              <Poster
                src={item.poster}
                title={item.title}
                color={channel?.channel.color}
              />
              <div className="guide-copy">
                {live && (
                  <span className="live-label">
                    <span className="live-dot" /> СЕЙЧАС
                  </span>
                )}
                <h3>{item.title}</h3>
                <p>{repeat ? "Повтор · " : ""}{item.episode || item.description || "История в эфире"}</p>
              </div>
              {live && (
                <button
                  className="button button-coral"
                  onClick={() => onWatch(channel.index)}
                >
                  <Icon name="play" size={15} fill="currentColor" /> Смотреть
                </button>
              )}
            </article>
          ))
        ) : (
          <div className="empty-state">
            <Icon name="moon" size={30} />
            <strong>Канал отдыхает</strong>
            <p>Расписание появится чуть позже.</p>
          </div>
        )}
      </div>
    </>
  );
}
export function SwitchRow({ icon, title, description, checked, onChange }) {
  return (
    <div className="setting-row">
      <span className="setting-icon">
        <Icon name={icon} size={20} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <button
        className={`switch ${checked ? "is-on" : ""}`}
        role="switch"
        aria-label={title}
        aria-checked={checked}
        onClick={onChange}
      >
        <span />
      </button>
    </div>
  );
}
export function Settings({
  snapshot,
  sounds,
  onSounds,
  night,
  onNight,
  onStudio,
}) {
  return (
    <>
      <p className="modal-description">
        Устройся поудобнее. Здесь всё под тебя.
      </p>
      <div className="settings-group">
        <SwitchRow
          icon="audio"
          title="Звуки прикосновений"
          description="Тихие отклики на нажатия и смену каналов"
          checked={sounds}
          onChange={onSounds}
        />
        <SwitchRow
          icon="moon"
          title="Вечерняя комната"
          description="Мягкая тёмная палитра для позднего просмотра"
          checked={night}
          onChange={onNight}
        />
        <SwitchRow
          icon="chat"
          title="Комментарии на экране"
          description="Маленькие мысли, пролетающие вместе с историей"
          checked={snapshot.danmakuEnabled}
          onChange={() => tv.danmaku()}
        />
        <SwitchRow
          icon="tv"
          title="Немного ностальгии"
          description="Лёгкий эффект старого телевизора"
          checked={snapshot.crtEnabled}
          onChange={() => tv.crt()}
        />
      </div>
      <div className="settings-quick">
        <button onClick={() => tv.sleep()}>
          <Icon name="moon" />
          <span>
            Таймер сна
            <strong>
              {snapshot.sleepTimerMinutes
                ? `${snapshot.sleepTimerMinutes} мин`
                : "Выключен"}
            </strong>
          </span>
          <Icon name="right" size={16} />
        </button>
      </div>
      <div className="keyboard-help">
        <p className="eyebrow">ТВОЙ МАЛЕНЬКИЙ ПУЛЬТ</p>
        <div>
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> каналы
          </span>
          <span>
            <kbd>M</kbd> звук
          </span>
          <span>
            <kbd>F</kbd> полный экран
          </span>
        </div>
      </div>
      <button className="studio-link" onClick={onStudio}>
        <Icon name="sliders" size={18} />
        <span>Собрать свою сетку эфира</span>
        <Icon name="arrowUp" size={17} />
      </button>
    </>
  );
}
function CatalogItem({ item, channels, onToast }) {
  const [channel, setChannel] = useState(0);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const title = item.name?.main || "Без названия";
  const poster = item.poster?.src
    ? `https://anilibria.top${item.poster.src}`
    : undefined;
  async function add() {
    setPending(true);
    try {
      const result = await tv.addRelease(item.alias, title, poster, channel);
      setDone(true);
      onToast(result || "История добавлена");
    } catch (error) {
      onToast(error.message || "Не удалось добавить историю");
    } finally {
      setPending(false);
    }
  }
  return (
    <article className="catalog-item">
      <Poster src={poster} title={title} />
      <div className="catalog-copy">
        <h3>{title}</h3>
        <p>
          {item.name?.english} {item.year && `· ${item.year}`}
        </p>
        <div>
          <select
            aria-label={`Канал для добавления ${title}`}
            value={channel}
            onChange={(event) => {
              setChannel(Number(event.target.value));
              setDone(false);
            }}
          >
            {channels.map(({ channel }, index) => (
              <option key={channel.id} value={index}>
                {channel.shortName || channel.name}
              </option>
            ))}
          </select>
          <button
            className={`button ${done ? "button-soft" : "button-coral"}`}
            disabled={pending || done}
            onClick={add}
          >
            <Icon
              name={pending ? "loader" : done ? "check" : "sparkles"}
              size={15}
              className={pending ? "spin" : ""}
            />
            {pending ? "Добавляем…" : done ? "Добавлено" : "Добавить"}
          </button>
        </div>
      </div>
    </article>
  );
}
export function Studio({ snapshot, onToast }) {
  const [query, setQuery] = useState("");
  return (
    <>
      <p className="modal-description">
        Добавь любимые истории в свою волну.{" "}
        {snapshot.backendAvailable
          ? "Изменения попадут в общую сетку."
          : "Твоя сетка сохранится в этом браузере."}
      </p>
      <form
        className="studio-search"
        onSubmit={(event) => {
          event.preventDefault();
          tv.search(query);
        }}
      >
        <label className="search-field">
          <Icon name="search" size={19} />
          <input
            aria-label="Поиск аниме в каталоге"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Например, Семья шпиона"
          />
        </label>
        <button className="button button-dark" disabled={!query.trim()}>
          Найти <Icon name="arrowRight" size={17} />
        </button>
      </form>
      <div className="catalog-results">
        {snapshot.catalog.items?.length ? (
          snapshot.catalog.items.map((item) => (
            <CatalogItem
              key={item.alias || item.id}
              item={item}
              channels={snapshot.channels}
              onToast={onToast}
            />
          ))
        ) : (
          <div className="empty-state">
            <Icon name="sparkles" size={30} />
            <strong>
              {snapshot.catalog.message || "Какую историю ты ищешь?"}
            </strong>
            <p>Начни с названия любимого аниме.</p>
          </div>
        )}
      </div>
    </>
  );
}
