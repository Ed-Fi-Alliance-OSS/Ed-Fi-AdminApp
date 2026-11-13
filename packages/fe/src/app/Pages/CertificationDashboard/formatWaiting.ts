const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** How long a run has been waiting since `since` (ISO string): "3d 4h", "5h 12m", "12m" or "<1m". */
export const formatWaiting = (since: string, now: Date = new Date()): string => {
  const elapsed = now.getTime() - new Date(since).getTime();
  if (!(elapsed >= MINUTE)) return '<1m';

  const days = Math.floor(elapsed / DAY);
  const hours = Math.floor((elapsed % DAY) / HOUR);
  const minutes = Math.floor((elapsed % HOUR) / MINUTE);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};
