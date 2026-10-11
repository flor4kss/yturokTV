export default function NowPlayingCard() {
  return (
    <div
      id={"show-metadata-card"}
      className={
        "m3-surface px-3.5 py-2 flex items-center justify-between gap-3 flex-shrink-0"
      }
    >
      <div className={"flex items-center gap-3 min-w-0 max-w-xs xl:max-w-sm"}>
        <img
          id={"show-poster"}
          src={
            "https://images.unsplash.com/photo-1534447677768-be436bb09401?w=100"
          }
          alt={"Постер"}
          className={"w-9 h-12 object-cover rounded-xl flex-shrink-0 shadow"}
        />
        <div className={"flex flex-col min-w-0"}>
          <div className={"flex items-center gap-1.5"}>
            <span
              id={"show-slot-badge"}
              className={
                "px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-bold font-mono"
              }
            >
              {"\n                ☀️ УТРЕННИЙ ЭФИР\n              "}
            </span>
            <span
              id={"show-tag-badge"}
              className={
                "px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-bold"
              }
            >
              {"\n                ⭐ ПРЕМЬЕРА\n              "}
            </span>
          </div>
          <h2
            id={"show-title"}
            className={"text-xs font-bold text-white truncate mt-0.5"}
          >
            {"Семья шпиона"}
          </h2>
          <div
            id={"show-episode"}
            className={"text-[11px] text-purple-300 truncate font-medium"}
          >
            {"Серия 1"}
          </div>
        </div>
      </div>
      <form
        id={"danmaku-form"}
        className={"flex-1 flex items-center gap-2 max-w-xl mx-1"}
      >
        <div
          className={
            "relative flex-1 flex items-center bg-black/50 border border-white/10 rounded-full px-3 py-1.5 focus-within:border-purple-400 transition shadow-inner"
          }
        >
          <span
            className={
              "material-symbols-outlined text-purple-400 text-[18px] mr-1.5 flex-shrink-0"
            }
          >
            {"chat_bubble"}
          </span>
          <input
            id={"danmaku-input"}
            type={"text"}
            maxLength={"90"}
            placeholder={"Написать комментарий на экран (как в Bilibili)..."}
            className={
              "bg-transparent text-xs text-white placeholder-gray-400 focus:outline-none w-full"
            }
          />
          <div className={"flex items-center gap-1.5 ml-2 flex-shrink-0"}>
            <button
              type={"button"}
              className={
                "danmaku-color-btn w-3.5 h-3.5 rounded-full bg-white active"
              }
              data-color={"#ffffff"}
              title={"Белый"}
            ></button>
            <button
              type={"button"}
              className={
                "danmaku-color-btn w-3.5 h-3.5 rounded-full bg-cyan-400"
              }
              data-color={"#22d3ee"}
              title={"Циан"}
            ></button>
            <button
              type={"button"}
              className={
                "danmaku-color-btn w-3.5 h-3.5 rounded-full bg-yellow-400"
              }
              data-color={"#facc15"}
              title={"Жёлтый"}
            ></button>
            <button
              type={"button"}
              className={
                "danmaku-color-btn w-3.5 h-3.5 rounded-full bg-pink-500"
              }
              data-color={"#ec4899"}
              title={"Розовый"}
            ></button>
          </div>
        </div>
        <button
          type={"submit"}
          id={"btn-send-danmaku"}
          className={
            "px-3.5 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition hover:scale-105 active:scale-95 flex-shrink-0"
          }
        >
          <span className={"material-symbols-outlined text-[15px]"}>
            {"send"}
          </span>
          <span className={"hidden sm:inline"}>{"Пустить"}</span>
        </button>
      </form>
      <div className={"flex items-center gap-2 flex-shrink-0"}>
        <div className={"hidden xl:flex flex-col items-end text-right"}>
          <span className={"text-[9px] text-gray-400 font-mono"}>
            {"Прямой эфир"}
          </span>
          <span
            className={
              "text-[11px] font-bold text-emerald-400 flex items-center gap-1"
            }
          >
            <span
              className={
                "w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
              }
            ></span>
            {" Синхронизировано\n            "}
          </span>
        </div>
        <button
          id={"btn-toggle-meta-card"}
          className={"m3-icon-btn tonal w-7 h-7 text-gray-400 hover:text-white"}
          title={"Скрыть/показать нижнюю панель информации"}
        >
          <span
            id={"collapse-meta-icon"}
            className={"material-symbols-outlined text-[16px]"}
          >
            {"expand_more"}
          </span>
        </button>
      </div>
    </div>
  );
}
