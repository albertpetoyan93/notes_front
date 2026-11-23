// Breach alerts (docs/features/breach-alerts.md): the server publishes the public list of
// breached websites; this file matches it against the vault's own logins, in the browser.
// Nothing about the match is sent back to the server.

import type { Note } from "../store/noteStore";
import { categoryKey } from "./noteCategory";
import { noteFields, notePasskeys } from "./noteFields";
import { rootHost } from "./rootHost";

export interface Breach {
  name: string;
  title: string;
  domain: string;
  breachDate: string | null;
  addedDate: string;
  pwnCount: number;
  dataClasses: string[];
  isVerified: boolean;
}

export interface BreachAlert {
  breach: Breach;
  /** Logins on the breached site whose password is older than the breach report. */
  items: Note[];
}

const URL_LABEL = /url|website|web site|site|link|address|domain/i;
const LOOKS_LIKE_HOST = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#].*)?$/i;

/** The registrable domains a login is for: its URL fields and its passkeys' sites. */
export const loginDomains = (note: Pick<Note, "content">): string[] => {
  const hosts = new Set<string>();
  for (const field of noteFields(note)) {
    const value = field.value.trim();
    if (!value || value.includes(" ")) continue;
    const isUrlField = URL_LABEL.test(field.label) || /^https?:\/\//i.test(value);
    if (!isUrlField || !LOOKS_LIKE_HOST.test(value)) continue;
    const host = rootHost(value);
    if (host.includes(".")) hosts.add(host);
  }
  for (const passkey of notePasskeys(note)) {
    const host = rootHost(passkey.rpId);
    if (host.includes(".")) hosts.add(host);
  }
  return [...hosts];
};

const isLogin = (note: Note) => ["password", "login"].includes(categoryKey(note.category));

/**
 * Alerts for the given logins: a breach matches a login on the same site whose item was last
 * changed before the breach was reported (the closest thing we have to "password changed").
 * Dismissed breach names are left out. Newest breach first.
 */
export const matchBreaches = (breaches: Breach[], notes: Note[], dismissed: Set<string>): BreachAlert[] => {
  const byDomain = new Map<string, Note[]>();
  for (const note of notes) {
    if (!isLogin(note)) continue;
    for (const domain of loginDomains(note)) {
      byDomain.set(domain, [...(byDomain.get(domain) || []), note]);
    }
  }
  const alerts: BreachAlert[] = [];
  for (const breach of breaches) {
    if (dismissed.has(breach.name)) continue;
    const added = new Date(breach.addedDate).getTime();
    const items = (byDomain.get(breach.domain) || []).filter((note) => {
      const changed = new Date((note as { updatedAt?: string }).updatedAt || 0).getTime();
      return !(changed > added);
    });
    if (items.length) alerts.push({ breach, items });
  }
  return alerts.sort((a, b) => b.breach.addedDate.localeCompare(a.breach.addedDate));
};

/** "Passwords, email addresses and 2 more" for the alert text. */
export const leakedSummary = (classes: string[]): string => {
  const wanted = ["Passwords", "Email addresses", "Usernames", "Phone numbers", "Names"];
  const picked = wanted.filter((item) => classes.includes(item));
  const rest = classes.length - picked.length;
  const words = picked.map((item, index) => (index === 0 ? item : item.toLowerCase()));
  if (!words.length) return classes.length === 1 ? "1 kind of data" : `${classes.length} kinds of data`;
  if (rest > 0) return `${words.join(", ")} and ${rest} more`;
  return words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}` : words[0];
};
