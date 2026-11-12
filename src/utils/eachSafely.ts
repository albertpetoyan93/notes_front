/**
 * Run `work` for every item, one after another; a failing item is collected
 * and the rest still run (background key work: one company's race must not
 * hold up the others).
 */
export const eachSafely = async <T>(items: T[], work: (item: T) => Promise<unknown>) => {
  const failures: { item: T; error: unknown }[] = [];
  for (const item of items) {
    try {
      await work(item);
    } catch (error) {
      failures.push({ item, error });
    }
  }
  return failures;
};
