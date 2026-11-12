import { beforeAll, describe, expect, it } from "vitest";

// The stores behind vaultItems read localStorage when imported; tests run in Node.
let openCollectionNames: typeof import("./vaultItems").openCollectionNames;

beforeAll(async () => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  };
  (globalThis as any).sessionStorage = (globalThis as any).localStorage;
  ({ openCollectionNames } = await import("./vaultItems"));
});

describe("openCollectionNames for a vault this browser can't open", () => {
  it("names it by its number, so several locked vaults can be told apart", async () => {
    const [first, second] = await openCollectionNames([
      { id: 40, name: "", encName: "e2e1.x", nameKey: "v1", e2eKey: null },
      { id: 41, name: "", encName: "e2e1.y", nameKey: "v1", e2eKey: null },
    ] as never[]);
    expect(first).toMatchObject({ name: "Encrypted vault #40", nameLocked: true });
    expect(second).toMatchObject({ name: "Encrypted vault #41", nameLocked: true });
  });

  it("leaves readable names as they are", async () => {
    const [vault] = await openCollectionNames([{ id: 7, name: "Servers" }] as never[]);
    expect(vault).toMatchObject({ name: "Servers" });
    expect((vault as { nameLocked?: boolean }).nameLocked).toBeUndefined();
  });
});
