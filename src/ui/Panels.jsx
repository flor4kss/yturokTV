import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Poster from "./Poster";
import { tv } from "../tvController";
const categories = [
  { id: "all", label: "Все жанры" },
  { id: "anime", label: "Аниме" },
  { id: "cartoons", label: "Мультфильмы" },
  { id: "minecrafters", label: "Игры и стримы" },
  { id: "music", label: "Музыка" },
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
  const [more, setMore] = useState(false);
  const listRef = useRef(null);
  const normalized = query.trim().toLowerCase();
  const favoriteCount = snapshot.channels.filter(({ channel }) =>
    favorites.includes(channel.id),
  ).length;
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
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () =>
      setMore(list.scrollHeight - list.scrollTop - list.clientHeight > 6);
    list.scrollTop = 0;
    measure();
    list.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => {
      list.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [query, category, onlyFavorites, filtered.length]);
  useEffect(() => {
    const list = listRef.current;
    const current = list?.querySelector(".is-current");
    if (!current) return;
    const bounds = list.getBoundingClientRect(),
      row = current.getBoundingClientRect();
    if (row.top < bounds.top) list.scrollTop -= bounds.top - row.top;
    else if (row.bottom > bounds.bottom)
      list.scrollTop += row.bottom - bounds.bottom;
  }, [snapshot.currentChannelIndex, query, category, onlyFavorites]);
  return (
    <aside className="channel-panel rail-panel" aria-label="Список каналов">
      <header className="rail-header">
        <div>
          <h2>Каналы</h2>
          <p>Выбери, что смотреть</p>
        </div>
        <span className="rail-live">
          <span className="live-dot" /> LIVE
        </span>
      </header>
      <div className="rail-tabs" aria-label="Подборка каналов">
        <button
          className={!onlyFavorites ? "is-active" : ""}
          aria-pressed={!onlyFavorites}
          onClick={() => setOnlyFavorites(false)}
        >
          Все <span>{snapshot.channels.length}</span>
        </button>
        <button
          className={onlyFavorites ? "is-active" : ""}
          aria-pressed={onlyFavorites}
          onClick={() => setOnlyFavorites(true)}
        >
          <Icon name="heart" size={15} /> Избранное <span>{favoriteCount}</span>
        </button>
      </div>
      <div className="rail-filters">
        <label className="rail-search">
          <Icon name="search" size={18} />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Канал или передача"
            aria-label="Поиск каналов и передач"
          />
          {query && (
            <button aria-label="Очистить поиск" onClick={() => setQuery("")}>
              <Icon name="close" size={16} />
            </button>
          )}
        </label>
        <label className="rail-genre">
          <select
            aria-label="Жанр канала"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <Icon name="down" size={16} />
        </label>
      </div>
      <div className="rail-results">
        <span>{onlyFavorites ? "ТВОЁ ИЗБРАННОЕ" : "СЕЙЧАС В ЭФИРЕ"}</span>
        <span>
          {filtered.length} / {snapshot.channels.length}
        </span>
      </div>
      <div className="rail-cards" ref={listRef}>
        {filtered.length ? (
          filtered.map(({ channel, index, currentItem, progressPercent }) => {
            const active = snapshot.currentChannelIndex === index;
            const favorite = favorites.includes(channel.id);
            const match =
              normalized &&
              !currentItem.title?.toLowerCase().includes(normalized) &&
              !`${channel.name} ${channel.shortName}`
                .toLowerCase()
                .includes(normalized)
                ? channel.schedule?.find((item) =>
                    item.title?.toLowerCase().includes(normalized),
                  )
                : null;
            return (
              <div
                key={channel.id}
                className={`rail-card ${active ? "is-current" : ""}`}
              >
                <button
                  className="rail-select"
                  aria-label={`Включить канал ${channel.shortName || channel.name}`}
                  aria-pressed={active}
                  disabled={!snapshot.ready}
                  onClick={() => onSelect(index)}
                  data-sound="channel"
                >
                  <span className="rail-number">
                    <span>{channel.number}</span>
                    <Icon name="play" size={17} fill="currentColor" />
                  </span>
                  <span className="rail-copy">
                    <strong>{channel.shortName || channel.name}</strong>
                    <span
                      className="rail-show"
                      title={(match || currentItem).title}
                    >
                      {(match || currentItem).title}
                    </span>
                    <span className="rail-status">
                      {active ? (
                        <>
                          <span className="rail-equalizer" aria-hidden="true">
                            <i />
                            <i />
                            <i />
                          </span>
                          {snapshot.isTVStarted ? "Смотришь" : "Выбран"}
                        </>
                      ) : match ? (
                        "В программе канала"
                      ) : (
                        currentItem.episode || "Прямой эфир"
                      )}
                    </span>
                  </span>
                </button>
                <button
                  className={`rail-favorite ${favorite ? "is-favorite" : ""}`}
                  aria-label={`${favorite ? "Убрать" : "Добавить"} ${channel.shortName || channel.name} ${favorite ? "из избранного" : "в избранное"}`}
                  aria-pressed={favorite}
                  title={favorite ? "Убрать из избранного" : "В избранное"}
                  onClick={() => onFavorite(channel.id)}
                  data-sound="favorite"
                >
                  <Icon
                    name="heart"
                    size={17}
                    fill={favorite ? "currentColor" : "none"}
                  />
                </button>
                <div className="rail-progress" aria-hidden="true">
                  <span style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state rail-empty">
            <Icon name={onlyFavorites ? "heart" : "search"} size={28} />
            <strong>
              {onlyFavorites && favoriteCount === 0
                ? "Твои любимые каналы — здесь"
                : "Ничего не нашлось"}
            </strong>
            <p>
              {onlyFavorites && favoriteCount === 0
                ? "Нажми сердечко у канала, и он появится в избранном."
                : "Попробуй другое название или убери фильтр."}
            </p>
            <button
              className="text-button"
              onClick={() => {
                setQuery("");
                setCategory("all");
                setOnlyFavorites(false);
              }}
            >
              Показать все каналы <Icon name="right" size={16} />
            </button>
          </div>
        )}
      </div>
      <footer className="rail-footer">
        {more ? (
          <button
            onClick={() =>
              listRef.current?.scrollBy({
                top: listRef.current.clientHeight * 0.75,
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
              })
            }
          >
            Ещё каналы <Icon name="arrowDown" size={15} />
          </button>
        ) : (
          <span>
            <Icon name="radio" size={14} />{" "}
            {filtered.length
              ? "Нажми на канал, чтобы переключить"
              : "Твоя следующая история уже рядом"}
          </span>
        )}
      </footer>
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
