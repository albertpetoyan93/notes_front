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
 * A company collection's menu in the sidebar. Owners and admins get
 * permission "owner" on every company collection and may rename or delete it;
 * editors can only bring their own items in.
 */
export const companyCollectionActions = (
  permission: Permission,
  { inCompany, canManage }: { inCompany: boolean; canManage: boolean }
): ("add" | "rename" | "delete")[] => {
  if (!inCompany) return [];
  if (permission === "owner" && canManage) return ["add", "rename", "delete"];
  return permission === "owner" || permission === "edit" ? ["add"] : [];
};
