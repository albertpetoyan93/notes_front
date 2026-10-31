// Emergency access (plans/vault-features.md, phase A): the owner's user key,
// sealed by the owner's browser to a trusted contact's public key. Bound to the
// contact row, so the server can't hand one contact's copy to another.
import { E2EError, openSealed, sealTo } from "./e2e";

const context = (contactRowId: number) => `emergency-access:${contactRowId}`;

export const sealUserKeyForContact = (contactPublicKey: string, contactRowId: number, userKey: Uint8Array) =>
  sealTo(contactPublicKey, userKey, context(contactRowId));

export const openOwnerUserKey = async (myPrivateKey: Uint8Array, myPublicKey: string, contactRowId: number, token: string) => {
  const key = await openSealed(myPrivateKey, myPublicKey, token, context(contactRowId));
  if (key.length !== 32) throw new E2EError("bad-key");
  return key;
};
