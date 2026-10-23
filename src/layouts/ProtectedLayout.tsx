import { Spin } from "antd";
import React, { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import LockScreen from "../components/lock/LockScreen";
import OfflineScreen from "../components/pwa/OfflineScreen";
import CommandPalette from "../components/shell/CommandPalette";
import AuthenticatorImportModal from "../components/shell/AuthenticatorImportModal";
import ImportPasswordsModal from "../components/shell/ImportPasswordsModal";
import TopBar from "../components/shell/TopBar";
import VaultSidebar from "../components/shell/VaultSidebar";
import useAuth from "../hooks/useAuth";
import useAutoLock from "../hooks/useAutoLock";
import { useAuthStore } from "../store/authStore";
import { useCompanyStore } from "../store/companyStore";
import { useLockStore } from "../store/lockStore";
import { useVaultStore } from "../store/vaultStore";
import { forgetVaultData } from "../utils/autoLock";

// The signed-in app: top bar, vault sidebar and the page. On phones the sidebar is a drawer.
const ProtectedLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getMe } = useAuth();
  const { me } = useAuthStore();
  const loadCompanies = useCompanyStore((state) => state.load);
  const setScope = useVaultStore((state) => state.setScope);
  const refreshVault = useVaultStore((state) => state.refresh);
  const locked = useLockStore((state) => state.locked);
  const setLocked = useLockStore((state) => state.setLocked);
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // The session check failed because there's no connection (not signed out).
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const companyId = location.pathname.startsWith("/company/")
    ? Number(location.pathname.split("/")[2]) || null
    : null;

  useEffect(() => {
    if (me) return;

    let cancelled = false;
    const signedOut = () => {
      if (cancelled) return;
      // No connection is not the same as signed out: wait for it instead.
      if (!navigator.onLine) setOffline(true);
      else navigate("/auth/login");
    };
    getMe()
      .then((res) => {
        if (cancelled) return;
        if (res) setOffline(false);
        else signedOut();
      })
      .catch(signedOut);

    return () => {
      cancelled = true;
    };
    // Session check runs once, and again on "Try again" or when back online.
    // Later logins update the store themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  useEffect(() => {
    if (!offline) return undefined;
    const retry = () => setAttempt((value) => value + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, [offline]);

  useAutoLock(!!me);

  // A session that was already locked (idle with the tab closed) opens locked.
  useEffect(() => {
    if (me?.locked) setLocked(true);
  }, [me?.locked, setLocked]);

  // Nothing readable stays in memory while locked.
  useEffect(() => {
    if (locked) forgetVaultData();
  }, [locked]);

  useEffect(() => {
    if (!locked) loadCompanies();
  }, [loadCompanies, locked]);

  useEffect(() => {
    setScope(companyId);
  }, [companyId, setScope]);

  // Picking anything in the drawer closes it.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!me && offline) {
    return <OfflineScreen onRetry={() => setAttempt((value) => value + 1)} />;
  }

  if (me && locked) {
    return (
      <LockScreen
        onUnlocked={() => {
          useAuthStore.getState().setStore({ me: { ...me, locked: false } });
          refreshVault();
        }}
      />
    );
  }

  return (
    <div className="app-shell">
      <TopBar
        companyId={companyId}
        onMenu={() => setNavOpen(true)}
        onSearch={() => setPaletteOpen(true)}
      />
      <div className="app-body">
        <aside className={navOpen ? "sidebar is-open" : "sidebar"} aria-label="Vault navigation">
          <VaultSidebar companyId={companyId} />
        </aside>
        {navOpen && (
          <button
            type="button"
            className="sidebar-scrim"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          />
        )}
        <main className="app-main">
          <Suspense
            fallback={
              <div className="page-loading">
                <Spin />
              </div>
            }
          >
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        companyId={companyId}
      />
      {/* Imports go to the personal vault. */}
      {!companyId && <ImportPasswordsModal />}
      {!companyId && <AuthenticatorImportModal />}
    </div>
  );
};

export default ProtectedLayout;
