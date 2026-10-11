import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { subscribe, getSnapshot, tv } from "./tvController";
import { feedback } from "./sound";
import Icon from "./ui/Icon";
import Hero from "./ui/Hero";
import Player from "./ui/Player";
import Modal from "./ui/Modal";
import { ChannelRail, CommunityPanel } from "./ui/Panels";
import { ProgramGuide, Settings, Studio } from "./ui/Overlays";
function saved(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
export default function App() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);
  const [modal, setModal] = useState(null);
  const [favorites, setFavorites] = useState(() => {
    const value = saved("yturok_favorites", []);
    return Array.isArray(value) ? value : [];
  });
  const [sounds, setSounds] = useState(() => saved("yturok_sounds", true));
  const [night, setNight] = useState(() => saved("yturok_night", false));
  const [theater, setTheater] = useState(
    () => saved("yturok_wide_screen", true) === true,
  );
  const [toast, setToast] = useState("");
  const toastTimer = useRef();
  const searchRef = useRef();
  const watchRef = useRef();
  const closeModal = useCallback(() => setModal(null), []);
  const showToast = useCallback((message) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = night ? "night" : "day";
    localStorage.setItem("yturok_night", JSON.stringify(night));
  }, [night]);
  useEffect(() => {
    localStorage.setItem("yturok_favorites", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    localStorage.setItem("yturok_sounds", JSON.stringify(sounds));
  }, [sounds]);
  useEffect(() => {
    localStorage.setItem("yturok_wide_screen", JSON.stringify(theater));
  }, [theater]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (snapshot.note) showToast(snapshot.note);
  }, [snapshot.note, showToast]);
  const scrollWatch = useCallback(
    () =>
      watchRef.current?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      }),
    [],
  );
  useEffect(() => {
    function keydown(event) {
      if (
        modal ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.target.closest(
          'input, textarea, select, button, [contenteditable="true"]',
        ) ||
        !snapshot.ready
      )
        return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault();
        tv.next(event.key === "ArrowUp" ? -1 : 1);
        feedback("channel");
      } else if (event.key.toLowerCase() === "m") {
        tv.mute();
        feedback();
      } else if (event.key.toLowerCase() === "f") {
        (document.fullscreenElement
          ? document.exitFullscreen()
          : document.getElementById("tv-cabinet")?.requestFullscreen()
        )?.catch(() => showToast("Полноэкранный режим недоступен"));
      }
    }
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [modal, snapshot.ready, snapshot.isTVStarted, showToast]);
  function favorite(id) {
    const exists = favorites.includes(id);
    setFavorites(
      exists ? favorites.filter((value) => value !== id) : [...favorites, id],
    );
    showToast(
      exists ? "Канал убран из избранного" : "Любимая волна теперь под рукой",
    );
  }
  function toggleSounds() {
    const next = !sounds;
    localStorage.setItem("yturok_sounds", JSON.stringify(next));
    setSounds(next);
    if (next) feedback();
    showToast(next ? "Тихие отклики включены" : "Отклики выключены");
  }
  function watch(index) {
    if (typeof index === "number") tv.select(index);
    if (snapshot.ready) tv.start();
    closeModal();
    scrollWatch();
  }
  function allChannels() {
    searchRef.current?.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    searchRef.current?.focus({ preventScroll: true });
  }
  function selectChannel(index) {
    tv.select(index);
    if (theater) scrollWatch();
  }
  function toggleWide() {
    setTheater((value) => !value);
    requestAnimationFrame(scrollWatch);
  }
  return (
    <div
      className={`app ${theater ? "theater-mode" : ""}`}
      onClickCapture={(event) => {
        const button = event.target.closest("button");
        if (button && !button.disabled && !button.hasAttribute("data-silent"))
          feedback(button.dataset.sound || "tap");
      }}
    >
      <div className="page-shell" inert={modal ? true : undefined}>
        <header className="app-header">
          <a
            className="brand"
            href="#"
            aria-label="yturokTV — в начало"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({
                top: 0,
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
              });
            }}
          >
            <span className="brand-mark">
              <Icon name="tv" size={24} />
              <i />
            </span>
            <span>
              yturok<strong>TV</strong>
              <small>YOUR HAPPY PLACE</small>
            </span>
          </a>
          <nav className="main-nav" aria-label="Навигация">
            <button className="is-active" onClick={scrollWatch}>
              Эфир <i />
            </button>
            <button onClick={() => setModal("guide")}>Телепрограмма</button>
            <button onClick={() => setModal("settings")}>Моя комната</button>
          </nav>
          <div className="header-actions">
            <span className="header-clock">
              <span className="live-dot" /> {snapshot.clock} <small>ЕКБ</small>
            </span>
            <button
              className="icon-button"
              aria-label={
                sounds
                  ? "Отключить звуки интерфейса"
                  : "Включить звуки интерфейса"
              }
              aria-pressed={sounds}
              onClick={toggleSounds}
              data-silent
            >
              <Icon name={sounds ? "volume" : "muted"} size={19} />
            </button>
            <button
              className="button button-outline cozy-button"
              onClick={() => setModal("settings")}
            >
              <Icon name="sliders" size={16} />
              <span>Устроиться уютно</span>
            </button>
          </div>
        </header>
        <main className="page-main">
          {!theater && (
            <Hero
              clock={snapshot.clock}
              onWatch={() => watch()}
              onSchedule={() => setModal("guide")}
            />
          )}
          <div className="watch-section-heading" ref={watchRef}>
            <div>
              <p className="eyebrow">БЕЗ ПЛАНОВ. БЕЗ СПЕШКИ.</p>
              <h2>
                Поймай свою волну <span>✧</span>
              </h2>
            </div>
            <div className="watch-view-actions">
              <button
                className={`button button-outline wide-toggle ${theater ? "is-active" : ""}`}
                aria-label="Широкий экран"
                aria-pressed={theater}
                onClick={toggleWide}
              >
                <Icon name="wide" size={18} />
                <span>{theater ? "Обычный вид" : "Широкий экран"}</span>
              </button>
              <button className="text-button" onClick={() => setModal("guide")}>
                Вся телепрограмма <Icon name="arrowUp" size={18} />
              </button>
            </div>
          </div>
          <div className="watch-layout">
            <ChannelRail
              snapshot={snapshot}
              favorites={favorites}
              onFavorite={favorite}
              onSelect={selectChannel}
              searchRef={searchRef}
            />
            <Player
              snapshot={snapshot}
              favorite={favorites.includes(snapshot.channel?.id)}
              onFavorite={() => favorite(snapshot.channel?.id)}
              theater={theater}
              onTheater={toggleWide}
              onSettings={() => setModal("settings")}
              onSchedule={() => setModal("guide")}
              onToast={showToast}
            />
            <CommunityPanel
              snapshot={snapshot}
              onSelect={selectChannel}
              onAllChannels={allChannels}
              onToast={showToast}
            />
          </div>
        </main>
        <footer className="app-footer">
          <span>Твоя уютная комната в большом интернете.</span>
          <strong>СМОТРИ. УЛЫБАЙСЯ. ОСТАВАЙСЯ.</strong>
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({
                top: 0,
                behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? "auto"
                  : "smooth",
              });
            }}
          >
            Наверх <Icon name="arrowUp" size={15} />
          </a>
        </footer>
      </div>
      {modal && (
        <Modal
          title={
            modal === "guide"
              ? "Каждой истории — своё время."
              : modal === "studio"
                ? "Собери свою волну."
                : "Твоя уютная комната."
          }
          eyebrow={
            modal === "guide"
              ? "ТЕЛЕПРОГРАММА"
              : modal === "studio"
                ? "ЛИЧНАЯ СЕТКА"
                : "МАЛЕНЬКИЕ НАСТРОЙКИ"
          }
          wide={modal !== "settings"}
          onClose={closeModal}
        >
          {modal === "guide" ? (
            <ProgramGuide snapshot={snapshot} onWatch={watch} />
          ) : modal === "studio" ? (
            <Studio snapshot={snapshot} onToast={showToast} />
          ) : (
            <Settings
              snapshot={snapshot}
              sounds={sounds}
              onSounds={toggleSounds}
              night={night}
              onNight={() => setNight(!night)}
              onStudio={() => setModal("studio")}
              onToast={showToast}
            />
          )}
        </Modal>
      )}
      <div
        className={`toast ${toast ? "is-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {toast && (
          <>
            <Icon name="check" size={17} />
            <span>{toast}</span>
          </>
        )}
      </div>
    </div>
  );
}
