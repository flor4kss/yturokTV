import { useEffect, useRef, useState } from "react";
import Icon, { categoryIcon } from "./Icon";
import Poster from "./Poster";
import { tv } from "../tvController";
const categories = [
  { id: "all", label: "Все", icon: "grid" },
  { id: "anime", label: "Аниме", icon: "sparkles" },
  { id: "cartoons", label: "Мульты", icon: "palette" },
  { id: "minecrafters", label: "Игры", icon: "game" },
  { id: "music", label: "Музыка", icon: "music" },
];
export function ChannelRail({
  snapshot,
  favorites,
  onFavorite,
  onSelect,
  searchRef,
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const normalized = query.trim().toLowerCase();
  const filtered = snapshot.channels.filter(
    ({ channel }) =>
      (category === "all" || channel.category === category) &&
      (!onlyFavorites || favorites.includes(channel.id)) &&
      (!normalized ||
        `${channel.name} ${channel.shortName} ${channel.categoryName}`
          .toLowerCase()
          .includes(normalized) ||
        channel.schedule?.some((item) =>
          item.title?.toLowerCase().includes(normalized),
        )),
  );
  return (
    <aside className="channel-panel" aria-label="Список каналов">
      <div className="section-label-row">
        <div>
          <p className="eyebrow">ВЫБЕРИ НАСТРОЕНИЕ</p>
          <h2>
            Твои каналы<span>{snapshot.channels.length}</span>
          </h2>
        </div>
        <button
          className={`icon-button ${onlyFavorites ? "is-favorite" : ""}`}
          aria-label={
            onlyFavorites ? "Показать все каналы" : "Показать избранные каналы"
          }
          aria-pressed={onlyFavorites}
          onClick={() => setOnlyFavorites(!onlyFavorites)}
        >
          <Icon
            name="heart"
            size={18}
            fill={onlyFavorites ? "currentColor" : "none"}
          />
        </button>
      </div>
      <label className="search-field">
        <Icon name="search" size={17} />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Канал или аниме…"
          aria-label="Поиск каналов или аниме"
        />
        {query && (
          <button aria-label="Очистить поиск" onClick={() => setQuery("")}>
            <Icon name="close" size={15} />
          </button>
        )}
      </label>
      <div className="channel-categories" aria-label="Категории каналов">
        {categories.map((item) => (
          <button
            key={item.id}
            className={category === item.id ? "is-active" : ""}
            aria-pressed={category === item.id}
            onClick={() => setCategory(item.id)}
            title={item.label}
          >
            <Icon name={item.icon} size={15} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="channel-list">
        {filtered.length ? (
          filtered.map(({ channel, index, currentItem }) => (
            <div
              key={channel.id}
              className={`channel-item ${snapshot.currentChannelIndex === index ? "is-active" : ""}`}
            >
              <button
                className="channel-select"
                onClick={() => onSelect(index)}
                data-sound="channel"
                aria-pressed={snapshot.currentChannelIndex === index}
              >
                <span className={`channel-glyph category-${channel.category}`}>
                  <Icon name={categoryIcon(channel.category)} size={20} />
                </span>
                <span className="channel-copy">
                  <strong>{channel.shortName || channel.name}</strong>
                  <small>{currentItem.title}</small>
                </span>
                <span className="channel-id">{channel.number}</span>
              </button>
              <button
                className={`channel-heart ${favorites.includes(channel.id) ? "is-favorite" : ""}`}
                aria-label={`${favorites.includes(channel.id) ? "Убрать" : "Добавить"} ${channel.shortName || channel.name} ${favorites.includes(channel.id) ? "из избранного" : "в избранное"}`}
                aria-pressed={favorites.includes(channel.id)}
                data-sound="favorite"
                onClick={() => onFavorite(channel.id)}
              >
                <Icon
                  name="heart"
                  size={14}
                  fill={
                    favorites.includes(channel.id) ? "currentColor" : "none"
                  }
                />
              </button>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <Icon name={onlyFavorites ? "heart" : "search"} size={28} />
            <strong>
              {onlyFavorites ? "Собери свою волну" : "Пока ничего не нашлось"}
            </strong>
            <p>
              {onlyFavorites
                ? "Нажми на сердечко у любимого канала."
                : "Попробуй другое название или категорию."}
            </p>
            <button
              className="text-button"
              onClick={() => {
                setCategory("all");
                setQuery("");
                setOnlyFavorites(false);
              }}
            >
              Показать все каналы <Icon name="arrowRight" />
            </button>
          </div>
        )}
      </div>
      <div className="remote-hint">
        <span>Маленький пульт</span>
        <div>
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          <small>каналы</small>
          <kbd>M</kbd>
          <small>звук</small>
        </div>
      </div>
    </aside>
  );
}
export function CommunityPanel({ snapshot, onSelect, onAllChannels, onToast }) {
  const [tab, setTab] = useState("streams");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const chatRef = useRef();
  const atBottom = useRef(true);
  useEffect(() => {
    if (atBottom.current && chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [snapshot.comments.length]);
  const entries = snapshot.channels
    .filter((entry) => entry.index !== snapshot.currentChannelIndex)
    .slice(0, 4);
  async function send(event) {
    event.preventDefault();
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await tv.comment(message.slice(0, 90));
      setMessage("");
      atBottom.current = true;
    } catch {
      onToast("Не удалось отправить сообщение. Попробуй ещё раз.");
    } finally {
      setSending(false);
    }
  }
  return (
    <aside className="community-panel" aria-label="Другие эфиры и чат">
      <div className="side-tabs" role="tablist" aria-label="Панель эфира">
        <button
          id="streams-tab"
          role="tab"
          aria-controls="streams-panel"
          aria-selected={tab === "streams"}
          tabIndex={tab === "streams" ? 0 : -1}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              setTab("chat");
              document.getElementById("chat-tab")?.focus();
            }
          }}
          onClick={() => setTab("streams")}
          className={tab === "streams" ? "is-active" : ""}
        >
          <Icon name="radio" size={16} /> Вокруг тебя
        </button>
        <button
          id="chat-tab"
          role="tab"
          aria-controls="chat-panel"
          aria-selected={tab === "chat"}
          tabIndex={tab === "chat" ? 0 : -1}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              setTab("streams");
              document.getElementById("streams-tab")?.focus();
            }
          }}
          onClick={() => setTab("chat")}
          className={tab === "chat" ? "is-active" : ""}
        >
          <Icon name="chat" size={16} /> Чат
          {snapshot.comments.length > 0 && (
            <span>{snapshot.comments.length}</span>
          )}
        </button>
      </div>
      {tab === "streams" ? (
        <div
          id="streams-panel"
          role="tabpanel"
          aria-labelledby="streams-tab"
          className="stream-panel"
        >
          <div className="sidebar-eyebrow">
            ДРУГИЕ ИСТОРИИ ПРЯМО СЕЙЧАС <span>LIVE</span>
          </div>
          <div className="stream-list">
            {entries.map(
              ({ channel, index, currentItem, nextItem, progressPercent }) => (
                <button
                  className="stream-card"
                  key={channel.id}
                  onClick={() => onSelect(index)}
                  data-sound="channel"
                >
                  <Poster
                    src={currentItem.poster}
                    title={currentItem.title}
                    color={channel.color}
                  />
                  <div className="stream-info">
                    <span>
                      {channel.shortName || channel.name}
                      <Icon name="arrowUp" size={13} />
                    </span>
                    <h3>{currentItem.title}</h3>
                    <p>{currentItem.episode || "Сейчас в эфире"}</p>
                    <div className="stream-progress">
                      <i style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                  <div className="stream-next">
                    Далее: {nextItem?.title || "Продолжение эфира"}
                  </div>
                </button>
              ),
            )}
          </div>
          <button
            className="button button-soft all-channels"
            onClick={onAllChannels}
          >
            Найти свою волну <Icon name="arrowRight" size={17} />
          </button>
        </div>
      ) : (
        <div
          id="chat-panel"
          role="tabpanel"
          aria-labelledby="chat-tab"
          className="chat-panel"
        >
          <div className="chat-intro">
            <span className="live-dot" />
            <span>
              {snapshot.backendAvailable
                ? "Общий чат эфира"
                : "Чат на этом устройстве"}
            </span>
            <button
              className="icon-button small"
              aria-label={
                snapshot.danmakuEnabled
                  ? "Скрыть летящие комментарии"
                  : "Показывать летящие комментарии"
              }
              aria-pressed={snapshot.danmakuEnabled}
              onClick={() => tv.danmaku()}
            >
              <Icon name="chat" size={15} />
            </button>
          </div>
          <div
            className="chat-messages"
            ref={chatRef}
            onScroll={() => {
              const panel = chatRef.current;
              atBottom.current =
                panel.scrollHeight - panel.scrollTop - panel.clientHeight < 60;
            }}
            role="log"
            aria-label="Сообщения чата"
            aria-live="polite"
            aria-relevant="additions"
          >
            {snapshot.comments.length ? (
              snapshot.comments.map((comment) => (
                <article
                  className={`chat-message ${comment.author === "Вы" ? "self" : ""}`}
                  key={comment.id}
                >
                  <div>
                    <strong>{comment.author || "Зритель"}</strong>
                    <time>{comment.timeStr}</time>
                  </div>
                  <p>{comment.text}</p>
                </article>
              ))
            ) : (
              <div className="empty-state chat-empty">
                <span className="chat-cloud">
                  <Icon name="chat" size={28} />
                </span>
                <strong>Истории лучше вместе.</strong>
                <p>Оставь первую мысль — она пролетит прямо по экрану.</p>
              </div>
            )}
          </div>
          <form className="chat-form" onSubmit={send}>
            <input
              aria-label="Текст сообщения"
              placeholder="Поделись моментом…"
              value={message}
              maxLength={90}
              onChange={(event) => setMessage(event.target.value)}
            />
            <button
              aria-label="Отправить сообщение"
              disabled={!message.trim() || sending}
            >
              <Icon
                name={sending ? "loader" : "send"}
                size={18}
                className={sending ? "spin" : ""}
              />
            </button>
          </form>
          <p className="chat-footnote">
            {snapshot.backendAvailable
              ? "На одной волне с другими зрителями"
              : "Сообщения сохраняются здесь и в соседних вкладках"}
          </p>
        </div>
      )}
      <div className="mood-card">
        <span>✧</span>
        <div>
          <strong>Никуда не спеши.</strong>
          <p>Следующая история уже ждёт.</p>
        </div>
        <Icon name="heart" size={19} />
      </div>
    </aside>
  );
}
