import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Poster from "./Poster";
import { tv } from "../tvController";
function time(seconds = 0) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export default function Player({
  snapshot,
  favorite,
  onFavorite,
  theater,
  onTheater,
  onSettings,
  onSchedule,
  onToast,
}) {
  const {
    channel,
    position,
    isTVStarted: started,
    isMuted: muted,
    volume,
    isCatchUpMode: catchup,
    error,
    buffering,
    ready,
  } = snapshot;
  const {
    currentItem: item = {},
    nextItem,
    progressPercent = 0,
    elapsed = 0,
  } = position;
  const [fullscreen, setFullscreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const timer = useRef();
  const active = useRef(false);
  const focusInside = useRef(false);
  useEffect(() => {
    const listener = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", listener);
    return () => {
      document.removeEventListener("fullscreenchange", listener);
      clearTimeout(timer.current);
    };
  }, []);
  function wake() {
    setVisible(true);
    clearTimeout(timer.current);
    if (active.current)
      timer.current = setTimeout(() => {
        if (!focusInside.current) setVisible(false);
      }, 2800);
  }
  async function expand() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.getElementById("tv-cabinet").requestFullscreen();
    } catch {
      onToast("Полноэкранный режим недоступен в этом браузере");
    }
  }
  return (
    <section className="watch-card" aria-label="Просмотр эфира">
      <div className="watch-heading">
        <div className="live-label">
          <span className="live-dot" /> СЕЙЧАС В ЭФИРЕ
        </div>
        <div className="watch-heading-actions">
          <span className="channel-number">{channel?.number}</span>
          <span>{channel?.shortName || channel?.name}</span>
          <button
            className={`icon-button favorite-button ${favorite ? "is-favorite" : ""}`}
            aria-label={
              favorite
                ? "Убрать канал из избранного"
                : "Добавить канал в избранное"
            }
            aria-pressed={favorite}
            onClick={onFavorite}
            data-sound="favorite"
          >
            <Icon
              name="heart"
              size={18}
              fill={favorite ? "currentColor" : "none"}
            />
          </button>
        </div>
      </div>
      <div
        id="tv-cabinet"
        className={`tv-stage ${snapshot.crtEnabled ? "crt-mode" : ""} ${snapshot.danmakuEnabled ? "" : "no-danmaku"} ${visible ? "controls-visible" : "controls-hidden"}`}
        onPointerEnter={() => {
          active.current = true;
          wake();
        }}
        onPointerMove={wake}
        onPointerLeave={() => {
          active.current = false;
          clearTimeout(timer.current);
          if (!focusInside.current) setVisible(false);
        }}
        onFocusCapture={() => {
          focusInside.current = true;
          setVisible(true);
          clearTimeout(timer.current);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            focusInside.current = false;
            wake();
          }
        }}
        onPointerDown={wake}
      >
        <div className="player-ambient" aria-hidden="true">
          <div className="ambient-orb" />
          <img src={`${import.meta.env.BASE_URL}art/tv-muse.png`} alt="" />
        </div>
        <video id="hls-player" className="video-surface hidden" playsInline />
        <div id="yt-player-container" className="video-surface hidden">
          <div id="yt-player" />
        </div>
        <div id="bumper-screen" className="bumper-screen hidden">
          <span id="bumper-logo">yturokTV</span>
          <p id="bumper-text" />
        </div>
        <div id="static-screen" className="static-screen hidden" />
        <div id="reactions-stage" />
        <div id="danmaku-stage" className="danmaku-stage" />
        <div className="player-channel">
          <Icon name="tv" size={15} /> yturok<span>TV</span> <i />
        </div>
        {error ? (
          <div className="player-prompt error-prompt">
            <span className="prompt-symbol">
              <Icon name="radio" size={28} />
            </span>
            <h3>Кажется, сигнал потерялся</h3>
            <p>{error}</p>
            <div>
              <button
                className="button button-light"
                onClick={() => tv.retry()}
              >
                <Icon name="restart" size={16} /> Повторить
              </button>
              <button className="text-button" onClick={() => tv.next()}>
                Другой канал <Icon name="right" size={16} />
              </button>
            </div>
          </div>
        ) : !started ? (
          <div className="player-prompt">
            <button
              className="big-play"
              aria-label="Включить эфир со звуком"
              onClick={() => tv.start()}
              disabled={!ready}
            >
              <Icon
                name={ready ? "play" : "loader"}
                size={30}
                className={!ready ? "spin" : ""}
                fill={ready ? "currentColor" : "none"}
              />
            </button>
            <h3>Ты уже почти в эфире.</h3>
            <p>Один клик — и история начинается.</p>
          </div>
        ) : buffering ? (
          <div className="buffering-chip">
            <Icon name="loader" size={16} className="spin" /> Ловим волну…
          </div>
        ) : null}
        <div className="player-tools">
          <span className="source-label">
            {catchup ? "СМОТРИШЬ С НАЧАЛА" : "ПРЯМОЙ ЭФИР"}
          </span>
          <div className="tool-buttons">
            <button
              className="player-icon"
              aria-label={theater ? "Выйти из кинотеатра" : "Режим кинотеатра"}
              aria-pressed={theater}
              onClick={onTheater}
            >
              <Icon name="grid" size={17} />
            </button>
            <button
              className="player-icon"
              aria-label="Настройки просмотра"
              onClick={onSettings}
            >
              <Icon name="sliders" size={17} />
            </button>
          </div>
        </div>
        <div className="player-controls">
          <div
            className="video-progress"
            role="progressbar"
            aria-label="Прогресс передачи"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="player-control-row">
            <div className="player-control-group">
              <button
                className="player-icon"
                aria-label="Предыдущий канал"
                onClick={() => tv.next(-1)}
                data-sound="channel"
              >
                <Icon name="left" />
              </button>
              {!started && (
                <button
                  className="player-icon play-toggle"
                  aria-label="Включить эфир"
                  onClick={() => tv.start()}
                  disabled={!ready}
                >
                  <Icon name="play" size={20} fill="currentColor" />
                </button>
              )}
              <button
                className="player-icon"
                aria-label="Следующий канал"
                onClick={() => tv.next()}
                data-sound="channel"
              >
                <Icon name="right" />
              </button>
              <span className="control-divider" />
              <button
                className="player-icon"
                aria-label={muted ? "Включить звук" : "Выключить звук"}
                onClick={() => tv.mute()}
              >
                <Icon name={muted ? "muted" : "volume"} size={19} />
              </button>
              <input
                className="volume-range"
                aria-label="Громкость эфира"
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={(event) => tv.volume(event.target.value)}
              />
              <span className="video-time">
                {time(elapsed)} <i>/</i> {time(item.duration)}
              </span>
            </div>
            <div className="player-control-group">
              <button
                className="start-over"
                onClick={() => (catchup ? tv.live() : tv.restart())}
                disabled={!ready}
              >
                <Icon name={catchup ? "radio" : "restart"} size={15} />
                <span>{catchup ? "В эфир" : "С начала"}</span>
              </button>
              <button
                className="player-icon"
                aria-label={
                  fullscreen ? "Выйти из полного экрана" : "Полный экран"
                }
                onClick={expand}
              >
                <Icon name="expand" size={19} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="now-playing">
        <Poster src={item.poster} title={item.title} color={channel?.color} />
        <div className="now-playing-copy">
          <span className="muted-label">ТВОЯ ИСТОРИЯ СЕЙЧАС</span>
          <h2>{item.title || "Подключаемся к эфиру"}</h2>
          <p>{item.episode || channel?.tagline || "Устраивайся поудобнее"}</p>
        </div>
        <button
          className="next-program"
          onClick={onSchedule}
          title="Открыть телепрограмму"
        >
          <span>ДАЛЕЕ</span>
          <strong>{nextItem?.title || "Продолжение истории"}</strong>
          <Icon name="arrowUp" size={17} />
        </button>
      </div>
      <div className="watch-smallprint">
        <span>
          <span className="live-dot" />{" "}
          {catchup ? "Твоя личная перемотка" : "На одной волне с эфиром"}
        </span>
        <span>{snapshot.clock} · Екатеринбург</span>
      </div>
    </section>
  );
}
