import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateMsgIds(rows: { timestamp: string }[]) {
  const dayCounts = new Map<string, number>();
  return rows.map(r => {
    const d = r.timestamp.slice(0, 10);
    const n = (dayCounts.get(d) ?? 0) + 1;
    dayCounts.set(d, n);
    return `m-${d}-${String(n).padStart(3, "0")}`;
  });
}