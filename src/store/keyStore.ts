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

// ------------------------------------------------ sharing with the extension

/** The open keys as the 2keevo extension stores them (base64url). */
export type SharedVaultKeys = { userKey: string; privateKey: string; publicKey: string };

const SHARE_CHANNEL = "keevo.vaultKeys.share";

const serialize = (keys: UnlockedKeys): SharedVaultKeys => ({
  userKey: toB64url(keys.userKey),
  privateKey: toB64url(keys.privateKey),
  publicKey: keys.publicKey,
});

// The extension's sign-in window opens in a new tab, which has no keys of its
// own. An unlocked 2keevo tab of this browser (same origin only) answers it,
// so the extension opens unlocked instead of asking for the master password.
if (typeof BroadcastChannel !== "undefined") {
  const channel = new BroadcastChannel(SHARE_CHANNEL);
  channel.onmessage = (event) => {
    const data = event.data;
    if (data?.type !== "request" || typeof data.id !== "string") return;
    const keys = useKeyStore.getState().keys;
    if (!keys) return;
    channel.postMessage({ type: "keys", id: data.id, keys: serialize(keys) });
  };
}

/** The open vault keys from this tab, or from another unlocked 2keevo tab; null when none answers. */
export const findOpenVaultKeys = (timeoutMs = 1000): Promise<SharedVaultKeys | null> => {
  const own = useKeyStore.getState().keys;
  if (own) return Promise.resolve(serialize(own));
  if (typeof BroadcastChannel === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new BroadcastChannel(SHARE_CHANNEL);
    const id = crypto.randomUUID();
    const done = (keys: SharedVaultKeys | null) => {
      window.clearTimeout(timer);
      channel.close();
      resolve(keys);
    };
    const timer = window.setTimeout(() => done(null), timeoutMs);
    channel.onmessage = (event) => {
      const data = event.data;
      if (data?.type === "keys" && data.id === id && data.keys?.userKey) done(data.keys);
    };
    channel.postMessage({ type: "request", id });
  });
};
