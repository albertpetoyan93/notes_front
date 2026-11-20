import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../configs/axios", () => ({ default: {}, fetcherGet: http.get, fetcherPost: http.post }));

import { generateKeyPair, newSymmetricKey } from "../crypto/e2e";
import {
  openEmergencyKey,
  openEmergencyKeyAsContact,
  openItemFromEmergency,
  openNameFromEmergency,
  openPinnedContactKey,
  pinContactKey,
  wrapEmergencyKey,
} from "../crypto/emergency";
import { sealCollectionName, sealNewItem } from "../crypto/items";
import { useAuthStore } from "../store/authStore";
import { useKeyStore } from "../store/keyStore";
import { runEmergencyTasks } from "./emergencyKey";

const userKey = newSymmetricKey();
let contact: Awaited<ReturnType<typeof generateKeyPair>>;
let item: Awaited<ReturnType<typeof sealNewItem>>;

const ready = (overrides: Record<string, unknown> = {}) => ({
  keyVersion: 1,
  emergencyKey: "",
  rotate: false,
  items: [],
  collections: [],
  contacts: [],
  ...overrides,
});

beforeEach(async () => {
  vi.clearAllMocks();
  contact = await generateKeyPair();
  item = await sealNewItem(userKey, { title: "Bank", content: "", tags: [], category: "login" } as never);
  useAuthStore.setState({ me: { id: 1, e2eEnabled: true } } as never);
  useKeyStore.setState({ keys: { userKey, privateKey: new Uint8Array(32), publicKey: "me" } } as never);
});

describe("emergency key: the owner's background work", () => {
  it("no key yet: makes one, then copies what the user key opens and seals the contact (pinning their key)", async () => {
    let stored = "";
    http.get.mockImplementation(async () =>
      !stored
        ? ready({ keyVersion: null, emergencyKey: null, rotate: true })
        : ready({
            emergencyKey: stored,
            items: [{ noteId: 10, e2eId: item.sealed.e2eId, itemKey: item.sealed.itemKey }],
            collections: [
              { id: 20, name: "", encName: await sealCollectionName(userKey, 20, "user", "Family"), nameKey: "user" },
              { id: 21, name: "Trips", encName: null, nameKey: null },
            ],
            contacts: [{ id: 5, publicKey: contact.publicKey, pinnedKey: null }],
          })
    );
    http.post.mockImplementation(async (_url: string, body: any) => {
      if (body.emergencyKey) stored = body.emergencyKey;
      return { keyVersion: body.keyVersion };
    });

    await runEmergencyTasks();

    const [first, second] = http.post.mock.calls.map((call) => call[1]);
    const ek = await openEmergencyKey(userKey, 1, 1, first.emergencyKey);
    const copy = await openItemFromEmergency(ek, item.sealed.e2eId, 1, second.items[0].wrappedKey);
    expect(Buffer.from(copy).equals(Buffer.from(item.key))).toBe(true);
    expect(await openNameFromEmergency(ek, 20, 1, second.collections[0].encName)).toBe("Family");
    expect(await openNameFromEmergency(ek, 21, 1, second.collections[1].encName)).toBe("Trips");
    const sealed = await openEmergencyKeyAsContact(contact.privateKey, contact.publicKey, 5, 1, second.contacts[0].sealedKey);
    expect(Buffer.from(sealed).equals(Buffer.from(ek))).toBe(true);
    expect(await openPinnedContactKey(userKey, 1, 5, second.contacts[0].pinnedKey)).toBe(contact.publicKey);
  });

  it("never copies a key it can't open with the user key, nor a name kept under a vault key", async () => {
    const stored = await wrapEmergencyKey(userKey, 1, 1, newSymmetricKey());
    const companyItem = await sealNewItem(newSymmetricKey(), { title: "Acme DB", content: "", tags: [], category: "login" } as never);
    http.get.mockResolvedValue(
      ready({
        emergencyKey: stored,
        items: [
          { noteId: 12, e2eId: companyItem.sealed.e2eId, itemKey: companyItem.sealed.itemKey },
          { noteId: 13, e2eId: "no-wrap", itemKey: null },
        ],
        collections: [{ id: 21, name: "", encName: "e2e1.x.y", nameKey: "v2" }],
      })
    );
    await runEmergencyTasks();
    expect(http.post).not.toHaveBeenCalled();
  });

  it("a contact whose key changed since the owner checked it is not sealed", async () => {
    const stored = await wrapEmergencyKey(userKey, 1, 1, newSymmetricKey());
    const someoneElse = await generateKeyPair();
    http.get.mockResolvedValue(
      ready({
        emergencyKey: stored,
        contacts: [{ id: 5, publicKey: someoneElse.publicKey, pinnedKey: await pinContactKey(userKey, 1, 5, contact.publicKey) }],
      })
    );
    await runEmergencyTasks();
    expect(http.post).not.toHaveBeenCalled();
  });

  it("a replaced key: version + 1", async () => {
    const old = await wrapEmergencyKey(userKey, 1, 3, newSymmetricKey());
    let rotated = false;
    http.get.mockImplementation(async () =>
      rotated ? ready({ keyVersion: 4, emergencyKey: "x" }) : ready({ keyVersion: 3, emergencyKey: old, rotate: true })
    );
    http.post.mockImplementation(async (_url: string, body: any) => {
      rotated = true;
      return body;
    });
    await runEmergencyTasks();
    expect(http.post.mock.calls[0][1].keyVersion).toBe(4);
  });

  it("another tab got there first: looks again instead of failing", async () => {
    let calls = 0;
    http.get.mockImplementation(async () =>
      calls ? ready({ keyVersion: 1, emergencyKey: "x" }) : ready({ keyVersion: null, emergencyKey: null, rotate: true })
    );
    http.post.mockImplementation(async () => {
      calls += 1;
      throw { message: "Already done in another tab." };
    });
    await expect(runEmergencyTasks()).resolves.toBeUndefined();
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it("does nothing while the vault is locked", async () => {
    useKeyStore.setState({ keys: null } as never);
    await runEmergencyTasks();
    expect(http.get).not.toHaveBeenCalled();
  });
});
