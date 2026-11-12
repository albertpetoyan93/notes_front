import { describe, expect, it } from "vitest";
import { requestFormOptions, requestState, requestVaultLabel, type RecoveryRequestRow } from "./recoveryRequestState";

describe("requestVaultLabel", () => {
  it("names a vault with its number, an unreadable one as encrypted, a deleted one as deleted", () => {
    const vaults = [
      { id: 40, name: "Servers" },
      { id: 41, name: "Encrypted vault #41" },
    ];
    expect(requestVaultLabel(40, vaults)).toBe("Servers (#40)");
    expect(requestVaultLabel(41, vaults)).toBe("Encrypted vault #41");
    expect(requestVaultLabel(42, vaults)).toBe("Encrypted vault #42");
    expect(requestVaultLabel(null, vaults)).toBe("(deleted vault)");
  });
});

describe("requestState when recovery is off (history only)", () => {
  it("offers no actions", () => {
    const pending = {
      id: 1, collectionId: 40, granteeUserId: 3, granteeEmail: "max@acme.com", permission: "view" as const, reason: "x",
      status: "pending" as const, ready: false, requestedBy: 1, approvedBy: null, availableAt: "2026-11-11T12:00:00Z",
      createdAt: "2026-11-10T11:00:00Z", completedAt: null,
    };
    expect(requestState(pending, { userId: 2, isCustodian: true, readOnly: true }).actions).toEqual([]);
  });
});

describe("requestFormOptions", () => {
  it("offers only vaults that can be recovered now and people with end-to-end encryption on", () => {
    const options = requestFormOptions(
      [
        { id: 40, name: "Servers" },
        { id: 41, name: "Encrypted vault #41" },
      ],
      [40],
      [
        { userId: 3, email: "max@acme.com", e2eEnabled: true },
        { userId: 5, email: "bo@acme.com", e2eEnabled: false },
      ]
    );
    expect(options.vaults).toEqual([{ id: 40, name: "Servers" }]);
    expect(options.people).toEqual([{ userId: 3, email: "max@acme.com", e2eEnabled: true }]);
  });
});

const now = new Date("2026-11-10T12:00:00Z");
const row = (part: Partial<RecoveryRequestRow>): RecoveryRequestRow => ({
  id: 1,
  collectionId: 40,
  granteeUserId: 3,
  granteeEmail: "max@acme.com",
  permission: "edit",
  reason: "Ari left",
  status: "pending",
  ready: false,
  requestedBy: 1,
  approvedBy: null,
  availableAt: "2026-11-11T12:00:00Z",
  createdAt: "2026-11-10T11:00:00Z",
  completedAt: null,
  ...part,
});

describe("requestState", () => {
  it("pending, seen by a custodian who didn't ask: approve or cancel", () => {
    expect(requestState(row({}), { userId: 2, isCustodian: true }, now)).toEqual({
      label: "Waiting for a second custodian",
      actions: ["approve", "cancel"],
    });
  });

  it("pending, seen by the person who asked: only cancel", () => {
    expect(requestState(row({}), { userId: 1, isCustodian: true }, now).actions).toEqual(["cancel"]);
  });

  it("approved but still in the waiting period: no complete yet", () => {
    const state = requestState(row({ status: "approved", approvedBy: 2 }), { userId: 2, isCustodian: true }, now);
    expect(state.label).toMatch(/^Approved · ready /);
    expect(state.actions).toEqual(["cancel"]);
  });

  it("approved and ready, seen by a custodian: complete or cancel", () => {
    const ready = row({ status: "approved", approvedBy: 2, ready: true, availableAt: "2026-11-10T10:00:00Z" });
    expect(requestState(ready, { userId: 2, isCustodian: true }, now)).toEqual({
      label: "Ready to complete",
      actions: ["complete", "cancel"],
    });
  });

  it("an admin who isn't a custodian can only cancel their own request", () => {
    const ready = row({ status: "approved", ready: true, requestedBy: 4 });
    expect(requestState(ready, { userId: 4, isCustodian: false }, now).actions).toEqual(["cancel"]);
    expect(requestState(ready, { userId: 5, isCustodian: false }, now).actions).toEqual([]);
  });

  it("closed requests have no actions", () => {
    expect(requestState(row({ status: "completed" }), { userId: 2, isCustodian: true }, now)).toEqual({ label: "Completed", actions: [] });
    expect(requestState(row({ status: "cancelled" }), { userId: 2, isCustodian: true }, now)).toEqual({ label: "Cancelled", actions: [] });
  });
});
