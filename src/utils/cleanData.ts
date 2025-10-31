export const cleanData = (data: any[]) => {
  return data.map((item) =>
    Object.fromEntries(
      Object.entries(item).filter(([_, value]) => value !== null)
    )
  );
};
