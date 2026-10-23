import { CloudOutlined, DisconnectOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import "./AppStatus.scss";

const CHECK_FOR_UPDATES_MS = 60 * 60 * 1000;

// Two bars at the edge of the screen: "you're offline", and "a new version is
// ready". The app updates only when the person reloads, so nothing they're
// typing is lost.
const AppStatus = () => {
  const [online, setOnline] = useState(() => navigator.onLine);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
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
      {needRefresh && (
        <div className="app-status is-update" role="status">
          <CloudOutlined />
          <span>A new version of 2keevo is ready.</span>
          <Button size="small" type="primary" onClick={reload}>
            Reload
          </Button>
          <Button size="small" type="text" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
        </div>
      )}
    </>
  );
};

export default AppStatus;
