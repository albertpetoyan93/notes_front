// Per-user settings that would reveal something about the vault (first: dismissed breach
// alerts, which name the sites you have logins on). Encrypted here with the user key; the
// server keeps an opaque token (users."sealedSettings", /api/sealed-settings) it can't read.

import { fetcherGet, fetcherPut } from "../configs/axios";
import { decryptJson, encryptJson } from "../crypto/e2e";

export interface SealedSettings {
  /** HIBP breach names the user dismissed. */
  dismissedBreaches?: string[];
}

const CONTEXT = "2keevo/sealed-settings/v1";

export const loadSealedSettings = async (userKey: Uint8Array): Promise<SealedSettings> => {
  const data = await fetcherGet("/api/sealed-settings");
  if (!data?.sealedSettings) return {};
  try {
    const value = await decryptJson<SealedSettings>(userKey, data.sealedSettings, CONTEXT);
    return value && typeof value === "object" ? value : {};
  } catch {
    // Unreadable (e.g. written with an older key): start fresh rather than block the vault.
    return {};
  }
};

export const saveSealedSettings = async (userKey: Uint8Array, settings: SealedSettings) => {
  await fetcherPut("/api/sealed-settings", { sealedSettings: await encryptJson(userKey, settings, CONTEXT) });
};
