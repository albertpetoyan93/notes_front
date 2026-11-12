type Permission = "owner" | "edit" | "view";

const canEdit = (permission: Permission) => permission === "owner" || permission === "edit";

/**
 * The collection a new item starts in: the open one if the viewer can edit it;
 * in a company (where every item needs one) the only editable collection when
 * there is exactly one. Otherwise the person chooses.
 */
export const defaultNewItemCollection = ({
  active,
  collections,
  inCompany,
}: {
  active: { id: number; permission: Permission } | null;
  collections: { id: number; permission: Permission }[];
  inCompany: boolean;
}): number | undefined => {
  if (active && canEdit(active.permission)) return active.id;
  if (!inCompany) return undefined;
  const editable = collections.filter((collection) => canEdit(collection.permission));
  return editable.length === 1 ? editable[0].id : undefined;
};

/**
 * A company vault's menu. ADR-002: owners and admins open a vault only
 * through a grant; with access they may also rename or delete it. Editors can
 * only bring their own items in; without access there's nothing to do here.
 */
export const companyCollectionActions = (
  permission: Permission | null | undefined,
  { inCompany, canManage }: { inCompany: boolean; canManage: boolean }
): ("add" | "rename" | "delete")[] => {
  if (!inCompany || !permission) return [];
  const editor = canEdit(permission);
  if (canManage && editor) return ["add", "rename", "delete"];
  return editor ? ["add"] : [];
};

/** Vaults the person can open (ADR-002: owners and admins get the others listed too, with no access). */
export const openableVaults = <T extends { permission?: string | null }>(rows: T[]) => rows.filter((row) => !!row.permission);

/** A vault manager who isn't an admin still gets the Collections page, for the vaults they manage (ADR-002). */
export const managesAnyVault = (rows: { manages?: boolean }[]) => rows.some((row) => !!row.manages);
