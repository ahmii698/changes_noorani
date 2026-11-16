/*
  Trial user shape (the TypeScript type is gone, this is just for reference):
  { id: number, name: string, phone: string, start_date: "YYYY-MM-DD", days: number }
*/

/* "YYYY-MM-DD" ko local date banata hai (timezone ka masla na ho) */
export const parseISO = (iso) => {
  const [y, m, d] = (iso || "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
};

/* Date -> "YYYY-MM-DD" (local) */
export const toISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const startOfToday = () => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

/* Trial ki end date = start date + din */
export const getEndDate = (t) => {
  const s = parseISO(t.start_date);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + Number(t.days || 0));
};

/* Bache hue din. 0 = aaj last din, negative = expire ho chuka */
export const getDaysLeft = (t) => {
  const end = getEndDate(t);
  if (isNaN(end.getTime())) return -1;
  return Math.round((end.getTime() - startOfToday().getTime()) / 86400000);
};

export const formatDate = (d) => {
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

export const formatISODate = (iso) => formatDate(parseISO(iso));