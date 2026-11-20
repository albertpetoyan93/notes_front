import { describe, expect, it } from "vitest";
import { generateKeyPair } from "../crypto/e2e";
import {
  newEmergencyKey,
  sealEmergencyKeyFor,
  sealNameForEmergency,
  wrapItemForEmergency,
} from "../crypto/emergency";
import { sealNewItem } from "../crypto/items";
import { openEmergencyVault, waitingNotice } from "./emergencyVault";

describe("the contact opens an owner's vault with the emergency key", () => {
  it("opens titles and collection names; a tampered copy shows as unopenable", async () => {
    const contact = await generateKeyPair();
    const ek = newEmergencyKey();
    const bank = await sealNewItem(newEmergencyKey(), { title: "Bank", content: "", tags: [], category: "login" } as never);
    const mail = await sealNewItem(newEmergencyKey(), { title: "Mail", content: "", tags: [], category: "login" } as never);
    const data = {
      owner: { id: 1, name: "Olga", email: "olga@x.com" },
      grantedAt: null,
      scheme: "emergency-key" as const,
      keyVersion: 2,
      sealedKey: await sealEmergencyKeyFor(contact.publicKey, 5, 2, ek),
      collections: [
        { id: 20, name: null, encName: await sealNameForEmergency(ek, 20, 2, "Family") },
        { id: 21, name: null, encName: null },
      ],
      items: [
        {
          e2eId: bank.sealed.e2eId,
          emergencyKey: await wrapItemForEmergency(ek, bank.sealed.e2eId, 2, bank.key),
          encData: bank.sealed.encData,
          category: "login",
          collectionIds: [20],
        },
        {
          // Copy made for another item: must not open this one.
          e2eId: mail.sealed.e2eId,
          emergencyKey: await wrapItemForEmergency(ek, bank.sealed.e2eId, 2, mail.key),
          encData: mail.sealed.encData,
          category: "login",
          collectionIds: [],
        },
      ],
      waiting: 0,
    };

    const { names, items } = await openEmergencyVault(5, data, contact);
    expect(names.get(20)).toBe("Family");
    expect(names.get(21)).toBe("A collection");
    expect(items.map((item) => [item.title, item.failed])).toEqual([
      ["Bank", false],
      ["Item can't be opened", true],
    ]);
  });

  it("says when some items aren't ready yet", () => {
    expect(waitingNotice(0, "Olga")).toBeNull();
    expect(waitingNotice(1, "Olga")).toBe("1 item isn't ready yet: it's added the next time Olga opens 2keevo.");
    expect(waitingNotice(3, "Olga")).toBe("3 items aren't ready yet: they're added the next time Olga opens 2keevo.");
  });
});
