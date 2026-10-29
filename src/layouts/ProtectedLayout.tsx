import { Spin, message } from "antd";
import React, { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import LockScreen from "../components/lock/LockScreen";
import { E2EBanner, E2EGate } from "../components/lock/E2EDeadline";
import OfflineScreen from "../components/pwa/OfflineScreen";
import CommandPalette from "../components/shell/CommandPalette";
import AuthenticatorImportModal from "../components/shell/AuthenticatorImportModal";
import ImportPasswordsModal from "../components/shell/ImportPasswordsModal";
import UpgradeModal from "../components/billing/UpgradeModal";
import { useBillingStore } from "../store/billingStore";
import TopBar from "../components/shell/TopBar";
import VaultSidebar from "../components/shell/VaultSidebar";
import useAuth from "../hooks/useAuth";
import useAutoLock from "../hooks/useAutoLock";
import { useAuthStore } from "../store/authStore";
import { useCompanyStore } from "../store/companyStore";
import { useKeyStore } from "../store/keyStore";
import { useLockStore } from "../store/lockStore";
import { useVaultStore } from "../store/vaultStore";
import { forgetVaultData } from "../utils/autoLock";
import { migrateItems, runKeyTasks } from "../utils/vaultItems";
import { runRecoveryTasks } from "../utils/companyRecovery";
import { MasterPasswordModal } from "../pages/settings/EncryptionSection";

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
  // End-to-end accounts need their vault keys open (new tab, passkey sign-in…).
  const vaultKeys = useKeyStore((state) => state.keys);
  const needsKeys = !!me?.e2eEnabled && !vaultKeys;
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
      else {
        // Back to this page after signing in (a link from an email or the website).
        const here = location.pathname + location.search;
        navigate(here === "/" ? "/auth/login" : `/auth/login?next=${encodeURIComponent(here)}`);
      }
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

  // What the plan allows (limits, password health), once signed in and unlocked.
  useEffect(() => {
    if (me && !locked) useBillingStore.getState().load();
  }, [me, locked]);

  // End-to-end vaults, once the keys are open: first the key work for shared
  // collections this person manages (encrypt, give access, replace keys), then
  // encrypt their existing items here. Then show the list again.
  useEffect(() => {
    if (!me?.e2eEnabled || !vaultKeys || locked) return;
    (async () => {
      let granted = 0;
      try {
        granted = await runKeyTasks();
      } catch (error: any) {
        console.error("Could not finish key work:", error?.message || error);
      }
      if (granted) message.success(granted === 1 ? "1 person can now open shared items" : `${granted} people can now open shared items`);
      // Company admin recovery: this person's copy for their companies, and owner/admin work.
      await runRecoveryTasks().catch((error) => console.error("Could not finish recovery work:", error?.message || error));
      const moved = await migrateItems().catch((error) => {
        console.error("Could not encrypt items:", error?.message || error);
        return 0;
      });
      if (!moved && !granted) return;
      refreshVault();
      useVaultStore.getState().bumpList();
    })();
  }, [me?.e2eEnabled, vaultKeys, locked, refreshVault]);

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

  // Accounts without end-to-end encryption: a reminder before the deadline, a gate after it.
  const e2eDeadline: string | null = !me?.e2eEnabled && me?.e2eDeadline ? me.e2eDeadline : null;
  if (me && e2eDeadline && new Date(e2eDeadline).getTime() <= Date.now()) {
    return <E2EGate deadline={e2eDeadline} />;
  }

  if (me && (locked || needsKeys)) {
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
      {e2eDeadline && <E2EBanner deadline={e2eDeadline} />}
      {/* A company admin set a temporary master password: the person chooses their own first. */}
      {me?.mustChangeMasterPassword && vaultKeys && <MasterPasswordModal mode="password" forced onClose={() => undefined} />}
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
      <UpgradeModal />
    </div>
  );
};

export default ProtectedLayout;
