import { useEffect, useState } from "react";
import Icon from "./Icon";
export default function Poster({ src, title = "", className = "", color }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div
      className={`poster ${className}`}
      style={{ "--poster-color": color || "#bcddd7" }}
    >
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="poster-fallback" aria-hidden="true">
          <Icon name="sparkles" size={22} />
          <span>{title.slice(0, 1) || "TV"}</span>
        </div>
      )}
    </div>
  );
}
