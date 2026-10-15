// One place for how note categories are named and coloured.
// Colours live in the theme tokens as --cat* and are picked up by the `cat-*` classes.

export const categoryKey = (category: string) =>
  category === "login" ? "password" : category;

const labels: Record<string, string> = {
  note: "Note",
  password: "Login",
  command: "Command",
  ssh: "SSH",
  db: "Database",
  address: "Address",
  card: "Card",
  other: "Other",
};

export const categoryLabel = (category: string) => {
  const key = categoryKey(category);
  return labels[key] || key.charAt(0).toUpperCase() + key.slice(1);
};

export const categoryClass = (category: string) => `cat-${categoryKey(category)}`;
