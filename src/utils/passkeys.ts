// Passkeys for signing in to 2keevo itself (WebAuthn), on top of @simplewebauthn/browser.
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from "@simplewebauthn/browser";
import { fetcherPost } from "../configs/axios";
import { openBundleWithUserKey, openUserKeyWithPasskey, wrapUserKeyForPasskey, type KeyBundle } from "../crypto/account";
import { PASSKEY_PRF_SALT } from "../crypto/e2e";
import { useKeyStore } from "../store/keyStore";
import { browserAndOs } from "./device";
import { passwordProof } from "./vaultKeys";

export interface PasskeyRow {
  id: number;
  name: string;
  synced: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  /** End-to-end accounts: this passkey also opens the vault. */
  unlocksVault?: boolean;
}

// ---------------------------------------------------------------- vault unlock (PRF, stage 10.2b)

/** Ask the passkey for its PRF secret too (ignored by passkeys that can't). */
const withPrf = <T extends { extensions?: Record<string, unknown> }>(options: T): T => ({
  ...options,
  extensions: { ...(options.extensions || {}), prf: { eval: { first: PASSKEY_PRF_SALT } } },
});

/**
 * The PRF secret, taken out of the response: it opens the vault, so it must
 * never be sent to the server with the rest.
 */
const takePrf = (response: { clientExtensionResults?: Record<string, any> }) => {
  const results = response.clientExtensionResults;
  const first = results?.prf?.results?.first as ArrayBuffer | ArrayBufferView | undefined;
  if (results) delete results.prf;
  if (!first) return null;
  return first instanceof ArrayBuffer
    ? new Uint8Array(first)
    : new Uint8Array(first.buffer, first.byteOffset, first.byteLength);
};

interface PasskeyAnswer {
  keys?: KeyBundle | null;
  passkeyUserKey?: string | null;
}

/** After a passkey sign-in or unlock: open the vault if this passkey can. True if it did. */
const openVaultWith = async (prf: Uint8Array | null, answer: PasskeyAnswer) => {
  if (!prf || !answer?.keys || !answer.passkeyUserKey) return false;
  try {
    const userKey = await openUserKeyWithPasskey(prf, answer.passkeyUserKey);
    useKeyStore.getState().setKeys(await openBundleWithUserKey(userKey, answer.keys));
    return true;
  } catch {
    return false;
  }
};

/**
 * Let one of your passkeys open the vault: the passkey signs once more and
 * gives its PRF secret, which locks a copy of the open user key.
 */
export const enablePasskeyUnlock = async (): Promise<PasskeyRow> => {
  const keys = useKeyStore.getState().keys;
  if (!keys) throw new Error("Unlock your vault first.");
  const { options, challengeToken } = await fetcherPost("/api/auth/unlock/passkey/options", {});
  let response;
  try {
    response = await startAuthentication({ optionsJSON: withPrf(options) });
  } catch (error) {
    if (isCancelled(error)) throw error;
    throw new Error(browserErrorText(error, "Could not use the passkey."));
  }
  const prf = takePrf(response);
  if (!prf) {
    throw new Error("This passkey can't unlock the vault: its device or password manager doesn't support it yet.");
  }
  return fetcherPost("/api/auth/passkeys/unlock-key", {
    challengeToken,
    response,
    prfUserKey: await wrapUserKeyForPasskey(prf, keys.userKey),
  });
};

export const passkeysSupported = () => browserSupportsWebAuthn();

export const passkeyAutofillSupported = () => browserSupportsWebAuthnAutofill();

/** A starting name for a new passkey, like "Chrome on Windows". */
export const suggestedPasskeyName = () => browserAndOs(navigator.userAgent) || "Passkey";

/** Closing the browser's passkey sheet is not an error worth showing. */
export const isCancelled = (error: unknown) => {
  const name = (error as { name?: string })?.name;
  return name === "NotAllowedError" || name === "AbortError";
};

const browserErrorText = (error: unknown, fallback: string) => {
  const name = (error as { name?: string })?.name;
  if (name === "InvalidStateError") return "This device already has a 2keevo passkey for your account.";
  if (name === "SecurityError") return "Passkeys don't work on this address. Use the 2keevo app address.";
  return (error as { message?: string })?.message || fallback;
};

/** Ask for the password, let the device create a passkey, and save it. */
export const addPasskey = async (password: string, name: string): Promise<PasskeyRow> => {
  const { options, challengeToken } = await fetcherPost("/api/auth/passkeys/register/options", {
    password: await passwordProof(password),
  });
  let response;
  try {
    // Ask for PRF support now: some passkeys can only give a PRF secret (to
    // unlock an end-to-end vault) if it was asked for when they were made.
    response = await startRegistration({
      optionsJSON: { ...options, extensions: { ...(options.extensions || {}), prf: {} } },
    });
  } catch (error) {
    if (isCancelled(error)) throw error;
    throw new Error(browserErrorText(error, "Could not create the passkey."));
  }
  return fetcherPost("/api/auth/passkeys/register/verify", { challengeToken, response, name });
};

/**
 * Sign in with a passkey. With `autofill`, the passkeys appear in the email field's
 * suggestions instead of a dialog, and the promise waits until one is picked.
 * Starting one cancels any other that is waiting.
 */
export const signInWithPasskey = async (autofill = false) => {
  const { options, challengeToken } = await fetcherPost("/api/auth/passkeys/login/options", {});
  const response = await startAuthentication({
    optionsJSON: withPrf(options),
    useBrowserAutofill: autofill,
  });
  const prf = takePrf(response);
  const answer = await fetcherPost("/api/auth/passkeys/login/verify", { challengeToken, response });
  // End-to-end accounts: the vault opens too if this passkey can; otherwise it asks for the master password.
  await openVaultWith(prf, answer);
  return answer;
};

/**
 * Unlock a locked vault with one of the signed-in account's passkeys. For
 * end-to-end accounts, `vaultOpened` says whether the passkey also opened the keys.
 */
export const unlockWithPasskey = async () => {
  const { options, challengeToken } = await fetcherPost("/api/auth/unlock/passkey/options", {});
  const response = await startAuthentication({ optionsJSON: withPrf(options) });
  const prf = takePrf(response);
  const answer = await fetcherPost("/api/auth/unlock/passkey", { challengeToken, response });
  return { ...answer, vaultOpened: await openVaultWith(prf, answer) };
};

/** Stop a waiting autofill request, e.g. when the sign-in page closes. */
export const cancelPasskeyRequest = () => WebAuthnAbortService.cancelCeremony();
