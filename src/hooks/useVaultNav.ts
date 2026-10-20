import { useCallback } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { categoryKey } from "../utils/noteCategory";

export type VaultView = "all" | "favorites" | "shared" | "trash" | "health";

// Every key that narrows the list. Going to a section clears them all first.
const NAV_KEYS = [
  "category",
  "collection",
  "tag",
  "shared",
  "trash",
  "favorites",
  "health",
  "item",
  "new",
  "search",
  "tab",
];

const isPhone = () => window.matchMedia("(max-width: 820px)").matches;

// Pages that show the vault list; anywhere else (settings), going to a
// section leaves the page for the personal vault.
const isVaultPath = (pathname: string) =>
  pathname === "/" || pathname === "/notes" || pathname.startsWith("/company/");

// The vault's place lives in the URL, so every view can be linked and reloaded.
const useVaultNav = () => {
  const [params, setParams] = useSearchParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const view: VaultView =
    params.get("trash") === "true"
      ? "trash"
      : params.get("shared") === "true"
        ? "shared"
        : params.get("favorites") === "true"
          ? "favorites"
          : params.get("health")
            ? "health"
            : "all";

  const item = Number(params.get("item")) || null;

  // `push` adds a history entry, so the phone's Back button leaves the item.
  const update = useCallback(
    (updates: Record<string, string | null | undefined>, push = false) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(updates).forEach(([key, value]) => {
            if (!value || value === "all") next.delete(key);
            else next.set(key, value);
          });
          return next;
        },
        { replace: !push }
      );
    },
    [setParams]
  );

  const go = useCallback(
    (updates: Record<string, string | null | undefined> = {}) => {
      if (!isVaultPath(pathname)) {
        const next = new URLSearchParams();
        Object.entries(updates).forEach(([key, value]) => {
          if (value && value !== "all") next.set(key, value);
        });
        const query = next.toString();
        navigate(query ? `/notes?${query}` : "/notes");
        return;
      }
      const cleared: Record<string, string | null> = {};
      NAV_KEYS.forEach((key) => {
        cleared[key] = null;
      });
      update({ ...cleared, ...updates });
    },
    [update, pathname, navigate]
  );

  const selectItem = useCallback(
    (id: number | null) => update({ item: id ? String(id) : null, new: null }, !!id && isPhone()),
    [update]
  );

  return {
    view,
    category: categoryKey(params.get("category") || ""),
    collection: params.get("collection") || "",
    tag: params.get("tag") || "",
    health: params.get("health") || "",
    search: params.get("search") || "",
    item,
    newCategory: params.get("new") || "",
    tab: params.get("tab") || "",
    update,
    go,
    selectItem,
  };
};

export default useVaultNav;
