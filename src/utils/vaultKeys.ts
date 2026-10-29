// Signing in and unlocking for end-to-end accounts: the steps between the
// master password and an open vault.
import { fetcherGet, fetcherPost } from "../configs/axios";
import { openBundle, signInKeys, type KdfSettings, type KeyBundle } from "../crypto/account";
import { useAuthStore } from "../store/authStore";
import { useKeyStore } from "../store/keyStore";

export interface Prelogin {
  e2e: boolean;
  kdf?: KdfSettings;
}

export const prelogin = (email: string): Promise<Prelogin> =>
  fetcherPost("/api/auth/prelogin", { email });

/** The master key from the master password, for an end-to-end account. */
export const masterKeysFor = async (email: string, password: string) => {
  const info = await prelogin(email);
  if (!info.e2e || !info.kdf) return null;
  return signInKeys(password, info.kdf);
};

/**
 * What to send where the server checks "your password" for a signed-in
 * account: end-to-end accounts send the sign-in key made from the master
 * password, never the password itself.
 */
export const passwordProof = async (password: string) => {
  const me = useAuthStore.getState().me;
  if (!me?.e2eEnabled) return password;
  const keys = await masterKeysFor(String(me.email || ""), password);
  return keys ? keys.authKey : password;
};

/** Opens the vault with a master key: fetches the locked keys and opens them here. */
export const openVault = async (masterKey: Uint8Array, bundle?: KeyBundle | null) => {
  const keys = bundle || (await fetcherGet("/api/auth/e2e/keys")).keys;
  if (!keys) return;
  useKeyStore.getState().setKeys(await openBundle(masterKey, keys));
};
