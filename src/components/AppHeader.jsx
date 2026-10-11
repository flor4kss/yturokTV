export default function AppHeader() {
  return (
    <header
      className={
        "h-14 flex items-center justify-between px-4 sm:px-6 bg-[#0f1018] flex-shrink-0 z-30 select-none shadow-md"
      }
    >
      <div className={"flex items-center gap-3"}>
        <a href={"#"} className={"flex items-center gap-2.5 group"}>
          <div
            className={
              "w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 via-indigo-500 to-cyan-400 flex items-center justify-center font-black text-sm shadow-md group-hover:scale-105 transition-transform"
            }
          >
            {"\n          📺\n        "}
          </div>
          <div className={"flex items-center gap-1.5"}>
            <span className={"text-base font-black tracking-wider text-white"}>
              {"yturok"}
              <span className={"text-purple-400"}>{"TV"}</span>
            </span>
            <span
              className={
                "px-2 py-0.5 text-[9px] font-bold uppercase rounded-full bg-rose-500/20 text-rose-300 flex items-center gap-1"
              }
            >
              <span
                className={"w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"}
              ></span>
              {" 24/7 ЭФИР\n          "}
            </span>
          </div>
        </a>
      </div>
      <div className={"flex items-center gap-2"}>
        <div
          className={
            "flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 text-xs font-mono text-cyan-300 shadow-inner"
          }
        >
          <span
            className={"material-symbols-outlined text-[15px] text-cyan-400"}
          >
            {"schedule"}
          </span>
          <span id={"current-clock"} className={"font-bold tracking-wider"}>
            {"--:--:-- ЕКБ"}
          </span>
        </div>
        <div
          id={"sync-indicator-badge"}
          className={
            "hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase rounded-full bg-emerald-500/15 text-emerald-300"
          }
        >
          <span
            className={"w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"}
          ></span>
          {" СИНХРОН (ЕКБ • UTC+5)\n      "}
        </div>
      </div>
      <div className={"flex items-center gap-1.5 sm:gap-2"}>
        <button
          id={"btn-toggle-ticker-header"}
          title={"Скрыть/показать бегущую строку снизу (T)"}
          className={"m3-chip active"}
        >
          <span className={"material-symbols-outlined text-[16px]"}>
            {"view_headline"}
          </span>
          <span
            id={"ticker-status-text"}
            className={"hidden xl:inline text-[11px]"}
          >
            {"Строка: ВКЛ"}
          </span>
        </button>
        <button
          id={"btn-toggle-danmaku-header"}
          title={"Скрыть/показать летящие комментарии Bilibili (D)"}
          className={"m3-chip active"}
        >
          <span className={"material-symbols-outlined text-[16px]"}>
            {"forum"}
          </span>
          <span
            id={"danmaku-status-text"}
            className={"hidden xl:inline text-[11px]"}
          >
            {"Чат: ВКЛ"}
          </span>
        </button>
        <button
          id={"btn-toggle-crt"}
          title={"Тумблер ЭЛТ ретро-фильтра"}
          className={"m3-chip active"}
        >
          <span className={"material-symbols-outlined text-[16px]"}>
            {"tv"}
          </span>
          <span
            id={"crt-status-text"}
            className={"hidden md:inline text-[11px]"}
          >
            {"ЭЛТ: ВКЛ"}
          </span>
        </button>
        <button
          id={"btn-sync-live"}
          title={"Синхронизировать секунда в секунду (ЕКБ)"}
          className={"m3-chip"}
        >
          <span className={"material-symbols-outlined text-[16px]"}>
            {"sync"}
          </span>
          <span className={"hidden md:inline text-[11px]"}>{"Синхрон"}</span>
        </button>
        <button
          id={"btn-sleep-timer"}
          title={"Таймер сна (автовыключение)"}
          className={"m3-chip"}
        >
          <span className={"material-symbols-outlined text-[16px]"}>
            {"bedtime"}
          </span>
          <span
            id={"sleep-timer-text"}
            className={"hidden md:inline text-[11px]"}
          >
            {"Сон: Выкл"}
          </span>
        </button>
        <button id={"btn-nav-epg"} className={"m3-chip"}>
          <span className={"material-symbols-outlined text-[16px]"}>
            {"calendar_month"}
          </span>
          <span className={"hidden lg:inline text-[11px]"}>
            {"Телепрограмма"}
          </span>
        </button>
        <button
          id={"btn-open-admin"}
          className={"m3-chip"}
          title={"Управление эфиром"}
        >
          <span className={"material-symbols-outlined text-[16px]"}>
            {"admin_panel_settings"}
          </span>
          <span className={"hidden lg:inline text-[11px]"}>{"Админ"}</span>
        </button>
      </div>
    </header>
  );
}
