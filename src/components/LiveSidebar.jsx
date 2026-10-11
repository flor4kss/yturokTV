export default function LiveSidebar() {
  return (
    <aside
      className={
        "w-72 xl:w-80 flex flex-col gap-3 m3-surface p-3.5 flex-shrink-0 overflow-hidden"
      }
    >
      <div
        className={
          "flex items-center justify-between pb-2 flex-shrink-0 border-b border-white/5"
        }
      >
        <div
          className={
            "flex items-center gap-1 p-0.5 bg-black/40 rounded-xl border border-white/5"
          }
        >
          <button
            id={"tab-btn-streams"}
            className={
              "px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 bg-purple-600/30 text-purple-200 border border-purple-500/30"
            }
            title={"Другие потоки"}
          >
            <span className={"material-symbols-outlined text-[15px]"}>
              {"cell_tower"}
            </span>
            <span>{"Потоки"}</span>
          </button>
          <button
            id={"tab-btn-chat"}
            className={
              "px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 text-gray-400 hover:text-white"
            }
            title={"Синхронизированный чат эфира"}
          >
            <span className={"material-symbols-outlined text-[15px]"}>
              {"chat"}
            </span>
            <span>{"Чат"}</span>
            <span
              id={"chat-count-badge"}
              className={
                "px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold hidden"
              }
            >
              {"0"}
            </span>
          </button>
        </div>
        <span
          id={"right-panel-status"}
          className={"text-[10px] text-gray-400 font-mono"}
        >
          {"3 Потока"}
        </span>
      </div>
      <div
        id={"inspector-grid"}
        className={"flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 min-h-0"}
      ></div>
      <div
        id={"live-chat-panel"}
        className={
          "flex-1 overflow-y-auto flex flex-col gap-2 pr-1 min-h-0 hidden"
        }
      >
        <div
          id={"live-chat-empty"}
          className={
            "flex-1 flex flex-col items-center justify-center p-4 text-center text-gray-400 my-auto"
          }
        >
          <span
            className={
              "material-symbols-outlined text-3xl text-purple-400/50 mb-2"
            }
          >
            {"forum"}
          </span>
          <p className={"text-xs font-bold text-gray-300"}>
            {"Чат эфира пуст"}
          </p>
          <p className={"text-[11px] text-gray-500 mt-1 leading-relaxed"}>
            {
              "Напишите комментарий в поле под видео — он синхронизируется у всех зрителей и пролетит по экрану!"
            }
          </p>
        </div>
        <div id={"live-chat-messages"} className={"flex flex-col gap-2"}></div>
      </div>
      <div
        className={
          "p-2.5 rounded-2xl bg-[#181926] flex items-center justify-between gap-2 flex-shrink-0 border border-white/5"
        }
      >
        <div className={"flex items-center gap-2"}>
          <span
            className={"w-2 h-2 rounded-full bg-emerald-400 animate-pulse"}
          ></span>
          <div className={"text-[11px] font-bold text-white"}>
            {"Чат синхронизирован"}
          </div>
        </div>
        <span className={"text-[10px] font-mono text-cyan-400"}>{"LIVE"}</span>
      </div>
    </aside>
  );
}
