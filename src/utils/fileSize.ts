/** A byte count as people read it: 12 KB, 3.4 MB, 1 GB. */
export const fileSize = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${Math.round(bytes / 1024)} KB`
      : bytes < 1024 * 1024 * 1024
        ? `${(bytes / 1024 / 1024).toFixed(1).replace(/\.0$/, "")} MB`
        : `${(bytes / 1024 / 1024 / 1024).toFixed(2).replace(/\.?0+$/, "")} GB`;
