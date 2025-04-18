export function formatDate(date: Date): string {
  return date
    .toLocaleString("en-US", {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    .replace(",", "")
    .replace(/^(\w+) (\d+) (\d+):(\d+)$/, (_, mon, day, hr, min) => {
      return `${mon} ${day} ${hr}:${min}`;
    })
    .padStart(16, " ");
}
