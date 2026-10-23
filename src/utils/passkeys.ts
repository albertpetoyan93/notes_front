// Passkeys for signing in to 2keevo itself (WebAuthn), on top of @simplewebauthn/browser.
import {
  browserSupportsWebAuthn,
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  startRegistration,
  WebAuthnAbortService,
} from "@simplewebauthn/browser";
import { fetcherPost } from "../configs/axios";
import { browserAndOs } from "./device";

export interface PasskeyRow {
  id: number;
  name: string;
  synced: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

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
    password,
  });
  let response;
  try {
    response = await startRegistration({ optionsJSON: options });
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
    optionsJSON: options,
    useBrowserAutofill: autofill,
  });
  return fetcherPost("/api/auth/passkeys/login/verify", { challengeToken, response });
};

/** Unlock a locked vault with one of the signed-in account's passkeys. */
export const unlockWithPasskey = async () => {
  const { options, challengeToken } = await fetcherPost("/api/auth/unlock/passkey/options", {});
  const response = await startAuthentication({ optionsJSON: options });
  return fetcherPost("/api/auth/unlock/passkey", { challengeToken, response });
};

/** Stop a waiting autofill request, e.g. when the sign-in page closes. */
export const cancelPasskeyRequest = () => WebAuthnAbortService.cancelCeremony();
