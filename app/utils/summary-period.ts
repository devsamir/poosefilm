const DAY_MS = 24 * 60 * 60 * 1000;
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const periodFormatter = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "numeric",
  month: "short",
  year: "numeric",
});

type SummaryPeriod = { from: string; to: string };

export function readSummaryPeriod(params: URLSearchParams, now = new Date()): SummaryPeriod {
  const jakartaNow = new Date(now.getTime() + WIB_OFFSET_MS);
  const year = jakartaNow.getUTCFullYear();
  const month = jakartaNow.getUTCMonth();
  const from = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  const legacyDate = params.has("from") || params.has("to") ? null : params.get("date");

  return {
    from: params.get("from") ?? (legacyDate || from),
    to: params.get("to") ?? (legacyDate || to),
  };
}

function parseCalendarDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith("0000")) return null;
  const date = new Date(value + "T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function getSummaryDateRange({ from, to }: SummaryPeriod) {
  const firstDay = parseCalendarDay(from);
  const lastDay = parseCalendarDay(to);
  if (!firstDay || !lastDay || firstDay > lastDay) return null;

  return {
    start: new Date(firstDay.getTime() - WIB_OFFSET_MS),
    end: new Date(lastDay.getTime() + DAY_MS - WIB_OFFSET_MS),
  };
}

export function formatSummaryPeriod(period: SummaryPeriod) {
  const range = getSummaryDateRange(period);
  return range ? periodFormatter.formatRange(range.start, new Date(range.end.getTime() - 1)) : "Pilih periode";
}
