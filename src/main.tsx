import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./assets/config_styles.scss";
import "./index.scss";
// Catches the browser's install prompt before React starts.
import "./utils/installApp";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
