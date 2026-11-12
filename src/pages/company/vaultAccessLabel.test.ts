import { describe, expect, it } from "vitest";
import { vaultAccessLabel } from "./vaultAccessLabel";

describe("vaultAccessLabel", () => {
  it("no access and an encrypted name: Vault #id, never an error", () => {
    expect(vaultAccessLabel({ id: 40, name: "", nameLocked: true, permission: null })).toEqual({
      title: "Vault #40",
      tag: "no-access",
      manager: false,
      noManager: false,
    });
  });

  it("an admin's kept access shows as a manager with edit", () => {
    expect(vaultAccessLabel({ id: 41, name: "Ops", permission: "edit", manages: true })).toEqual({
      title: "Ops",
      tag: "edit",
      manager: true,
      noManager: false,
    });
  });

  it("passes No manager through, and reads the old owner permission as edit", () => {
    expect(vaultAccessLabel({ id: 42, name: "Dev", permission: "owner", noManager: true })).toMatchObject({
      tag: "edit",
      noManager: true,
    });
  });
});
