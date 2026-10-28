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
export function addCalendarDays(date, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid update date');
  const value = new Date(`${date}T00:00:00Z`);
  if (value.toISOString().slice(0, 10) !== date) throw new Error('Invalid update date');
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function freshness(updatedOn, intervalOrNow = 5, warningDays = 0, now = new Date()) {
  const intervalMonths = typeof intervalOrNow === 'number' ? intervalOrNow : 5;
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1 || !Number.isInteger(warningDays) || warningDays < 0) throw new Error('Invalid update interval');
  const clock = typeof intervalOrNow === 'number' ? now : intervalOrNow;
  const dueOn = addCalendarMonths(updatedOn, intervalMonths);
  const warningOn = addCalendarDays(dueOn, -warningDays);
  const today = shanghaiDate(clock);
  const stale = today >= dueOn;
  const near = !stale && warningDays > 0 && today >= warningOn;
  return { stale, near, active: stale || near, dueOn, warningOn, today };
}
