import { Spin } from "antd";
import React, { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import CommandPalette from "../components/shell/CommandPalette";
import TopBar from "../components/shell/TopBar";
import VaultSidebar from "../components/shell/VaultSidebar";
import useAuth from "../hooks/useAuth";
import { useAuthStore } from "../store/authStore";
import { useCompanyStore } from "../store/companyStore";
import { useVaultStore } from "../store/vaultStore";

// The signed-in app: top bar, vault sidebar and the page. On phones the sidebar is a drawer.
const ProtectedLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { getMe } = useAuth();
  const { me } = useAuthStore();
  const loadCompanies = useCompanyStore((state) => state.load);
  const setScope = useVaultStore((state) => state.setScope);
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const companyId = location.pathname.startsWith("/company/")
    ? Number(location.pathname.split("/")[2]) || null
    : null;

  useEffect(() => {
    if (me) return;

    let cancelled = false;
    getMe()
      .then((res) => {
        if (!cancelled && !res) {
          navigate("/auth/login");
        }
      })
      .catch(() => {
        if (!cancelled) {
          navigate("/auth/login");
        }
      });

    return () => {
      cancelled = true;
    };
    // Session check runs once. Later logins update the store themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

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
    </div>
  );
};

export default ProtectedLayout;
