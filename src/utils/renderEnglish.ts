export const renderEnglishField = (data: any, field: string) => {
  const englishText = data?.find((item: any) => item.language_id == 9);
  return englishText?.[field] || "N/A";
};
