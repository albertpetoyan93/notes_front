import { describe, expect, it } from "vitest";
import { ownershipChange } from "./ownership";

describe("ownershipChange", () => {
  it("is none for a personal item that stays personal", () => {
    expect(ownershipChange(null, [])).toBe("none");
    expect(ownershipChange(null, [{ id: 1, companyId: null }])).toBe("none");
  });

  it("is none for a work item that stays in its company", () => {
    expect(ownershipChange(7, [{ id: 2, companyId: 7 }, { id: 3, companyId: 7 }])).toBe("none");
  });

  it("is to_company when a personal item goes into a company collection", () => {
    expect(ownershipChange(null, [{ id: 2, companyId: 7 }])).toBe("to_company");
  });

  it("blocks a work item leaving its company", () => {
    expect(ownershipChange(7, [])).toBe("blocked_leave_company");
    expect(ownershipChange(7, [{ id: 1, companyId: null }])).toBe("blocked_leave_company");
  });

  it("blocks two companies", () => {
    expect(ownershipChange(null, [{ id: 2, companyId: 7 }, { id: 3, companyId: 9 }])).toBe("blocked_two_companies");
    expect(ownershipChange(7, [{ id: 4, companyId: 9 }])).toBe("blocked_two_companies");
  });

  it("blocks mixing personal and company collections", () => {
    expect(ownershipChange(null, [{ id: 1, companyId: null }, { id: 2, companyId: 7 }])).toBe("blocked_mixed");
  });
});
