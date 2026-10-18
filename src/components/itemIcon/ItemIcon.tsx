import type { Note } from "../../store/noteStore";
import { categoryClass } from "../../utils/noteCategory";
import { resolvePlatform } from "../platformIcon/PlatformIcon";
import "./itemIcon.scss";

// The tile at the start of a row: the service's logo when we know it,
// otherwise the item's first letter on its category colour.
const ItemIcon = ({
  note,
  size = "md",
}: {
  // A saved note, or the editor's draft of one.
  note: Pick<Note, "title" | "content"> & { category: string };
  size?: "sm" | "md" | "lg";
}) => {
  const brand = resolvePlatform(note);
  const Icon = brand?.icon;

  if (brand && Icon) {
    return (
      <span
        className={`item-icon is-brand ${size}`}
        style={{ color: brand.color || undefined, background: brand.bg || undefined }}
        title={brand.label}
        aria-hidden
      >
        <Icon />
      </span>
    );
  }

  const letter = (note.title || "").replace(/[^a-z0-9]/gi, "").charAt(0).toUpperCase() || "?";
  return (
    <span className={`item-icon ${categoryClass(note.category)} ${size}`} aria-hidden>
      {letter}
    </span>
  );
};

export default ItemIcon;
