import { isSecretField } from "./secretField";

type Field = { label: string; value: string };

/**
 * Did an edit put in a new secret (password, PIN, one-time code secret, recovery
 * codes)? Compared by value, so reordering or trimming isn't a change, and only
 * removing a secret isn't one either. Used to mark an offboarding task done:
 * saving the new password in 2keevo is the last step of changing it at the source.
 */
export const secretChanged = (before: Field[], after: Field[]) => {
  const secrets = (fields: Field[]) =>
    fields.filter((field) => isSecretField(field.label) && field.value.trim()).map((field) => field.value.trim());
  const old = new Set(secrets(before));
  return secrets(after).some((value) => !old.has(value));
};
