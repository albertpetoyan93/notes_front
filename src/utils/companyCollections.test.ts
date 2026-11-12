import { describe, expect, it } from "vitest";
import { companyCollectionActions, defaultNewItemCollection } from "./companyCollections";

describe("defaultNewItemCollection", () => {
  const one = { id: 1, permission: "edit" as const };
  const viewOnly = { id: 2, permission: "view" as const };
  const owned = { id: 3, permission: "owner" as const };

  it("uses the open collection when the viewer can edit it", () => {
    expect(defaultNewItemCollection({ active: owned, collections: [one, owned], inCompany: true })).toBe(3);
    expect(defaultNewItemCollection({ active: one, collections: [one], inCompany: false })).toBe(1);
  });

  it("in a company with exactly one editable collection, picks it", () => {
    expect(defaultNewItemCollection({ active: null, collections: [one, viewOnly], inCompany: true })).toBe(1);
  });

  it("leaves the choice open with several editable collections, none, or in the personal vault", () => {
    expect(defaultNewItemCollection({ active: null, collections: [one, owned], inCompany: true })).toBeUndefined();
    expect(defaultNewItemCollection({ active: null, collections: [viewOnly], inCompany: true })).toBeUndefined();
    expect(defaultNewItemCollection({ active: null, collections: [one], inCompany: false })).toBeUndefined();
    expect(defaultNewItemCollection({ active: viewOnly, collections: [viewOnly, one], inCompany: true })).toBe(1);
  });
});

describe("companyCollectionActions", () => {
  it("gives owners and admins with access add, rename and delete", () => {
    expect(companyCollectionActions("edit", { inCompany: true, canManage: true })).toEqual(["add", "rename", "delete"]);
    expect(companyCollectionActions("owner", { inCompany: true, canManage: true })).toEqual(["add", "rename", "delete"]);
  });

  it("gives an admin without access nothing (ADR-002: managing isn't opening)", () => {
    expect(companyCollectionActions(null, { inCompany: true, canManage: true })).toEqual([]);
  });

  it("gives an editor only add", () => {
    expect(companyCollectionActions("edit", { inCompany: true, canManage: false })).toEqual(["add"]);
  });

  it("gives a viewer nothing", () => {
    expect(companyCollectionActions("view", { inCompany: true, canManage: false })).toEqual([]);
  });

  it("gives nothing outside an active company (suspended, or not a member)", () => {
    expect(companyCollectionActions("owner", { inCompany: false, canManage: false })).toEqual([]);
  });
});

describe("openableVaults", () => {
  it("the sidebar lists only vaults with access (an admin sees the rest on the company page)", async () => {
    const { openableVaults } = await import("./companyCollections");
    expect(openableVaults([{ id: 1, permission: "edit" }, { id: 2, permission: null }, { id: 3, permission: "view" }]).map((row) => row.id)).toEqual([1, 3]);
  });
});

describe("managesAnyVault", () => {
  it("a member who manages a vault gets the Collections page for it", async () => {
    const { managesAnyVault } = await import("./companyCollections");
    expect(managesAnyVault([{ manages: false }, { manages: true }])).toBe(true);
    expect(managesAnyVault([{ manages: false }, {}])).toBe(false);
  });
});
