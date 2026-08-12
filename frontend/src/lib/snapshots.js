// Date helper used by mission/downtime flows to advance the in-universe
// calendar by one day.

/**
 * Advance a YYYY-MM-DD date string by one day. If the input is invalid,
 * returns it unchanged.
 *
 * @param {string} dateStr
 * @returns {string}
 */
export function advanceDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;

  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;

  const [yearStr, monthStr, dayStr] = parts;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateStr;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return dateStr;

  date.setUTCDate(date.getUTCDate() + 1);

  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(date.getUTCDate()).padStart(2, '0');

  return `${nextYear}-${nextMonth}-${nextDay}`;
}
