/** A company vault row as the Collections tab gets it (ADR-002: permission null = no access). */
export interface VaultRow {
  id: number;
  name?: string;
  nameLocked?: boolean;
  permission?: "owner" | "edit" | "view" | null;
  manages?: boolean;
  noManager?: boolean;
}

/**
 * What a vault row shows: its name, or "Vault #id" when the name can't be
 * opened (an admin without access); the access tag; whether you manage it;
 * and whether nobody does.
 */
export const vaultAccessLabel = (row: VaultRow) => ({
  title: !row.nameLocked && row.name ? row.name : `Vault #${row.id}`,
  tag: (!row.permission ? "no-access" : row.permission === "view" ? "view" : "edit") as "no-access" | "view" | "edit",
  manager: !!row.manages,
  noManager: !!row.noManager,
});
