import { isRecoveryLabel } from "./recoveryCodes";
import { isTotpLabel } from "./totp";

export function isSecretField(label?: string) {
  const name = String(label || "").trim().toLowerCase();
  return (
    name.includes("password") ||
    name.includes("pass") ||
    name === "cvv" ||
    name === "pin" ||
    isTotpLabel(name) ||
    isRecoveryLabel(name)
  );
}
