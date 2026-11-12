import { describe, expect, it } from "vitest";
import { resetAccountSteps } from "./resetAccountSteps";

const check = (part: Partial<Parameters<typeof resetAccountSteps>[0]>) => ({
  email: "sam@acme.com",
  twoFactor: false,
  personalItems: 0,
  sharedWithOthers: 0,
  orphanedVaults: [],
  recoveryKeyLost: [],
  familyCollectionLocked: false,
  ...part,
});

describe("resetAccountSteps", () => {
  it("always says personal items are deleted", () => {
    expect(resetAccountSteps(check({ personalItems: 12 })).warnings).toEqual([
      "Your 12 personal items will be deleted. They can't be recovered.",
    ]);
    expect(resetAccountSteps(check({})).warnings).toEqual([
      "Your personal items will be deleted. They can't be recovered.",
    ]);
  });

  it("warns that items shared with others go too", () => {
    expect(resetAccountSteps(check({ personalItems: 5, sharedWithOthers: 2 })).warnings).toContain(
      "2 of them are shared with other people, who will lose them too."
    );
  });

  it("names vaults only this person can open", () => {
    const steps = resetAccountSteps(
      check({ orphanedVaults: [{ companyName: "Acme", vaultId: 40 }, { companyName: "Acme", vaultId: 41 }] })
    );
    expect(steps.warnings).toContain(
      "You're the only one who can open Acme vault #40, Acme vault #41. Ask the company to use vault recovery, or those items are lost."
    );
  });

  it("says when the company's vault recovery must be set up again", () => {
    expect(resetAccountSteps(check({ recoveryKeyLost: ["Acme"] })).warnings).toContain(
      "You're the only one holding Acme's vault recovery key. The company will need to set up vault recovery again."
    );
  });

  it("says when nobody can give back the family collection", () => {
    expect(resetAccountSteps(check({ familyCollectionLocked: true })).warnings).toContain(
      "You run your family's shared collection. You won't be able to open it again; its items stay for your family."
    );
  });

  it("says shared collections stay for their people but won't open for you", () => {
    expect(resetAccountSteps(check({ lockedSharedCollections: 2 })).warnings).toContain(
      "2 collections you share stay with the people you share them with, but you won't be able to open them."
    );
  });

  it("a wrong 2FA code uses up the link", () => {
    expect(resetAccountSteps(check({ twoFactor: true })).twoFactorNote).toBe(
      "You get one try: a wrong code cancels this link and you'll need a new one."
    );
  });

  it("asks for a 2FA code when the account uses 2FA", () => {
    expect(resetAccountSteps(check({ twoFactor: true })).needsTwoFactor).toBe(true);
    expect(resetAccountSteps(check({})).needsTwoFactor).toBe(false);
  });
});
