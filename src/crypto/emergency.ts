// Emergency access (plans/vault-features.md, phase A; plan 2026-11-20-emergency-key.md).
//
// The owner's browser makes an **emergency key** that opens only the owner's
// personal items: each personal item's key and each personal collection's name
// is copied under it. That key, never the user key, is sealed to each trusted
// contact. Every copy is bound to where it belongs (owner, contact row, item,
// collection, key version), so the server can't hand one copy out as another.
import { E2EError, decryptJson, encryptJson, newSymmetricKey, openSealed, sealTo, unwrapKey, wrapKey } from "./e2e";

// ------------------------------------------------ before migration 058: the user key

const legacyContext = (contactRowId: number) => `emergency-access:${contactRowId}`;

/** Kept for tests of old copies: new confirmations seal the emergency key instead. */
export const sealUserKeyForContact = (contactPublicKey: string, contactRowId: number, userKey: Uint8Array) =>
  sealTo(contactPublicKey, userKey, legacyContext(contactRowId));

/** A contact confirmed before the emergency key: their copy is the owner's user key. */
export const openOwnerUserKey = async (myPrivateKey: Uint8Array, myPublicKey: string, contactRowId: number, token: string) => {
  const key = await openSealed(myPrivateKey, myPublicKey, token, legacyContext(contactRowId));
  if (key.length !== 32) throw new E2EError("bad-key");
  return key;
};

// ------------------------------------------------ the emergency key

const ownerContext = (ownerId: number, version: number) => `emergency-key:${ownerId}:${version}`;
const contactContext = (contactRowId: number, version: number) => `emergency-access:${contactRowId}:${version}`;
const itemContext = (e2eId: string, version: number) => `emergency-item:${e2eId}:${version}`;
const nameContext = (collectionId: number, version: number) => `emergency-collection:${collectionId}:${version}`;

export const newEmergencyKey = () => newSymmetricKey();

/** The owner keeps their emergency key on the server, wrapped with their user key. */
export const wrapEmergencyKey = (userKey: Uint8Array, ownerId: number, version: number, key: Uint8Array) =>
  wrapKey(userKey, key, ownerContext(ownerId, version));

export const openEmergencyKey = (userKey: Uint8Array, ownerId: number, version: number, token: string) =>
  unwrapKey(userKey, token, ownerContext(ownerId, version));

/** The owner's browser seals the emergency key to a contact. */
export const sealEmergencyKeyFor = (contactPublicKey: string, contactRowId: number, version: number, key: Uint8Array) =>
  sealTo(contactPublicKey, key, contactContext(contactRowId, version));

/** The contact's browser, once access is granted. */
export const openEmergencyKeyAsContact = async (
  myPrivateKey: Uint8Array,
  myPublicKey: string,
  contactRowId: number,
  version: number,
  token: string
) => {
  const key = await openSealed(myPrivateKey, myPublicKey, token, contactContext(contactRowId, version));
  if (key.length !== 32) throw new E2EError("bad-key");
  return key;
};

/** A personal item's key, copied under the emergency key. */
export const wrapItemForEmergency = (emergencyKey: Uint8Array, e2eId: string, version: number, itemKey: Uint8Array) =>
  wrapKey(emergencyKey, itemKey, itemContext(e2eId, version));

export const openItemFromEmergency = (emergencyKey: Uint8Array, e2eId: string, version: number, token: string) =>
  unwrapKey(emergencyKey, token, itemContext(e2eId, version));

/** A personal collection's name, encrypted with the emergency key. */
export const sealNameForEmergency = (emergencyKey: Uint8Array, collectionId: number, version: number, name: string) =>
  encryptJson(emergencyKey, { name }, nameContext(collectionId, version));

export const openNameFromEmergency = async (emergencyKey: Uint8Array, collectionId: number, version: number, token: string) => {
  const { name } = await decryptJson<{ name: string }>(emergencyKey, token, nameContext(collectionId, version));
  return String(name || "");
};

// ------------------------------------------------ the contact's key, as the owner checked it

const pinContext = (ownerId: number, contactRowId: number) => `emergency-contact-key:${ownerId}:${contactRowId}`;

/**
 * The contact's public key as the owner checked it (fingerprint, at confirm) or first
 * saw it (contacts confirmed before the emergency key), kept under the owner's user key.
 * A new emergency key is sealed only to this key, so a changed key on the server
 * can't redirect it.
 */
export const pinContactKey = (userKey: Uint8Array, ownerId: number, contactRowId: number, publicKey: string) =>
  encryptJson(userKey, { publicKey }, pinContext(ownerId, contactRowId));

export const openPinnedContactKey = async (userKey: Uint8Array, ownerId: number, contactRowId: number, token: string) => {
  const { publicKey } = await decryptJson<{ publicKey: string }>(userKey, token, pinContext(ownerId, contactRowId));
  return String(publicKey || "");
};
