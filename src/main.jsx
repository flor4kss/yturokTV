import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import App from "./App.jsx";
import "../style.css";

flushSync(() => createRoot(document.getElementById("root")).render(<App />));
import("./tvController.js")
  .then(async ({ initializeTV }) => {
    await initializeTV();
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  })
  .catch((error) => {
    console.error(error);
    document
      .getElementById("root")
      .append("Не удалось запустить эфир. Перезагрузите страницу.");
  });
