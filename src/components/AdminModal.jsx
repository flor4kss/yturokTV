export default function AdminModal() {
  return (
    <div
      id={"modal-admin"}
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
              className={"material-symbols-outlined text-2xl text-purple-400"}
            >
              {"admin_panel_settings"}
            </span>
            <div>
              <h3 className={"text-base font-bold text-white"}>
                {"Центр управления эфиром (Админ-Панель)"}
              </h3>
              <p className={"text-xs text-gray-400"}>
                {
                  "Выбирай тайтлы для ротации, ищи в базе AniLibria и управляй сеткой"
                }
              </p>
            </div>
          </div>
          <button id={"btn-close-admin"} className={"m3-icon-btn tonal"}>
            <span className={"material-symbols-outlined text-lg"}>
              {"close"}
            </span>
          </button>
        </div>
        <div
          className={
            "grid grid-cols-1 md:grid-cols-12 gap-5 py-4 flex-1 overflow-hidden"
          }
        >
          <div
            className={
              "md:col-span-7 flex flex-col gap-3 overflow-y-auto pr-2 max-h-[460px]"
            }
          >
            <div className={"flex gap-2"}>
              <input
                id={"admin-search-input"}
                type={"text"}
                placeholder={
                  "Поиск аниме из базы AniLibria (Наруто, Блич, Тетрадь смерти)..."
                }
                className={
                  "flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-purple-400"
                }
              />
              <button
                id={"btn-admin-search"}
                className={
                  "m3-chip bg-purple-600 text-white hover:bg-purple-500 font-bold"
                }
              >
                {"\n              Поиск\n            "}
              </button>
            </div>
            <div
              id={"admin-search-results"}
              className={"flex flex-col gap-2 min-h-[200px]"}
            >
              <div className={"text-center py-12 text-gray-500 text-xs"}>
                {
                  "\n              Введите название выше, чтобы найти релиз и добавить его в ротацию\n            "
                }
              </div>
            </div>
          </div>
          <div
            className={
              "md:col-span-5 flex flex-col gap-3 border-t md:border-t-0 md:border-l border-white/5 md:pl-5 pt-3 md:pt-0 overflow-y-auto max-h-[460px]"
            }
          >
            <div className={"flex items-center justify-between"}>
              <h4 className={"text-xs font-bold text-purple-300 font-mono"}>
                {"Активные потоки и сезоны"}
              </h4>
              <span className={"text-[10px] text-gray-400 font-mono"}>
                {"3 Потока"}
              </span>
            </div>
            <div
              id={"admin-channels-summary"}
              className={"flex flex-col gap-2 text-xs"}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}
