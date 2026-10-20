// Recovery (backup) codes a site gives when two-factor sign-in is turned on.
// Stored in the item as text, one code per line; a used code starts with "~".

// Field names that hold recovery codes. None contain "pass". Same rule as the
// API (NoteService.ts).
const RECOVERY_LABEL = /^((2fa|mfa|two[- ]?factor) )?(recovery|backup)( codes?| keys?)?$/i;

export const RECOVERY_FIELD_LABEL = "Recovery codes";

export const isRecoveryLabel = (label?: string) =>
  RECOVERY_LABEL.test(String(label || "").trim());

export interface RecoveryCode {
  code: string;
  used: boolean;
}

const USED = "~";

// Digit groups split by single spaces are one code: "1234 5678" (Google, Facebook).
const SPACED_DIGITS = /^\d{3,5}( \d{3,5})+$/;
// Otherwise a code is letters/digits, maybe joined by "-", with a digit or a
// "-" in it: "a1b2c-3d4e5" (GitHub), "abcd-efgh" (Discord), "8f3k2m9x".
const CODE = /^[a-z0-9]+(-[a-z0-9]+)*$/i;
const looksLikeCode = (token: string) =>
  CODE.test(token) && token.replace(/-/g, "").length >= 5 && /[\d-]/.test(token);

// Reads codes from what the site shows or its .txt download: one per line,
// two columns, numbered lists, commas. A line with anything that isn't a code
// (a heading such as "GitHub recovery codes") is skipped.
export const parseRecoveryCodes = (text?: string): RecoveryCode[] => {
  const seen = new Set<string>();
  const codes: RecoveryCode[] = [];
  const add = (raw: string, used: boolean) => {
    const code = raw.trim();
    const key = code.toLowerCase();
    if (!code || seen.has(key)) return;
    seen.add(key);
    codes.push({ code, used });
  };

  String(text || "")
    .split(/\r?\n/)
    .forEach((rawLine) => {
      let line = rawLine.trim();
      if (!line) return;
      const used = line.startsWith(USED);
      if (used) line = line.slice(USED.length).trim();
      const found: string[] = [];
      // Columns are split by 2+ spaces, tabs, commas or semicolons.
      for (let segment of line.split(/\s{2,}|\t|[,;]/)) {
        // "1. abcd-efgh", "1) abcd-efgh", "• abcd-efgh"
        segment = segment.trim().replace(/^(\d{1,2}[.)]|[-*•])\s+/, "");
        if (!segment) continue;
        if (SPACED_DIGITS.test(segment)) {
          found.push(segment);
          continue;
        }
        const tokens = segment.split(" ");
        if (!tokens.every(looksLikeCode)) return;
        found.push(...tokens);
      }
      found.forEach((code) => add(code, used));
    });
  return codes;
};

export const formatRecoveryCodes = (codes: RecoveryCode[]) =>
  codes.map((item) => (item.used ? `${USED}${item.code}` : item.code)).join("\n");

// Tidies pasted or loaded text into one code per line, keeping the used marks.
export const normalizeRecoveryCodes = (text: string) => {
  const codes = parseRecoveryCodes(text);
  return codes.length ? formatRecoveryCodes(codes) : text.trim();
};

export const recoverySummary = (codes: RecoveryCode[]) => {
  const left = codes.filter((item) => !item.used).length;
  return { left, total: codes.length };
};
