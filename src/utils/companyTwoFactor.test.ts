import { describe, expect, it } from "vitest";
import { newCompanyNotice } from "./companyTwoFactor";

describe("F15: after creating a company", () => {
  it("says nothing more when two-factor sign-in is already required", () => {
    expect(newCompanyNotice({ require2fa: true })).toBeNull();
  });

  it("asks the creator to set up two-factor sign-in, then turn the rule on", () => {
    expect(newCompanyNotice({ require2fa: false })).toMatch(/authenticator app or a passkey/);
    expect(newCompanyNotice({})).toMatch(/Policies/);
  });
});
