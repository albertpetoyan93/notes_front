import type { Note } from "../store/noteStore";
import { cardBrandFromFields, cardFieldKind, formatCardField } from "./cardField";
import { isURL } from "./isUrl";
import { categoryKey, categoryLabel } from "./noteCategory";
import { isSecretField } from "./secretField";

export interface NoteField {
  label: string;
  value: string;
}

export const noteFields = (note: Pick<Note, "content">): NoteField[] => {
  const content = note.content as { customFields?: NoteField[] } | null;
  if (content && typeof content === "object" && Array.isArray(content.customFields)) {
    return content.customFields.map((field) => ({
      label: String(field.label ?? ""),
      value: String(field.value ?? ""),
    }));
  }
  return [];
};

export const noteBody = (note: Pick<Note, "content">) => {
  const content = note.content as { mainContent?: string } | string | null;
  if (typeof content === "string") return content;
  return String(content?.mainContent || "");
};

/** A passkey for another website, as the vault sees it: the private key stays on the server. */
export interface NotePasskey {
  credentialId: string;
  rpId: string;
  userName: string;
  userDisplayName?: string;
  createdAt: string;
}

export const notePasskeys = (note: Pick<Note, "content">): NotePasskey[] => {
  const content = note.content as { passkeys?: NotePasskey[] } | null;
  return content && typeof content === "object" && Array.isArray(content.passkeys)
    ? content.passkeys.filter((passkey) => passkey?.credentialId)
    : [];
};

export const decryptionFailed = (note: Pick<Note, "content">) =>
  !!(note.content as { decryptionFailed?: boolean } | null)?.decryptionFailed;

const find = (fields: NoteField[], pattern: RegExp) =>
  fields.find((field) => pattern.test(field.label) && field.value.trim())?.value.trim() || "";

export const isUrlField = (field: NoteField) =>
  /^(url|uri|website|link)$/i.test(field.label.trim()) && isURL(field.value);

// A field as it should be shown: card numbers grouped, everything else as typed.
export const displayValue = (field: NoteField, fields: NoteField[]) =>
  formatCardField(field.label, field.value, "", cardBrandFromFields(fields));

export const maskValue = (field: NoteField, shown: string) => {
  if (cardFieldKind(field.label) === "number") {
    const digits = shown.replace(/\D/g, "");
    return digits.length > 4 ? `•••• ${digits.slice(-4)}` : "••••";
  }
  return "•".repeat(Math.min(Math.max(shown.length, 8), 12));
};

export { isSecretField };

// The second line of a list row: the detail people scan for.
export const noteSubtitle = (note: Note) => {
  const fields = noteFields(note);
  switch (categoryKey(note.category)) {
    case "password":
      return find(fields, /^(username|email|login|user)$/i) || find(fields, /url|website/i);
    case "card": {
      const number = find(fields, /^number$/i).replace(/\D/g, "");
      const brand = find(fields, /^brand$/i);
      const expires = find(fields, /^expires$/i);
      return [brand, number ? `•••• ${number.slice(-4)}` : "", expires]
        .filter(Boolean)
        .join(" · ");
    }
    case "address":
      return [find(fields, /^address$/i), find(fields, /^city$/i)].filter(Boolean).join(", ");
    case "ssh": {
      const user = find(fields, /^username$/i);
      const host = find(fields, /^host$/i);
      return user && host ? `${user}@${host}` : host;
    }
    case "db":
      return [find(fields, /db_name|database/i), find(fields, /db_host|^host$/i)]
        .filter(Boolean)
        .join(" · ");
    case "command":
      return find(fields, /^command$/i);
    default: {
      const firstLine = noteBody(note).split("\n").find((line) => line.trim()) || "";
      if (firstLine) return firstLine.trim();
      const first = fields.find((field) => field.value.trim() && !isSecretField(field.label));
      return first?.value.trim() || "";
    }
  }
};

export type HealthKind = "weak" | "reused" | "stale";

export const HEALTH_LABEL: Record<HealthKind, string> = {
  weak: "Weak",
  reused: "Reused",
  stale: "Old",
};

export const HEALTH_TITLE: Record<HealthKind, string> = {
  weak: "Weak password",
  reused: "Reused password",
  stale: "Password not changed in over 6 months",
};

export const HEALTH_HELP: Record<HealthKind, string> = {
  weak: "It is short or uses too few kinds of characters.",
  reused: "Another login in your vault uses the same password.",
  stale: "Changing passwords now and then limits the damage of an old leak.",
};

export const healthIssues = (note: Pick<Note, "passwordHealth">): HealthKind[] => {
  const health = note.passwordHealth;
  if (!health) return [];
  return (["weak", "reused", "stale"] as HealthKind[]).filter((kind) => health[kind]);
};

export const searchText = (note: Note) =>
  [
    note.title,
    categoryLabel(note.category),
    ...(note.tags || []),
    ...(note.collections || []).map((collection) => collection.name),
    ...noteFields(note)
      .filter((field) => !isSecretField(field.label))
      .map((field) => field.value),
  ]
    .join(" ")
    .toLowerCase();
