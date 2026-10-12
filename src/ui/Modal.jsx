import { useEffect, useRef, useId, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "./Icon";
export default function Modal({
  title,
  eyebrow,
  onClose,
  children,
  wide = false,
}) {
  const ref = useRef(null);
  const id = useId();
  const [host, setHost] = useState(
    () => document.fullscreenElement || document.body,
  );
  useEffect(() => {
    const update = () => setHost(document.fullscreenElement || document.body);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
      if (event.key !== "Tab") return;
      const elements = [
        ...ref.current.querySelectorAll(
          'button:not(:disabled), input, select, textarea, [tabindex="0"]',
        ),
      ].filter((element) => element.offsetParent !== null);
      if (!elements.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0],
        last = elements.at(-1);
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          document.activeElement === ref.current)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [onClose, host]);
  return createPortal(
    <div
      className="modal-scrim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className={`modal-card ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <header className="modal-heading">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={id}>{title}</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Закрыть окно"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-content">{children}</div>
      </section>
    </div>,
    host,
  );
}
