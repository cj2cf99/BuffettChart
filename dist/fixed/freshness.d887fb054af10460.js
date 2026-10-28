// Date-only calendar policy, evaluated in Asia/Shanghai. Builds never reset it.
export function shanghaiDate(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}
export function addCalendarMonths(date, months) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid update date');
  const [year, month, day] = date.split('-').map(Number);
  const original = new Date(Date.UTC(year, month - 1, day));
  if (original.toISOString().slice(0, 10) !== date) throw new Error('Invalid update date');
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}
export function freshness(updatedOn, now = new Date()) {
  const dueOn = addCalendarMonths(updatedOn, 5);
  const today = shanghaiDate(now);
  return { stale: today > dueOn, dueOn, today };
}
