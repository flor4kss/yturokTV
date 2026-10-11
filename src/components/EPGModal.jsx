export default function EPGModal() {
  return (
    <div
      id={"modal-epg"}
      className={
        "fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 hidden"
      }
    >
      <div
        className={
          "m3-surface max-w-4xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl"
        }
      >
        <div
          className={
            "flex items-center justify-between pb-4 border-b border-white/5"
          }
        >
          <div className={"flex items-center gap-3"}>
            <span
              className={"material-symbols-outlined text-2xl text-cyan-400"}
            >
              {"calendar_month"}
            </span>
            <div>
              <h3 className={"text-base font-bold text-white"}>
                {"Телепрограмма передач yturokTV"}
              </h3>
              <p className={"text-xs text-gray-400"}>
                {
                  "Точное расписание всех серий по времени Екатеринбурга (ЕКБ • UTC+5)"
                }
              </p>
            </div>
          </div>
          <button id={"btn-close-epg"} className={"m3-icon-btn tonal"}>
            <span className={"material-symbols-outlined text-lg"}>
              {"close"}
            </span>
          </button>
        </div>
        <div
          id={"epg-categories"}
          className={
            "flex items-center gap-1.5 py-2 overflow-x-auto border-b border-white/5 no-scrollbar"
          }
        >
          <button className={"m3-category-chip active"} data-epg-cat={"all"}>
            {"⚡ Все"}
          </button>
          <button className={"m3-category-chip"} data-epg-cat={"anime"}>
            {"📺 Аниме"}
          </button>
          <button className={"m3-category-chip"} data-epg-cat={"cartoons"}>
            {"🎨 Мульты"}
          </button>
          <button className={"m3-category-chip"} data-epg-cat={"minecrafters"}>
            {"⛏️ Крафт"}
          </button>
          <button className={"m3-category-chip"} data-epg-cat={"music"}>
            {"🎵 Муз"}
          </button>
        </div>
        <div
          id={"epg-tabs"}
          className={
            "flex items-center gap-2 py-2.5 overflow-x-auto border-b border-white/5 no-scrollbar"
          }
        ></div>
        <div className={"flex items-center gap-2 py-2.5 overflow-x-auto"}>
          <button className={"epg-day-btn active m3-chip"}>{"Сегодня"}</button>
          <button className={"epg-day-btn m3-chip"}>{"Завтра"}</button>
          <button className={"epg-day-btn m3-chip"}>{"Послезавтра"}</button>
        </div>
        <div
          id={"epg-schedule-list"}
          className={
            "flex-1 overflow-y-auto py-2 flex flex-col gap-2 min-h-0 max-h-[440px]"
          }
        ></div>
      </div>
    </div>
  );
}
