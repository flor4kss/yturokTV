import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import App from "./App.jsx";
import { initializeTV, tv } from "./tvController.js";
import "../style.css";
import { installTvRemote } from "./tvRemote";

flushSync(() => createRoot(document.getElementById("root")).render(<App />));
installTvRemote();
initializeTV()
  .then(() => {
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.onerror = () => tv.sourceFailure();
    document.head.appendChild(script);
  })
  .catch((error) => {
    console.error(error);
    document
      .getElementById("root")
      .append("Не удалось запустить эфир. Перезагрузите страницу.");
  });
