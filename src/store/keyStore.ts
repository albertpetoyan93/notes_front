import { create } from "zustand";
import { fromB64url, toB64url } from "../crypto/e2e";
import type { UnlockedKeys } from "../crypto/account";

// The open vault keys (end-to-end accounts). Kept in memory, and in this tab's
// session storage so a reload doesn't ask for the master password again.
// Cleared on lock and sign-out, and by the browser when the tab closes.
const STORAGE_KEY = "keevo.vaultKeys";

const load = (): UnlockedKeys | null => {
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    const data = JSON.parse(saved);
    return {
      userKey: fromB64url(data.userKey),
      privateKey: fromB64url(data.privateKey),
      publicKey: data.publicKey,
    };
  } catch {
    return null;
  }
};

const save = (keys: UnlockedKeys | null) => {
  try {
    if (!keys) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        userKey: toB64url(keys.userKey),
        privateKey: toB64url(keys.privateKey),
        publicKey: keys.publicKey,
      })
    );
  } catch {
    /* Private mode: memory only; a reload asks for the master password. */
  }
};

type KeyStore = {
  keys: UnlockedKeys | null;
  setKeys: (keys: UnlockedKeys | null) => void;
};

export const useKeyStore = create<KeyStore>()((set) => ({
  keys: load(),
  setKeys: (keys) => {
    save(keys);
    set({ keys });
  },
}));

export const forgetVaultKeys = () => useKeyStore.getState().setKeys(null);
