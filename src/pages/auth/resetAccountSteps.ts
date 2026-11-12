/** What POST /api/auth/e2e/reset-account/check answers for a valid reset link. */
export interface ResetAccountCheck {
  email: string;
  twoFactor: boolean;
  personalItems: number;
  sharedWithOthers: number;
  orphanedVaults: { companyName: string; vaultId: number }[];
  /** Companies whose vault recovery key only this person holds. */
  recoveryKeyLost?: string[];
  /** They run the family collection: nobody else can give its key back. */
  familyCollectionLocked?: boolean;
  /** Their shared, end-to-end collections: their people keep them, they can't open them. */
  lockedSharedCollections?: number;
}

/** The warnings shown before an account reset, and whether a 2FA code is needed. */
export const resetAccountSteps = (check: ResetAccountCheck) => {
  const warnings = [
    check.personalItems > 0
      ? `Your ${check.personalItems} personal items will be deleted. They can't be recovered.`
      : "Your personal items will be deleted. They can't be recovered.",
  ];
  if (check.sharedWithOthers > 0) {
    warnings.push(`${check.sharedWithOthers} of them are shared with other people, who will lose them too.`);
  }
  if (check.orphanedVaults.length) {
    const list = check.orphanedVaults.map((vault) => `${vault.companyName} vault #${vault.vaultId}`).join(", ");
    warnings.push(`You're the only one who can open ${list}. Ask the company to use vault recovery, or those items are lost.`);
  }
  for (const company of check.recoveryKeyLost || []) {
    warnings.push(`You're the only one holding ${company}'s vault recovery key. The company will need to set up vault recovery again.`);
  }
  if (check.lockedSharedCollections) {
    const n = check.lockedSharedCollections;
    warnings.push(
      `${n} ${n === 1 ? "collection" : "collections"} you share stay with the people you share them with, but you won't be able to open them.`
    );
  }
  if (check.familyCollectionLocked) {
    warnings.push("You run your family's shared collection. You won't be able to open it again; its items stay for your family.");
  }
  return {
    warnings,
    needsTwoFactor: check.twoFactor,
    twoFactorNote: check.twoFactor ? "You get one try: a wrong code cancels this link and you'll need a new one." : null,
  };
};
