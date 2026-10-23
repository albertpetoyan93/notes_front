import { fetcherPost } from "../configs/axios";

export interface ActivityEvent {
  id: number;
  action: string;
  actorId: number | null;
  actorName: string | null;
  targetUserId: number | null;
  targetName: string | null;
  noteId: number | null;
  collectionId: number | null;
  details: Record<string, any>;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ActivityPage {
  events: ActivityEvent[];
  next: number | null;
}

const quote = (value: unknown) => (value ? `"${value}"` : "an item");

const permissionText = (details: Record<string, any>) => {
  const level = details.permission === "edit" ? "can edit" : "can view";
  if (!details.expiresAt) return level;
  const until = new Date(details.expiresAt).toLocaleDateString();
  return `${level}, until ${until}`;
};

/**
 * One line of the log, without the person ("created "Prod DB"").
 * `withTitle` is off in an item's own history, where the title is obvious.
 */
export const describeActivity = (event: ActivityEvent, withTitle = true) => {
  const d = event.details || {};
  const item = withTitle ? ` ${quote(d.title)}` : " this item";
  const target = event.targetName || d.email || "someone";
  const collection = quote(d.collectionName).replace("an item", "a collection");

  switch (event.action) {
    case "login":
      return `signed in${d.kind === "extension" ? " to the browser extension" : ""}${
        d.passkey ? " with a passkey" : d.twoFactor ? " with 2FA" : ""
      }`;
    case "login_failed":
      return `entered a wrong password${d.kind === "extension" ? " in the browser extension" : ""}`;
    case "two_factor_failed":
      return "entered a wrong 2FA code";
    case "two_factor_enabled":
      return "turned on two-factor authentication";
    case "two_factor_disabled":
      return "turned off two-factor authentication";
    case "recovery_codes_regenerated":
      return "created new recovery codes";
    case "passkey_added":
      return `added a passkey${d.name ? ` (${d.name})` : ""}`;
    case "passkey_removed":
      return `removed a passkey${d.name ? ` (${d.name})` : ""}`;
    case "session_revoked":
      return "signed out a device";
    case "other_sessions_revoked":
      return "signed out all other devices";
    case "password_reset":
      return "reset the password";
    case "secret_link_created":
      return `made a one-time link${d.label ? ` "${d.label}"` : ""}`;
    case "secret_link_revoked":
      return "cancelled a one-time link";
    case "secret_link_opened":
      return `had a one-time link${d.label ? ` "${d.label}"` : ""} opened by someone`;
    case "session_unlocked":
      return `unlocked 2keevo${d.method === "passkey" ? " with a passkey" : ""}`;
    case "unlock_failed":
      return "entered a wrong password to unlock 2keevo";
    case "auto_lock_changed":
      return Number(d.minutes)
        ? `set auto-lock to ${Number(d.minutes) === 60 ? "1 hour" : `${d.minutes} minutes`}`
        : "turned off auto-lock";
    case "item_created":
      return `created${item}`;
    case "item_updated":
      return `edited${item}`;
    case "item_version_viewed":
      return `opened an older version of${item}`;
    case "item_version_restored":
      return `restored an older version of${item}${
        d.versionDate ? ` (from ${new Date(String(d.versionDate)).toLocaleDateString()})` : ""
      }`;
    case "item_trashed":
      return `moved${item} to Trash`;
    case "item_restored":
      return `restored${item} from Trash`;
    case "item_moved":
      return d.collectionName
        ? `moved${item} to ${collection}`
        : `took${item} out of its collection`;
    case "trash_emptied":
      return `emptied Trash (${d.count} ${d.count === 1 ? "item" : "items"})`;
    case "field_revealed":
      return `revealed ${d.field || "a secret"}${withTitle ? ` in ${quote(d.title)}` : ""}`;
    case "field_copied":
      return `copied ${d.field || "a field"}${withTitle ? ` from ${quote(d.title)}` : ""}`;
    case "item_autofilled":
      return `got${withTitle ? item : " this login"} in the browser extension${d.host ? ` on ${d.host}` : ""}`;
    case "vault_exported":
      return `exported the vault${d.count !== undefined ? ` (${d.count} items)` : ""}`;
    case "vault_imported":
      return `imported ${d.count ?? "some"} items`;
    case "item_shared":
      return `shared${item} with ${target} (${permissionText(d)})`;
    case "item_share_revoked":
      return `stopped sharing${item} with ${target}`;
    case "item_share_left":
      return `removed${item} from their list`;
    case "collection_shared":
      if (d.audience === "all") return `shared ${collection} with everyone in the company`;
      return `shared ${collection} with ${event.targetName || (d.people ? `${d.people} people` : "someone")}${
        d.permission ? ` (${permissionText(d)})` : ""
      }`;
    case "collection_share_revoked":
      return d.audience === "all"
        ? `stopped sharing ${collection} with the company`
        : `stopped sharing ${collection} with ${target}`;
    case "collection_left":
      return `left the shared collection ${collection}`;
    case "member_invited":
      return `invited ${d.email || "someone"} as ${d.role === "admin" ? "an admin" : "a member"}`;
    case "member_removed":
      return `removed ${target} from the company`;
    case "company_policy_changed": {
      const names: Record<string, string> = {
        require2fa: d.require2fa ? "required two-factor authentication" : "stopped requiring two-factor authentication",
        minPasswordLength: d.minPasswordLength
          ? `set the minimum password length to ${d.minPasswordLength}`
          : "removed the minimum password length",
        maxIdleMinutes: d.maxIdleMinutes
          ? `set auto-lock to at most ${d.maxIdleMinutes} minutes`
          : "removed the auto-lock limit",
        maxSessionDays: d.maxSessionDays
          ? `set sign-ins to end after ${d.maxSessionDays} ${Number(d.maxSessionDays) === 1 ? "day" : "days"}`
          : "removed the sign-in age limit",
      };
      const changed = Array.isArray(d.changed) ? (d.changed as string[]) : [];
      return changed.map((key) => names[key] || key).join(", ") || "changed the security policies";
    }
    case "member_role_changed":
      return `made ${target} ${d.role === "admin" ? "an admin" : "a member"}`;
    default:
      return event.action.replace(/_/g, " ");
  }
};

/** Actions where something was exposed or went wrong: shown with a warning colour. */
export const isNotableActivity = (action: string) =>
  [
    "login_failed",
    "two_factor_failed",
    "two_factor_disabled",
    "unlock_failed",
    "secret_link_opened",
    "passkey_removed",
    "field_revealed",
    "field_copied",
    "vault_exported",
  ].includes(action);

/**
 * Tell the API that a secret was shown or copied, for the item's history.
 * Fire and forget: the vault keeps working if this fails.
 */
export const reportSecretUse = (
  noteId: number,
  action: "field_revealed" | "field_copied",
  field: string
) => {
  fetcherPost(`/api/notes/${noteId}/events`, { action, field }).catch(() => undefined);
};
