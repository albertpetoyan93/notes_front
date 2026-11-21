import type { MigratedAccount } from "./authenticatorMigration";
import type { NoteField } from "./noteFields";

const simplify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const fieldValues = (fields: NoteField[], pattern: RegExp) =>
  fields
    .filter((field) => pattern.test(field.label))
    .map((field) => String(field.value || "").trim())
    .filter(Boolean);

export const userValues = (fields: NoteField[]) =>
  fieldValues(fields, /^(username|email|login|user)$/i);

// How well a login fits an authenticator account: the issuer against the title
// and URL, the account name against the username or email. 2 or more is a match.
export const accountMatchScore = (
  item: { title?: string; fields: NoteField[] },
  account: Pick<MigratedAccount, "issuer" | "name">
) => {
  const issuer = simplify(account.issuer);
  const title = simplify(item.title || "");
  let score = 0;
  if (issuer.length >= 2) {
    if (title === issuer) score += 3;
    else if (issuer.length >= 3 && title && (title.includes(issuer) || issuer.includes(title))) score += 2;
    else if (
      fieldValues(item.fields, /^(url|uri|website|link|platform)$/i).some((url) =>
        simplify(url).includes(issuer)
      )
    )
      score += 2;
  }
  const name = account.name.toLowerCase();
  if (name && userValues(item.fields).some((value) => value.toLowerCase() === name)) score += 2;
  return score;
};
