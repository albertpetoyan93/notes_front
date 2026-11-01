import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./assets/config_styles.scss";
import "./index.scss";
// Catches the browser's install prompt before React starts.
import "./utils/installApp";
import { rememberVisitSource } from "./utils/signupSource";

// Someone arriving from a tagged link straight on app.2keevo.com (e.g. a Facebook "Sign up" button).
rememberVisitSource();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
