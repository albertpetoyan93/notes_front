/** How the company 2FA rule is described everywhere (F15): a passkey counts. */
export const TWO_FACTOR_WAYS = "two-factor sign-in (an authenticator app or a passkey)";

/**
 * After creating a company. New companies require two-factor sign-in, unless the
 * creator doesn't use it yet (they'd be locked out): then they're told how to turn it on.
 */
export const newCompanyNotice = (policies: { require2fa?: boolean | null } | null | undefined) =>
  policies?.require2fa
    ? null
    : `Set up ${TWO_FACTOR_WAYS} in Security settings, then turn on "Require two-factor sign-in" in the company's Policies.`;
