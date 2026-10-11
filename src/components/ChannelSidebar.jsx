export default function ChannelSidebar() {
  return (
    <aside
      className={
        "w-52 lg:w-60 flex flex-col justify-between py-3 px-2.5 m3-surface flex-shrink-0 z-20 overflow-hidden"
      }
    >
      <div
        className={
          "flex flex-col gap-2 w-full pb-2 border-b border-white/5 flex-shrink-0"
        }
      >
        <div className={"flex items-center justify-between px-1"}>
          <span
            className={
              "text-[10px] font-mono uppercase font-bold text-gray-400 tracking-wider"
            }
          >
            {"Категории"}
          </span>
          <span
            id={"active-category-count"}
            className={"text-[9px] font-mono text-purple-300 font-bold"}
          >
            {"11 каналов"}
          </span>
        </div>
        <div
          id={"category-selector-tabs"}
          className={"flex flex-wrap items-center gap-1.5 pb-1"}
        >
          <button className={"m3-category-chip active"} data-cat={"all"}>
            {"⚡ Все"}
          </button>
          <button className={"m3-category-chip"} data-cat={"anime"}>
            {"📺 Аниме"}
          </button>
          <button className={"m3-category-chip"} data-cat={"cartoons"}>
            {"🎨 Мульты"}
          </button>
          <button className={"m3-category-chip"} data-cat={"minecrafters"}>
            {"⛏️ Крафт"}
          </button>
          <button className={"m3-category-chip"} data-cat={"music"}>
            {"🎵 Муз"}
          </button>
        </div>
      </div>
      <div
        id={"vertical-channel-dock"}
        className={
          "flex-1 overflow-y-auto flex flex-col gap-1.5 w-full pr-1 min-h-0 my-2"
        }
      ></div>
      <div
        className={
          "flex items-center justify-between gap-1 pt-2 border-t border-white/5 flex-shrink-0"
        }
      >
        <button
          id={"dock-btn-mute"}
          className={"m3-icon-btn tonal w-9 h-9"}
          title={"Звук"}
        >
          <span
            id={"dock-mute-icon"}
            className={"material-symbols-outlined text-[18px]"}
          >
            {"volume_up"}
          </span>
        </button>
        <button
          id={"dock-btn-cinema"}
          className={"m3-icon-btn tonal w-9 h-9"}
          title={"На весь экран"}
        >
          <span className={"material-symbols-outlined text-[18px]"}>
            {"fullscreen"}
          </span>
        </button>
      </div>
    </aside>
  );
}
