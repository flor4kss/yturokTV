import {subscribeNetworkBudget,getNetworkBudget} from "../networkBudget";
import { useEffect, useState, useSyncExternalStore } from "react";
import { usablePoster } from "../programMetadata";
export default function Poster({ src, title = "", className = "", color }) {
  const constrained=useSyncExternalStore(subscribeNetworkBudget,getNetworkBudget);
  const [shown,setShown]=useState(null);
  useEffect(()=>{if(!constrained)setShown(src);},[constrained,src]);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div
      className={`poster ${className}`}
      style={{ "--poster-color": color || "#bcddd7" }}
    >
      {usablePoster(shown) && shown===src && !failed ? (
        <img src={shown} alt="" loading="lazy" decoding="async" fetchPriority="low" onError={() => setFailed(true)} />
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
