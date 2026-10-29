import { CloudOutlined, DisconnectOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useLockStore } from "../../store/lockStore";
import "./AppStatus.scss";

const CHECK_FOR_UPDATES_MS = 60 * 60 * 1000;
// While locked, how often to try again when the person is typing their password.
const LOCKED_RETRY_MS = 30 * 1000;

/** Someone is typing (the unlock password, say): reloading now would lose it. */
const typing = () => {
  const active = document.activeElement;
  return active instanceof HTMLInputElement && active.value !== "";
};

// Two bars at the edge of the screen: "you're offline", and "a new version is
// ready". The app updates when the person reloads, so nothing they're typing is
// lost; while the vault is locked nothing is open, so it updates on its own.
// Otherwise a tab could keep running an old version (and its old bugs) for days.
const AppStatus = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  const locked = useLockStore((state) => state.locked);
  // "Later" hides the bar only: the update still waits, and applies on the next lock.
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // An installed app can stay open for days: look for a new version hourly.
      window.setInterval(() => registration.update().catch(() => undefined), CHECK_FOR_UPDATES_MS);
    },
  });

  // Usually the new version waits, and takes over on reload. On a first visit
  // the page isn't controlled yet, so the new version is already active and a
  // plain reload is all it takes.
  const reload = async () => {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration?.waiting) updateServiceWorker(true);
    else window.location.reload();
  };

  useEffect(() => {
    if (!locked || !needRefresh) return undefined;
    const apply = () => {
      if (!typing()) reload();
    };
    apply();
    const timer = window.setInterval(apply, LOCKED_RETRY_MS);
    return () => window.clearInterval(timer);
    // reload is recreated every render; the lock and the update are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked, needRefresh]);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return (
    <>
      {!online && (
        <div className="app-status is-offline" role="status">
          <DisconnectOutlined />
          <span>You're offline. 2keevo needs a connection to show your vault.</span>
        </div>
      )}
      {needRefresh && !dismissed && (
        <div className="app-status is-update" role="status">
          <CloudOutlined />
          <span>A new version of 2keevo is ready.</span>
          <Button size="small" type="primary" onClick={reload}>
            Reload
          </Button>
          <Button size="small" type="text" onClick={() => setDismissed(true)}>
            Later
          </Button>
        </div>
      )}
    </>
  );
};

export default AppStatus;
