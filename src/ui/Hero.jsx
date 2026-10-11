import Icon from "./Icon";
export default function Hero({ onWatch, onSchedule, clock }) {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="eyebrow">
          <span className="tiny-star">✳</span> МАЛЕНЬКИЙ ПОРТАЛ В ХОРОШИЙ ДЕНЬ
        </p>
        <h1 id="hero-title">
          Включи свой
          <br />
          маленький <span>мир.</span>
        </h1>
        <p className="hero-description">
          Знакомые истории. Случайные открытия.
          <br />И ощущение, что ты снова дома.
        </p>
        <div className="hero-actions">
          <button className="button button-dark" onClick={onWatch}>
            <Icon name="play" size={18} fill="currentColor" /> Смотреть эфир
          </button>
          <button className="hero-secondary" onClick={onSchedule}>
            Что сегодня? <Icon name="arrowUp" size={18} />
          </button>
        </div>
        <div className="hero-footnote">
          <span className="mini-equalizer">
            <i />
            <i />
            <i />
            <i />
          </span>{" "}
          Уже идёт. Просто присоединяйся.
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <span className="hero-orbit orbit-one" />
        <span className="hero-orbit orbit-two" />
        <span className="art-star star-one">✧</span>
        <span className="art-star star-two">✦</span>
        <img
          src={`${import.meta.env.BASE_URL}art/tv-muse.png`}
          alt=""
          fetchPriority="high"
        />
        <div className="art-label">
          <span className="live-dot" /> твоя уютная волна{" "}
          <Icon name="heart" size={15} />
        </div>
        <div className="art-sticker">
          ON AIR<span>{clock} · ЕКБ</span>
        </div>
      </div>
      <div className="hero-index" aria-hidden="true">
        01 / YOUR HAPPY PLACE
      </div>
    </section>
  );
}
