import { useEffect, useState } from "react";
import { usablePoster } from "../programMetadata";
export default function Poster({ src, title = "", className = "", color }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div
      className={`poster ${className}`}
      style={{ "--poster-color": color || "#bcddd7" }}
    >
      {usablePoster(src) && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="poster-fallback" aria-hidden="true">
          <strong>
            {title
              .trim()
              .split(/\s+/)
              .filter((word) => word.length > 1)
              .slice(0, 2)
              .map((word) => word[0])
              .join("")
              .toUpperCase() || "TV"}
          </strong>
          <small>ЭФИР</small>
        </div>
      )}
    </div>
  );
}
