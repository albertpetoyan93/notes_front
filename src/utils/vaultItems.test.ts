import { describe, expect, it, vi } from "vitest";

// The module pulls in the axios setup, which needs a browser.
vi.mock("../configs/axios", () => ({ fetcherGet: vi.fn(), fetcherPost: vi.fn() }));

import { newSymmetricKey } from "../crypto/e2e";
import { useKeyStore } from "../store/keyStore";
import { personalCopy } from "./ownership";
import { itemKeyOf, sealCreate } from "./vaultItems";

describe("sealCreate", () => {
  const unlock = () =>
    useKeyStore.setState({ keys: { userKey: newSymmetricKey(), privateKey: newSymmetricKey(), publicKey: "" } as never });

  it("keeps the creator key copy for a personal item", async () => {
    unlock();
    const body = await sealCreate({ title: "a" });
    expect((body.e2e as { itemKey?: string }).itemKey).toBeTruthy();
  });

  it("leaves the creator key copy out of a work item but keeps the key cached", async () => {
    unlock();
    const body = await sealCreate({ title: "b" }, { work: true });
    expect("itemKey" in (body.e2e as object)).toBe(false);
    expect(await itemKeyOf({ e2eId: (body.e2e as { e2eId: string }).e2eId })).toBeInstanceOf(Uint8Array);
  });

  it("a personal copy of a work payload is sealed with a creator key copy", async () => {
    unlock();
    const copy = personalCopy({ title: "c", work: true, companyId: 7, collectionId: 2, collectionIds: [2], content: { mainContent: "", customFields: [], passkeys: [{ credentialId: "x" }] } });
    expect(copy.collectionIds).toEqual([]);
    expect("companyId" in copy).toBe(false);
    expect(copy.content).not.toHaveProperty("passkeys");
    const body = await sealCreate(copy, { work: !!copy.work });
    expect((body.e2e as { itemKey?: string }).itemKey).toBeTruthy();
  });
});
