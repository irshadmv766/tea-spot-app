const SHOP_TZ = "Asia/Kolkata";

export type FixedReportPreset = "today" | "week" | "month";
export type ReportPreset = FixedReportPreset | "custom";

export type DateRange = { from: string; to: string; label: string };

function shopYmd(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function boundsForYmd(ymd: string): { from: string; to: string } {
  const from = new Date(`${ymd}T00:00:00+05:30`).toISOString();
  const to = new Date(`${ymd}T23:59:59.999+05:30`).toISOString();
  return { from, to };
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + delta));
  return utc.toISOString().slice(0, 10);
}

export function ymdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+05:30`);
}

export function dateToShopYmd(date: Date): string {
  return shopYmd(date);
}

export function defaultCustomRangeYmd(): { fromYmd: string; toYmd: string } {
  const today = shopYmd();
  return { fromYmd: addDaysYmd(today, -6), toYmd: today };
}

export function getRangeForYmdSpan(fromYmd: string, toYmd: string): DateRange {
  const start = fromYmd <= toYmd ? fromYmd : toYmd;
  const end = fromYmd <= toYmd ? toYmd : fromYmd;
  const { from } = boundsForYmd(start);
  const { to } = boundsForYmd(end);
  const label =
    start === end
      ? formatDayShortFromYmd(start)
      : `${formatDayShortFromYmd(start)} – ${formatDayShortFromYmd(end)}`;
  return { from, to, label };
}

export function getReportRange(
  preset: ReportPreset,
  customFromYmd: string,
  customToYmd: string
): DateRange {
  if (preset === "custom") {
    return getRangeForYmdSpan(customFromYmd, customToYmd);
  }
  return getRangeForPreset(preset);
}

export function getRangeForPreset(preset: FixedReportPreset): DateRange {
  const today = shopYmd();
  if (preset === "today") {
    const { from, to } = boundsForYmd(today);
    return { from, to, label: "Today" };
  }
  if (preset === "week") {
    const start = addDaysYmd(today, -6);
    const { from } = boundsForYmd(start);
    const { to } = boundsForYmd(today);
    return { from, to, label: "Last 7 days" };
  }
  const [y, m] = today.split("-");
  const monthStart = `${y}-${m}-01`;
  const { from } = boundsForYmd(monthStart);
  const { to } = boundsForYmd(today);
  return { from, to, label: "This month" };
}

export function formatTimeLocal(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: SHOP_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDayLocal(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: SHOP_TZ,
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

export function formatDayShortFromYmd(ymd: string): string {
  const date = new Date(`${ymd}T12:00:00+05:30`);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: SHOP_TZ,
    day: "numeric",
    month: "short",
  }).format(date);
}

export function getAllTimeRange(): DateRange {
  const today = shopYmd();
  const { to } = boundsForYmd(today);
  return { from: new Date(0).toISOString(), to, label: "All time" };
}

export function getRangeForDayOffset(offset: number): DateRange {
  const ymd = addDaysYmd(shopYmd(), offset);
  const { from, to } = boundsForYmd(ymd);
  const label = offset === 0 ? "Today" : formatDayShortFromYmd(ymd);
  return { from, to, label };
}

export function shopTodayYmd(): string {
  return shopYmd();
}