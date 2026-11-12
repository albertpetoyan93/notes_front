/** A vault recovery request as the API lists it (GET /api/companies/:id/recovery/requests). */
export interface RecoveryRequestRow {
  id: number;
  /** Null once the vault or the person was deleted (the request stays as history). */
  collectionId: number | null;
  granteeUserId: number | null;
  granteeEmail: string;
  permission: "view" | "edit";
  reason: string;
  status: "pending" | "approved" | "completed" | "cancelled";
  ready: boolean;
  requestedBy: number | null;
  approvedBy: number | null;
  availableAt: string;
  createdAt: string;
  completedAt: string | null;
}

export type RequestAction = "approve" | "cancel" | "complete";

/** A vault as requests show it: always with its number (as in the notices), so the right one is recovered. */
export const requestVaultLabel = (collectionId: number | null, vaults: { id: number; name: string }[]) => {
  if (!collectionId) return "(deleted vault)";
  const name = vaults.find((vault) => vault.id === collectionId)?.name;
  return !name || name.endsWith(`#${collectionId}`) ? `Encrypted vault #${collectionId}` : `${name} (#${collectionId})`;
};

/** The request form offers only what the server will accept: recoverable vaults, people with keys. */
export const requestFormOptions = <V extends { id: number }, P extends { e2eEnabled?: boolean }>(
  vaults: V[],
  recoverableVaultIds: number[],
  people: P[]
) => ({
  vaults: vaults.filter((vault) => recoverableVaultIds.includes(vault.id)),
  people: people.filter((person) => person.e2eEnabled),
});

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/**
 * What a request shows and which buttons this viewer gets. Approval needs a
 * custodian who didn't ask; completing needs a custodian, after the waiting
 * period. The person who asked, any custodian (and the server lets the owner)
 * can cancel an open request.
 */
export const requestState = (
  row: RecoveryRequestRow,
  me: { userId: number; isCustodian: boolean; readOnly?: boolean },
  now: Date = new Date()
): { label: string; actions: RequestAction[] } => {
  if (row.status === "completed") return { label: "Completed", actions: [] };
  if (row.status === "cancelled") return { label: "Cancelled", actions: [] };
  // Recovery turned off: the list is history only.
  if (me.readOnly) return { label: row.status === "pending" ? "Waiting for a second custodian" : "Approved", actions: [] };
  const canCancel = me.isCustodian || row.requestedBy === me.userId;
  const cancel: RequestAction[] = canCancel ? ["cancel"] : [];
  if (row.status === "pending") {
    const approve: RequestAction[] = me.isCustodian && row.requestedBy !== me.userId ? ["approve"] : [];
    return { label: "Waiting for a second custodian", actions: [...approve, ...cancel] };
  }
  const ready = row.ready || new Date(row.availableAt).getTime() <= now.getTime();
  if (!ready) return { label: `Approved · ready ${when(row.availableAt)}`, actions: cancel };
  return { label: "Ready to complete", actions: [...(me.isCustodian ? (["complete"] as RequestAction[]) : []), ...cancel] };
};
