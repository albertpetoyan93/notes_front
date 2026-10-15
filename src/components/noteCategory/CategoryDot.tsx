import { categoryClass, categoryLabel } from "../../utils/noteCategory";

const CategoryDot = ({ category }: { category: string }) => (
  <span className={`type-dot ${categoryClass(category)}`}>{categoryLabel(category)}</span>
);

export default CategoryDot;
