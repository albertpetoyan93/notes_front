import { describe, expect, it } from "vitest";
import { createAccountKeys, openBundleWithUserKey } from "./account";
import { DEFAULT_KDF, generateKeyPair } from "./e2e";
import {
  newEmergencyKey,
  openEmergencyKey,
  openEmergencyKeyAsContact,
  openItemFromEmergency,
  openNameFromEmergency,
  openOwnerUserKey,
  sealEmergencyKeyFor,
  sealNameForEmergency,
  sealUserKeyForContact,
  wrapEmergencyKey,
  wrapItemForEmergency,
} from "./emergency";
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

describe("emergency key (opens personal items only)", () => {
  it("the owner's browser makes copies; the contact opens items and names with the emergency key alone", async () => {
    const owner = await createAccountKeys("the owner's master password", FAST);
    const contact = await generateKeyPair();
    const { sealed, key: itemKey } = await sealNewItem(owner.unlocked.userKey, {
      title: "Bank",
      content: { mainContent: "", customFields: [] },
      tags: [],
      category: "login",
    });

    // The owner's browser.
    const ek = newEmergencyKey();
    const stored = await wrapEmergencyKey(owner.unlocked.userKey, 1, 3, ek);
    const again = await openEmergencyKey(owner.unlocked.userKey, 1, 3, stored);
    expect(Buffer.from(again).equals(Buffer.from(ek))).toBe(true);
    const itemCopy = await wrapItemForEmergency(ek, sealed.e2eId, 3, itemKey);
    const nameCopy = await sealNameForEmergency(ek, 20, 3, "Family");
    const forContact = await sealEmergencyKeyFor(contact.publicKey, 12, 3, ek);

    // The contact's browser, once access is granted.
    const opened = await openEmergencyKeyAsContact(contact.privateKey, contact.publicKey, 12, 3, forContact);
    const key = await openItemFromEmergency(opened, sealed.e2eId, 3, itemCopy);
    expect((await openItemData(key, sealed.e2eId, sealed.encData)).title).toBe("Bank");
    expect(await openNameFromEmergency(opened, 20, 3, nameCopy)).toBe("Family");
  });

  it("each copy opens only where it belongs", async () => {
    const owner = await createAccountKeys("the owner's master password", FAST);
    const contact = await generateKeyPair();
    const ek = newEmergencyKey();
    const itemKey = newEmergencyKey();
    const itemCopy = await wrapItemForEmergency(ek, "item-a", 3, itemKey);
    await expect(openItemFromEmergency(ek, "item-b", 3, itemCopy)).rejects.toThrow();
    await expect(openItemFromEmergency(ek, "item-a", 4, itemCopy)).rejects.toThrow();

    const forContact = await sealEmergencyKeyFor(contact.publicKey, 12, 3, ek);
    await expect(openEmergencyKeyAsContact(contact.privateKey, contact.publicKey, 13, 3, forContact)).rejects.toThrow();
    await expect(openEmergencyKeyAsContact(contact.privateKey, contact.publicKey, 12, 4, forContact)).rejects.toThrow();
    // Not mistaken for an old user-key copy either.
    await expect(openOwnerUserKey(contact.privateKey, contact.publicKey, 12, forContact)).rejects.toThrow();

    const stored = await wrapEmergencyKey(owner.unlocked.userKey, 1, 3, ek);
    await expect(openEmergencyKey(owner.unlocked.userKey, 2, 3, stored)).rejects.toThrow();
  });
});
