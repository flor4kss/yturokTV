export default function VideoStage() {
  return (
    <div
      id={"tv-cabinet"}
      className={
        "tv-stage flex-1 min-h-0 w-full relative flex items-center justify-center crt-mode select-none"
      }
    >
      <video
        id={"hls-player"}
        className={"w-full h-full object-contain absolute inset-0 z-0 hidden"}
        playsInline={true}
      ></video>
      <div
        id={"yt-player-container"}
        className={
          "w-full h-full absolute inset-0 z-0 hidden overflow-hidden pointer-events-none"
        }
      >
        <div id={"yt-player"} className={"w-full h-full"}></div>
      </div>
      <div
        id={"bumper-screen"}
        className={
          "absolute inset-0 z-10 bumper-screen flex flex-col items-center justify-center p-8 text-center select-none hidden"
        }
      >
        <div className={"max-w-lg"}>
          <div
            id={"bumper-logo"}
            className={
              "font-black text-3xl tracking-widest text-cyan-400 mb-3 drop-shadow"
            }
          >
            {"[2x2]"}
          </div>
          <p
            id={"bumper-text"}
            className={
              "text-xl md:text-2xl font-bold tracking-tight text-white leading-snug whitespace-pre-line"
            }
          ></p>
        </div>
      </div>
      <div
        id={"static-screen"}
        className={"absolute inset-0 z-20 static-noise hidden"}
      ></div>
      <div
        id={"reactions-stage"}
        className={"absolute inset-0 pointer-events-none overflow-hidden z-20"}
      ></div>
      <div
        id={"danmaku-stage"}
        className={
          "danmaku-stage absolute inset-0 pointer-events-none overflow-hidden z-20"
        }
      ></div>
      <div
        id={"tv-watermark"}
        className={"tv-watermark flex items-center gap-2"}
      >
        <span id={"watermark-logo-slot"}></span>
        <span
          id={"channel-watermark"}
          className={
            "tracking-widest uppercase font-bold text-xs text-white/90"
          }
        >
          {"yturokTV • УТРО"}
        </span>
      </div>
      <div
        id={"unmute-overlay"}
        className={
          "absolute inset-0 z-30 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 hover:bg-black/40"
        }
      >
        <div
          className={
            "w-16 h-16 rounded-full bg-gradient-to-tr from-purple-500 to-cyan-400 flex items-center justify-center text-white mb-3 shadow-2xl hover:scale-110 transition-transform animate-bounce"
          }
        >
          <span className={"material-symbols-outlined text-3xl"}>
            {"volume_up"}
          </span>
        </div>
        <h2 className={"text-lg font-black text-white mb-1 tracking-wider"}>
          {"ЭФИР ИДЁТ (БЕЗ ЗВУКА)"}
        </h2>
        <p className={"text-xs text-gray-200 m3-chip shadow-xl"}>
          <span className={"material-symbols-outlined text-[14px]"}>
            {"touch_app"}
          </span>
          {" Кликните в любом месте, чтобы включить звук\n          "}
        </p>
      </div>
      <div id={"player-controls-overlay"} className={"player-controls-overlay"}>
        <div
          className={"flex items-center justify-between text-xs text-white/90"}
        >
          <div className={"flex items-center gap-2"}>
            <span
              id={"hover-channel-badge"}
              className={
                "px-2 py-0.5 rounded-full bg-purple-500/30 text-[10px] font-bold font-mono"
              }
            >
              {"УТРО 01"}
            </span>
            <span
              id={"hover-show-title"}
              className={"font-bold truncate max-w-md"}
            >
              {"Загрузка эфира..."}
            </span>
          </div>
          <div className={"flex items-center gap-2"}>
            <button
              id={"btn-start-over"}
              className={
                "m3-chip py-1 px-2.5 text-[10px] bg-black/40 hover:bg-purple-600/40"
              }
              title={"Начать текущую серию с начала"}
            >
              <span className={"material-symbols-outlined text-[14px]"}>
                {"replay"}
              </span>
              <span className={"hidden sm:inline"}>{"С начала"}</span>
            </button>
            <button
              id={"btn-go-live"}
              className={
                "m3-chip py-1 px-2.5 text-[10px] bg-rose-600/80 hover:bg-rose-500 hidden"
              }
              title={"Вернуться в прямой эфир"}
            >
              <span
                className={"w-1.5 h-1.5 rounded-full bg-white animate-pulse"}
              ></span>
              <span>{"В эфир"}</span>
            </button>
            <div
              className={
                "hidden sm:flex items-center gap-1 bg-black/50 p-1 rounded-full"
              }
            >
              <button
                className={"emoji-react-btn"}
                data-emoji={"🔥"}
                title={"Огонь"}
              >
                {"🔥"}
              </button>
              <button
                className={"emoji-react-btn"}
                data-emoji={"😂"}
                title={"Угар"}
              >
                {"😂"}
              </button>
              <button
                className={"emoji-react-btn"}
                data-emoji={"😱"}
                title={"Шок"}
              >
                {"😱"}
              </button>
              <button
                className={"emoji-react-btn"}
                data-emoji={"🍿"}
                title={"Попкорн"}
              >
                {"🍿"}
              </button>
            </div>
            <span
              className={
                "px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono font-bold"
              }
            >
              {"1080p HD"}
            </span>
          </div>
        </div>
        <div></div>
        <div
          className={
            "flex flex-col gap-2 bg-black/60 backdrop-blur-md p-3 rounded-2xl shadow-2xl mb-5"
          }
        >
          <div className={"flex items-center gap-3"}>
            <div className={"flex-1 m3-progress-track"}>
              <div
                id={"broadcast-progress"}
                className={"m3-progress-fill"}
                style={{ width: "0%" }}
              ></div>
            </div>
            <span
              id={"broadcast-time-text"}
              className={
                "text-[11px] font-mono text-gray-300 whitespace-nowrap"
              }
            >
              {"00:00 / 00:00"}
            </span>
          </div>
          <div className={"flex items-center justify-between gap-3 pt-1"}>
            <div className={"flex items-center gap-2"}>
              <button
                id={"btn-prev-ch"}
                className={"m3-icon-btn tonal w-8 h-8"}
                title={"Предыдущий поток"}
              >
                <span className={"material-symbols-outlined text-[18px]"}>
                  {"skip_previous"}
                </span>
              </button>
              <span
                id={"current-channel-badge"}
                className={"font-mono text-xs font-bold px-1 text-purple-300"}
              >
                {"УТРО 01"}
              </span>
              <button
                id={"btn-next-ch"}
                className={"m3-icon-btn tonal w-8 h-8"}
                title={"Следующий поток"}
              >
                <span className={"material-symbols-outlined text-[18px]"}>
                  {"skip_next"}
                </span>
              </button>
              <div className={"w-[1px] h-4 bg-white/15 mx-1"}></div>
              <button
                id={"btn-mute"}
                className={"m3-icon-btn w-8 h-8"}
                title={"Звук"}
              >
                <span
                  id={"mute-icon"}
                  className={"material-symbols-outlined text-[18px]"}
                >
                  {"volume_up"}
                </span>
              </button>
              <input
                id={"volume-slider"}
                type={"range"}
                min={"0"}
                max={"100"}
                defaultValue={"80"}
                className={"w-20 cursor-pointer"}
              />
            </div>
            <div className={"flex items-center gap-2"}>
              <button
                id={"btn-player-danmaku"}
                className={"m3-icon-btn tonal w-8 h-8 text-cyan-300"}
                title={"Летящие комментарии Bilibili (D)"}
              >
                <span className={"material-symbols-outlined text-[16px]"}>
                  {"forum"}
                </span>
              </button>
              <button
                id={"btn-player-ticker"}
                className={"m3-icon-btn tonal w-8 h-8 text-rose-300"}
                title={"Скрыть/показать бегущую строку снизу (T)"}
              >
                <span className={"material-symbols-outlined text-[16px]"}>
                  {"view_headline"}
                </span>
              </button>
              <button
                id={"btn-player-crt"}
                className={"m3-icon-btn tonal w-8 h-8"}
                title={"ЭЛТ Фильтр"}
              >
                <span className={"material-symbols-outlined text-[16px]"}>
                  {"tv"}
                </span>
              </button>
              <button
                id={"btn-cinema"}
                className={"m3-icon-btn tonal w-8 h-8"}
                title={"Развернуть на весь экран"}
              >
                <span className={"material-symbols-outlined text-[18px]"}>
                  {"fullscreen"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        id={"tv-ticker-bar"}
        className={
          "tv-ticker-bar flex items-center justify-between overflow-hidden z-15"
        }
      >
        <div className={"flex items-center overflow-hidden flex-1 min-w-0"}>
          <span className={"ticker-badge flex-shrink-0"}>{"ЭФИР ЕКБ"}</span>
          <div className={"ticker-content-track"}>
            <span id={"ticker-text"} className={"ticker-text"}>
              {"Загрузка эфира yturokTV..."}
            </span>
          </div>
        </div>
        <button
          id={"btn-close-ticker"}
          className={
            "text-gray-400 hover:text-white px-2 py-0.5 text-xs hover:bg-white/10 transition flex items-center flex-shrink-0"
          }
          title={"Скрыть бегущую строку (T)"}
        >
          <span className={"material-symbols-outlined text-[15px]"}>
            {"close"}
          </span>
        </button>
      </div>
    </div>
  );
}
