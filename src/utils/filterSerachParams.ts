export const filterSerachParams = ({
  page = 1,
  pageSize = 10,
  order,
  sortKey,
  ...filters
}: any) => {
  const cleanFilters = Object.fromEntries(
    Object.entries(filters)?.filter(
      ([_, value]) => value !== undefined && value !== null && value !== ""
    )
  );

  const queryParams = new URLSearchParams(
    Object.entries({
      skip: page == 1 ? "0" : ((page - 1) * pageSize)?.toString(),
      take: pageSize?.toString(),
      order: order?.toString(),
      sortKey: sortKey?.toString(),
      ...cleanFilters,
    }).reduce<Record<string, string>>((acc, [key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        acc[key] = value;
      }
      return acc;
    }, {})
  );

  return queryParams;
};
