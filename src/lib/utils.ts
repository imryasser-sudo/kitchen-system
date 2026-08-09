// دالة لتحويل الأرقام العربية (الشرقية) إلى إنجليزية
export const toEnglishDigits = (val: string | number): string => {
  if (val === null || val === undefined) return '';
  return String(val).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d).toString());
};