import { describe, expect, it } from "vitest";
import { createAccountKeys, openBundleWithUserKey } from "./account";
import { DEFAULT_KDF, generateKeyPair } from "./e2e";
import { openOwnerUserKey, sealUserKeyForContact } from "./emergency";
import { openItemData, openItemKey, sealNewItem } from "./items";

const FAST = { ...DEFAULT_KDF, memory: 32 * 1024, iterations: 2 };

describe("emergency access", () => {
  it("a contact opens the owner's items with the sealed user key", async () => {
    const owner = await createAccountKeys("the owner's master password", FAST);
    const contact = await generateKeyPair();
    const { sealed } = await sealNewItem(owner.unlocked.userKey, {
      title: "Bank",
      content: { mainContent: "", customFields: [{ label: "Password", value: "s3cret" }] },
      tags: [],
      category: "login",
    });

    // The owner's browser, when confirming the contact (row 12).
    const forContact = await sealUserKeyForContact(contact.publicKey, 12, owner.unlocked.userKey);

    // The contact's browser, once access is granted.
    const userKey = await openOwnerUserKey(contact.privateKey, contact.publicKey, 12, forContact);
    const itemKey = await openItemKey(userKey, sealed.e2eId, sealed.itemKey);
    const item = await openItemData(itemKey, sealed.e2eId, sealed.encData);
    expect(item.title).toBe("Bank");

    // And the owner's private key, for collection names sealed with a collection key.
    const keys = await openBundleWithUserKey(userKey, owner.request as any);
    expect(Buffer.from(keys.privateKey).equals(Buffer.from(owner.unlocked.privateKey))).toBe(true);
  });

  it("a copy only opens for its own contact row and person", async () => {
    const owner = await createAccountKeys("the owner's master password", FAST);
    const contact = await generateKeyPair();
    const stranger = await generateKeyPair();
    const forContact = await sealUserKeyForContact(contact.publicKey, 12, owner.unlocked.userKey);

    await expect(openOwnerUserKey(contact.privateKey, contact.publicKey, 13, forContact)).rejects.toThrow();
    await expect(openOwnerUserKey(stranger.privateKey, stranger.publicKey, 12, forContact)).rejects.toThrow();
  });
});
