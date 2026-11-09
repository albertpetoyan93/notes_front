// Who owns an item (company-owned work items). Mirrors the server's rules in
// notes_back/src/services/workItems.ts so the editor can warn before saving.

type Target = { id: number; companyId: number | null };

export type OwnershipChange =
  | "none"
  | "to_company"
  | "blocked_leave_company"
  | "blocked_two_companies"
  | "blocked_mixed";

// The server's wording, shown as it is.
export const OWNERSHIP_MESSAGES = {
  blocked_leave_company: "A company item stays in the company. Copy it to your personal vault instead.",
  blocked_two_companies: "An item can belong to only one company.",
  blocked_mixed: "A company item can only be in that company's collections.",
} as const;

/** Is this server error one of the ownership refusals (so "Copy to my personal vault" helps)? */
export const ownershipMessage = (text: unknown) =>
  Object.values(OWNERSHIP_MESSAGES).find((message) => message === text) || null;

export const moveToCompanyText = (company: string) =>
  `Move to ${company}? It will belong to ${company}: its admins' rules for access, recovery and retention apply, and you won't be able to move it back (you can copy it).`;

/** What choosing these collections does to an item that now belongs to `currentCompanyId` (null = personal). */
export const ownershipChange = (currentCompanyId: number | null, next: Target[]): OwnershipChange => {
  const companies = [...new Set(next.filter((item) => item.companyId).map((item) => item.companyId))];
  const hasPersonal = next.some((item) => !item.companyId);
  // Two companies is checked first, like the server.
  if (companies.length > 1) return "blocked_two_companies";
  if (companies.length && hasPersonal) return "blocked_mixed";
  if (currentCompanyId) {
    if (!companies.length) return "blocked_leave_company";
    return companies[0] === currentCompanyId ? "none" : "blocked_two_companies";
  }
  return companies.length ? "to_company" : "none";
};

/**
 * The create body for a personal copy of an item: no company, no collections,
 * not a work item (it needs its own key copy), and no stored passkeys.
 */
export const personalCopy = (payload: Record<string, unknown>) => {
  const { work: _work, companyId: _company, collectionId: _collection, collection: _c, collections: _cs, ...rest } = payload;
  const { passkeys: _kept, ...content } = (payload.content || {}) as Record<string, unknown>;
  return { ...rest, content, collectionIds: [], work: false };
};
