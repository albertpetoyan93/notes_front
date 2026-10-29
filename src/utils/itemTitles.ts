import { useVaultStore } from "../store/vaultStore";

/**
 * An item's title as this browser knows it. The server keeps no title for
 * end-to-end items (activity log, reports), so lists fill it in from the open
 * vault; an item that isn't open here stays "an item".
 */
export const knownTitle = (noteId: number | null | undefined) =>
  noteId ? useVaultStore.getState().summary.find((note) => note.id === noteId)?.title || "" : "";
