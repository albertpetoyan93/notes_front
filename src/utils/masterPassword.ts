import { leakCounts } from "./breachCheck";

/**
 * Is a password strong enough to be a master password? It now protects the
 * whole vault, and someone holding stolen data could try to guess it offline,
 * so the bar is higher than for a normal sign-in password.
 */
export const masterPasswordProblems = async (password: string) => {
  const problems: string[] = [];
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) => rule.test(password)).length;
  if (password.length < 12) problems.push("at least 12 characters");
  else if (password.length < 16 && classes < 3) {
    problems.push("a mix of letters, numbers and symbols, or 16+ characters");
  }
  if (!problems.length) {
    try {
      // Have I Been Pwned, k-anonymity: only 5 characters of a hash leave the browser.
      const counts = await leakCounts([password]);
      if ((counts.get(password) || 0) > 0) problems.push("to be one that isn't in known data leaks (this one is)");
    } catch {
      /* Offline: the length rules still apply. */
    }
  }
  return problems;
};
