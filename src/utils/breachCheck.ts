// Leaked-password check against Have I Been Pwned, done in the browser.
// Each password is hashed with SHA-1 here; only the first 5 characters of the
// hash are sent, and the rest is compared on this device (k-anonymity). The
// password, and even its full hash, never leave the browser.

const RANGE_URL = "https://api.pwnedpasswords.com/range/";
const PARALLEL = 4;

const sha1Hex = async (text: string) => {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
};

// "SUFFIX:COUNT" lines for one 5-character prefix. Padding lines have count 0.
const fetchRange = async (prefix: string) => {
  const response = await fetch(`${RANGE_URL}${prefix}`, { headers: { "Add-Padding": "true" } });
  if (!response.ok) throw new Error(`The leak check service answered ${response.status}`);
  const counts = new Map<string, number>();
  (await response.text()).split("\n").forEach((line) => {
    const [suffix, count] = line.trim().split(":");
    if (suffix && count) counts.set(suffix, Number(count) || 0);
  });
  return counts;
};

/**
 * How often each password appears in known leaks (0 when never).
 * `onProgress(done, total)` counts distinct passwords.
 */
export const leakCounts = async (
  passwords: string[],
  onProgress?: (done: number, total: number) => void
) => {
  const unique = [...new Set(passwords.filter(Boolean))];
  const hashes = new Map<string, string>();
  for (const password of unique) hashes.set(password, await sha1Hex(password));

  // One request per distinct prefix, shared by passwords that have it.
  const byPrefix = new Map<string, string[]>();
  unique.forEach((password) => {
    const prefix = hashes.get(password)!.slice(0, 5);
    byPrefix.set(prefix, [...(byPrefix.get(prefix) || []), password]);
  });

  const result = new Map<string, number>();
  const prefixes = [...byPrefix.keys()];
  let done = 0;
  onProgress?.(0, unique.length);
  const worker = async () => {
    for (;;) {
      const prefix = prefixes.shift();
      if (!prefix) return;
      const range = await fetchRange(prefix);
      for (const password of byPrefix.get(prefix)!) {
        result.set(password, range.get(hashes.get(password)!.slice(5)) || 0);
        done += 1;
      }
      onProgress?.(done, unique.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, prefixes.length) }, worker));
  return result;
};
