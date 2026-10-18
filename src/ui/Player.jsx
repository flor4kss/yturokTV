import TestControls from "./TestControls";
import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import Poster from "./Poster";
import { tv } from "../tvController";
import { remainingLabel } from "../programMetadata";
import PromoArtwork from "./PromoArtwork";
function time(seconds = 0) {
  if (seconds >= 3600)
    return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(Math.floor(seconds) % 60).padStart(2, "0")}`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
export default function Player({
  snapshot,
  favorite,
  onFavorite,
  onSchedule,
  onToast,
  onChannels,
  onSettings,
  onUpdates,
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
  const qualityAvailable=item.type==='bumper' || (item.type==='hls' && new Set((item.sources||[]).map(s=>s.quality).filter(Boolean)).size>1);
  const [fullscreen, setFullscreen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  useEffect(() => {
    if (!snapshot.loadId) return;
    setTransitioning(true);
    const timer = setTimeout(() => setTransitioning(false), 400);
    return () => clearTimeout(timer);
  }, [snapshot.loadId]);
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
      else await document.getElementById("watch-player").requestFullscreen();
    } catch {
      onToast("Полноэкранный режим недоступен в этом браузере");
    }
  }
  return (
    <section
      id="watch-player"
      className={`watch-card ${visible ? "controls-visible" : "controls-hidden"}`}
      aria-label="Просмотр эфира"
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
      onFocusCapture={(event) => {
        focusInside.current = event.target.matches(":focus-visible");
        setVisible(true);
        if (focusInside.current) clearTimeout(timer.current);
        else wake();
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          focusInside.current = false;
          wake();
        }
      }}
      onPointerDown={wake}
    >
      {channel?.id === "test-lab" && <details className="test-player-tools"><summary tabIndex={0}>Тестовый пульт · выбрать передачу или анонс</summary><TestControls snapshot={snapshot}/></details>}
      <div className="watch-heading">
        <div className="remote-channel">
          <span className="remote-number">{channel?.number}</span>
          <div>
            <span className="live-label">
              <span className="live-dot" /> ПРЯМОЙ ЭФИР
            </span>
            <strong>{channel?.shortName || channel?.name}</strong>
          </div>
        </div>
        <div className="remote-actions">
          <button className="button button-outline tv-extra" onClick={onSchedule}>Телепрограмма</button>
          <button className="button button-outline tv-extra" onClick={onSettings}>Моя комната</button>
          <button className="button button-outline tv-extra" onClick={onUpdates}>Обновы</button>
          <div className="remote-step">
            <button
              className="icon-button"
              aria-label="Предыдущий канал"
              disabled={!ready}
              onClick={() => tv.next(-1)}
              data-sound="channel"
            >
              <Icon name="left" size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Следующий канал"
              disabled={!ready}
              onClick={() => tv.next()}
              data-sound="channel"
            >
              <Icon name="right" size={20} />
            </button>
          </div>
          <button
            className="button button-outline remote-channels"
            aria-label="Открыть каналы"
            aria-haspopup="dialog"
            onClick={onChannels}
          >
            <Icon name="grid" size={17} />
            <span>Каналы</span>
            <Icon name="down" size={14} />
          </button>
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
      >
        <div className="player-ambient" aria-hidden="true">
          <div className="ambient-orb" />
          <img src={`${import.meta.env.BASE_URL}art/tv-muse.png`} alt="" />
        </div>
        <video id="hls-player" className="video-surface hidden" playsInline />
        <iframe id="rutube-player" className="video-surface hidden" title="Эфир 2×2" allow="autoplay; encrypted-media; fullscreen" />
        <div id="yt-player-container" className="video-surface hidden">
          <div id="yt-player" />
        </div>
        <div id="bumper-screen" className="bumper-screen hidden">
          <PromoArtwork item={item} channel={channel} elapsed={elapsed} active={started && !snapshot.isPaused && snapshot.allowPromoVideo !== false} />
          <span className="bumper-brand">yturokTV · {channel?.shortName}</span>
          <span id="bumper-logo">yturokTV</span>
          {item.kind === "promo" && <div className="promo-headline"><h2>{item.promoTitle}</h2><p>{promoHook(item)}</p></div>}
          <p id="bumper-text" />
        </div>
        <div id="static-screen" className="static-screen hidden" />
        <div id="reactions-stage" />
        <div id="danmaku-stage" className="danmaku-stage" />
        <div className="player-channel">
          <Icon name="tv" size={15} /> yturok<span>TV</span> <i />
        </div>
        {error ? (
          <div className="player-prompt error-prompt" role="alert">
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
              <button className="text-button" onClick={onChannels}>
                Выбрать канал <Icon name="grid" size={16} />
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
        ) : null}
        {started && !error && (
          <div
            className={`channel-transition ${transitioning || buffering ? "is-active" : ""}`}
            aria-hidden={!(transitioning || buffering)}
          >
            <div className="transition-card">
              <Poster
                src={item.poster}
                title={item.title}
                color={channel?.color}
              />
              <div>
                <span className="transition-channel">
                  КАНАЛ {channel?.number} ·{" "}
                  {channel?.shortName || channel?.name}
                </span>
                <h3>{item.title}</h3>
                <p>{item.episode || "Прямой эфир"}</p>
                <span
                  className="transition-status"
                  role={transitioning || buffering ? "status" : undefined}
                >
                  <Icon name="loader" className="spin" size={16} /> {snapshot.bufferHolding ? `Копим запас эфира · ${snapshot.bufferSeconds || 0} с` : "Подключаем эфир…"}
                </span>
              </div>
            </div>
          </div>
        )}
        {started && snapshot.delaySuggested && !snapshot.delayedMode && <div className="delay-offer" role="region" aria-label="Нестабильное соединение">
          <div><strong>Эфир прерывается?</strong><p>Включи запас с задержкой: сначала накопим видео, затем продолжим просмотр. Не поможет, если сам источник недоступен.</p></div>
          <button className="button button-light" onClick={()=>tv.delay(true)}>Включить задержку</button>
          <button className="text-button" onClick={()=>tv.dismissDelay()}>Не сейчас</button>
        </div>}
        {started && !catchup && position.adCountdown > 0 && position.adCountdown <= 5 && <span className="ad-notice" role="status">Короткий анонс через {position.adCountdown} с</span>}
        {started && item.kind==='promo' && item.promoDelay>0 && item.duration-elapsed<=3 && <span className="ad-notice" role="status">Возвращаемся к серии…</span>}
        <div className="player-tools">
          <span className="source-label">
            {catchup ? "СМОТРИШЬ С НАЧАЛА" : snapshot.delayedMode ? `ЭФИР С ЗАДЕРЖКОЙ · ${snapshot.delaySeconds || 0} С` : "ПРЯМОЙ ЭФИР"}
          </span>
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
                {time(elapsed)} <i>/</i>{" "}
                <span className="video-duration">{time(item.mediaDuration || item.duration)}</span>
              </span>
            </div>
            <div className="player-control-group">
              <label className="quality-control" title={!qualityAvailable && !['youtube','rutube'].includes(item.type) ? 'Этот источник предоставляет только одно качество' : ['youtube','rutube'].includes(item.type) ? 'Качеством этого видео управляет внешний плеер. Выбор сохранится для потоков сайта.' : 'Качество применяется без перезапуска, если источник предлагает несколько вариантов'}>
                <select aria-label="Качество видео" disabled={!qualityAvailable} value={snapshot.qualityMode || 'auto'} onChange={e=>tv.quality(e.target.value)}>
                  {!qualityAvailable ? <option value={snapshot.qualityMode || 'auto'}>{['youtube','rutube'].includes(item.type)?'Качество источника':'Исходное качество'}</option> : <>
                  <option value="auto">Авто{snapshot.qualityMode==='auto' && snapshot.sourceQuality ? ` · ${snapshot.sourceQuality}p` : ''}</option>
                  <option value="best">Наилучшее</option>
                  <option value="low">Низкое · до 480p</option></>}
                </select>
              </label>
              {snapshot.delayedMode && !catchup && <button className="start-over delay-return" onClick={()=>tv.delay(false)} aria-label="Выключить задержку и вернуться в эфир"><Icon name="radio" size={16}/><span>В прямой эфир</span></button>}
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
          <span className="muted-label">{item.type === "bumper" ? "ЭФИРНАЯ ВСТАВКА" : position.repeat ? "ПОВТОР В ЭФИРЕ" : "ТВОЯ ИСТОРИЯ СЕЙЧАС"}</span>
          <h2>{item.title || "Подключаемся к эфиру"}</h2>
          <p>{item.episode || channel?.tagline || "Устраивайся поудобнее"}</p>
          <span className="program-remaining">
            <Icon name="clock" size={14} />{" "}
            {remainingLabel(item.mediaDuration || item.duration, elapsed)}
          </span>
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

function promoHook(item) {
  const title=item.promoTitle || '';
  if (/Стоун/.test(title)) return 'Мир застыл. Наука даст ему второй шанс.';
  if (/рокер/.test(title)) return 'Из своей комнаты — на сцену. Услышь её историю.';
  if (/шпиона/.test(title)) return 'Идеальная семья. У каждого — свой секрет.';
  if (/Магическая/.test(title)) return 'Проклятия рядом. Кто выдержит следующий бой?';
  if (/Клинок/.test(title)) return 'Когда наступит ночь, останется только идти вперёд.';
  if (/Винланде/.test(title)) return 'Месть — только начало. Что останется после неё?';
  if (/Киберпанк/.test(title)) return 'Найт-Сити обещает всё. Но у каждой мечты есть цена.';
  if (/Смешарики/.test(title)) return 'Большие приключения маленького круглого мира.';
  if (/Фиксики/.test(title)) return 'Тайны обычных вещей. Маленькие герои большой истории.';
  if (/босс/.test(title)) return 'Работа мечты. Начальство из ада. Буквально.';
  if (item.promoBlock) return `${item.promoBlock}. Прибавь звук — следующая волна уже близко.`;
  return 'Новая история. Новые герои. Оставайся на нашей волне.';
}
