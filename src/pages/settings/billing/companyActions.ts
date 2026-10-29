import { message } from "antd";
import { useBillingStore, type FamilyInfo } from "../../../store/billingStore";
import type { BillingCompany } from "../../../store/billingStore";
import { useNoteStore } from "../../../store/noteStore";
import { useVaultStore } from "../../../store/vaultStore";

/** The owner can always take a company's items out, also while it is suspended. */
export const exportCompanyItems = async (company: BillingCompany) => {
  const backup = await useNoteStore.getState().exportCompany(company.id);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${company.name.replace(/[^\w-]+/g, "-").toLowerCase()}-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  if (backup.skipped) {
    message.warning(`Exported ${backup.notes.length} items. Skipped ${backup.skipped} that could not be opened.`);
  } else {
    message.success(`Exported ${backup.notes.length} items`);
  }
};

/** Members who joined but can't open the family collection yet. */
export const waitingForCollection = (family: FamilyInfo) =>
  family.organizer?.members.filter((member) => member.status === "active" && member.needsCollection) || [];

/**
 * Share the family collection with members who joined since. It runs in this browser:
 * in end-to-end vaults only the organizer's browser can hand over the collection key.
 */
export const shareFamilyCollection = async (family: FamilyInfo) => {
  const organizer = family.organizer;
  if (!organizer?.collection) return;
  const result = await useNoteStore.getState().shareCollection(
    organizer.collection.id,
    waitingForCollection(family).map((member) => member.email),
    "edit"
  );
  if (result.failed?.length) throw new Error(result.failed[0].message);
  await useBillingStore.getState().load();
  useVaultStore.getState().refresh();
};
