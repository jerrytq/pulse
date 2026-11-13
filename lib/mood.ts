export const moods = [
  { score: 1, label: "Very bad", description: "Felt bad for most of the day", color: "#b16d72" },
  { score: 2, label: "Bad", description: "More low moments than good ones", color: "#c39862" },
  { score: 3, label: "Neutral", description: "Mostly okay, or an even mix of good and bad", color: "#a5a077" },
  { score: 4, label: "Good", description: "More good moments than low ones", color: "#78a28d" },
  { score: 5, label: "Very good", description: "Felt good for most of the day", color: "#477c69" },
] as const;

export type Entry = { date: string; score: number; note?: string };

export const MAX_NOTE_LENGTH = 500;

export function normalizeNote(note: string) {
  const value = note.trim();
  if (value.length > MAX_NOTE_LENGTH) throw new Error(`Notes must be ${MAX_NOTE_LENGTH} characters or fewer.`);
  return value;
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function shiftDate(date: string, days: number) {
  const result = new Date(`${date}T12:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

export function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, options);
}

export function calendarSeries(entries: Entry[], start: string, end: string) {
  const byDate = new Map(entries.map(entry => [entry.date, entry.score]));
  const points: { date: string; score: number | null }[] = [];
  for (let date = start; date <= end; date = shiftDate(date, 1)) points.push({ date, score: byDate.get(date) ?? null });
  return points;
}
