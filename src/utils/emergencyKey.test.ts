import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("../configs/axios", () => ({ default: {}, fetcherGet: http.get, fetcherPost: http.post }));
const vault = vi.hoisted(() => ({ keyForId: vi.fn(), openCollectionNames: vi.fn() }));
vi.mock("./vaultItems", () => vault);

import { generateKeyPair, newSymmetricKey } from "../crypto/e2e";
import {
  openEmergencyKey,
  openEmergencyKeyAsContact,
  openItemFromEmergency,
  openNameFromEmergency,
  wrapEmergencyKey,
} from "../crypto/emergency";
import { useAuthStore } from "../store/authStore";
import { useKeyStore } from "../store/keyStore";
import { runEmergencyTasks } from "./emergencyKey";

const userKey = newSymmetricKey();
const itemKey = newSymmetricKey();
let contact: Awaited<ReturnType<typeof generateKeyPair>>;

beforeEach(async () => {
  vi.clearAllMocks();
  contact = await generateKeyPair();
  useAuthStore.setState({ me: { id: 1, e2eEnabled: true } } as never);
  useKeyStore.setState({ keys: { userKey, privateKey: new Uint8Array(32), publicKey: "me" } } as never);
  vault.keyForId.mockResolvedValue(itemKey);
  vault.openCollectionNames.mockImplementation(async (list: any[]) => list.map((row) => ({ ...row, name: "Family" })));
});

describe("emergency key: the owner's background work", () => {
  it("no key yet: makes one (version 1, wrapped with the user key), then copies items, names and seals the contact", async () => {
    let stored = "";
    http.get.mockImplementation(async (url: string) => {
      if (url === "/api/collections") return [{ id: 20, name: "", encName: "x", nameKey: "user" }];
      if (!stored) return { keyVersion: null, emergencyKey: null, rotate: true, items: [], collections: [], contacts: [] };
      return {
        keyVersion: 1,
        emergencyKey: stored,
        rotate: false,
        items: [{ noteId: 10, e2eId: "e10" }],
        collections: [{ id: 20 }],
        contacts: [{ id: 5, publicKey: contact.publicKey }],
      };
    });
    http.post.mockImplementation(async (_url: string, body: any) => {
      if (body.emergencyKey) stored = body.emergencyKey;
      return { keyVersion: body.keyVersion };
    });

    await runEmergencyTasks();

    const [first, second] = http.post.mock.calls.map((call) => call[1]);
    expect(first.keyVersion).toBe(1);
    const ek = await openEmergencyKey(userKey, 1, 1, first.emergencyKey);
    expect(second.keyVersion).toBe(1);
    const copy = await openItemFromEmergency(ek, "e10", 1, second.items[0].wrappedKey);
    expect(Buffer.from(copy).equals(Buffer.from(itemKey))).toBe(true);
    expect(await openNameFromEmergency(ek, 20, 1, second.collections[0].encName)).toBe("Family");
    const sealed = await openEmergencyKeyAsContact(contact.privateKey, contact.publicKey, 5, 1, second.contacts[0].sealedKey);
    expect(Buffer.from(sealed).equals(Buffer.from(ek))).toBe(true);
  });

  it("a replaced key: version + 1", async () => {
    const old = await wrapEmergencyKey(userKey, 1, 3, newSymmetricKey());
    let rotated = false;
    http.get.mockImplementation(async () =>
      rotated
        ? { keyVersion: 4, emergencyKey: "x", rotate: false, items: [], collections: [], contacts: [] }
        : { keyVersion: 3, emergencyKey: old, rotate: true, items: [], collections: [], contacts: [] }
    );
    http.post.mockImplementation(async (_url: string, body: any) => {
      rotated = true;
      return body;
    });
    await runEmergencyTasks();
    expect(http.post.mock.calls[0][1].keyVersion).toBe(4);
    await expect(openEmergencyKey(userKey, 1, 4, http.post.mock.calls[0][1].emergencyKey)).resolves.toHaveLength(32);
  });

  it("does nothing while the vault is locked", async () => {
    useKeyStore.setState({ keys: null } as never);
    await runEmergencyTasks();
    expect(http.get).not.toHaveBeenCalled();
  });
});
